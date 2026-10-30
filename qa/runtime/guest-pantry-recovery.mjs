import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.QA_PREVIEW_URL;
const sha = process.env.QA_EXPECTED_SHA;
const output = process.env.QA_ARTIFACT_DIR || "artifacts/runtime-qa-local";
if (!base || !sha) throw new Error("QA_PREVIEW_URL and QA_EXPECTED_SHA are required");
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname)) {
  throw new Error("Guest recovery QA must only run against the isolated local preview");
}

const MAIN = "balkanbite_pantry";
const BACKUP = "balkanbite_pantry_quarantine_v1";
const valid = {
  id: "qa-guest-rice",
  name: "QA Rice",
  quantity: 500,
  unit: "g",
  category: "Pantry/Grains",
  addedAt: "2026-10-14",
};

await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const evidence = { buildSha: sha, scenario: "guest-pantry-nondestructive-recovery", result: "running", checks: [] };

async function run({ original, previousBackup = null, expectedBlocked = false, expectedExtension = "json", expectedItems = [valid] }) {
  const context = await browser.newContext({ acceptDownloads: true });
  let page;
  try {
    await context.addInitScript(({ original, previousBackup, MAIN, BACKUP }) => {
      // Seed a fresh session only once. A reload must preserve actual
      // storage, or the test could silently replay the original fixture.
      if (sessionStorage.getItem("__qa_guest_recovery_seeded")) return;
      sessionStorage.setItem("__qa_guest_recovery_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      // Simulate a returning guest with completed onboarding, not a fresh
      // profile where the onboarding dialog correctly blocks background clicks.
      localStorage.setItem("balkanbite_profile", JSON.stringify({ language: "en", onboardingCompleted: true }));
      localStorage.setItem(MAIN, original);
      if (previousBackup !== null) localStorage.setItem(BACKUP, previousBackup);
    }, { original, previousBackup, MAIN, BACKUP });
    await context.route("https://images.unsplash.com/**", route =>
      route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }),
    );
    page = await context.newPage();
    await page.goto(new URL("/", base).toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.getByTestId("guest-pantry-recovery").waitFor({ state: "visible", timeout: 20000 });

    if (expectedBlocked) {
      await page.getByTestId("guest-pantry-recovery").getByText(/could not be protected|No se pudo proteger|Не можахме/).waitFor({ timeout: 12000 });
    } else {
      await page.waitForFunction(({ BACKUP, original, MAIN }) =>
        localStorage.getItem(BACKUP) === original && localStorage.getItem(MAIN) !== original,
        { BACKUP, original, MAIN },
        { timeout: 12000 },
      );
      const persisted = await page.evaluate(MAIN => localStorage.getItem(MAIN), MAIN);
      assert.deepEqual(JSON.parse(persisted), expectedItems, "active stock must include exactly the validated entries");
    }

    const stored = await page.evaluate(({ MAIN, BACKUP }) => ({
      primary: localStorage.getItem(MAIN),
      backup: localStorage.getItem(BACKUP),
    }), { MAIN, BACKUP });
    assert.equal(stored.backup, previousBackup ?? original, "the backup must keep the exact original bytes");
    if (expectedBlocked) assert.equal(stored.primary, original, "conflicting backup must block primary overwrite");

    if (expectedBlocked) {
      assert.equal(await page.getByTestId("guest-pantry-continue-verified").count(), 0);
    } else {
      const continueButton = page.getByTestId("guest-pantry-continue-verified");
      await continueButton.waitFor({ state: "visible", timeout: 10000 });
      await continueButton.click();
      await page.getByTestId("guest-pantry-recovery").getByText(/verified entries only|entradas validadas; las demás|проверените записи/).waitFor({ timeout: 10000 });
    }

    const pendingDownload = page.waitForEvent("download", { timeout: 15000 });
    await page.getByTestId("guest-pantry-recovery").getByRole("button", {
      name: /Download original data|Descargar datos originales|Изтеглете оригиналните данни/,
    }).click();
    const download = await pendingDownload;
    assert.ok(download.suggestedFilename().endsWith("." + expectedExtension));
    const downloaded = await fs.readFile(await download.path(), "utf8");
    assert.equal(downloaded, original, "recovery export must preserve exact original bytes");
    if (expectedBlocked && previousBackup !== null && previousBackup !== original) {
      // Both different historical sources must be individually recoverable.
      const previousDownload = page.waitForEvent("download", { timeout: 15000 });
      await page.getByTestId("guest-pantry-download-previous-backup").click();
      const older = await previousDownload;
      assert.match(older.suggestedFilename(), /guest-pantry-previous-backup\.json$/);
      assert.equal(await fs.readFile(await older.path(), "utf8"), previousBackup);
      evidence.checks.push("both-conflicting-raw-copies-exportable");
    }
    // Review permission must not survive a page reload: the incomplete
    // pantry is not silently made authoritative for a later session.
    if (!expectedBlocked) {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
      await page.getByTestId("guest-pantry-recovery").waitFor({ state: "visible", timeout: 20000 });
      await page.getByTestId("guest-pantry-continue-verified").waitFor({ state: "visible", timeout: 10000 });
      const persistedAfterReload = await page.evaluate(({ MAIN, BACKUP }) => ({
        primary: localStorage.getItem(MAIN),
        backup: localStorage.getItem(BACKUP),
      }), { MAIN, BACKUP });
      assert.equal(persistedAfterReload.backup, original, "reload must retain exact original backup");
      assert.deepEqual(JSON.parse(persistedAfterReload.primary), expectedItems);
      evidence.checks.push("review-reset-on-page-reload");
    }
    evidence.checks.push(expectedBlocked ? "conflict-blocks-overwrite" :
      expectedExtension === "txt" ? "malformed-json-recovery-export" : "backup-before-overwrite");
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runFailedGuestQuantityWrite({ silent = false } = {}) {
  const context = await browser.newContext();
  let page;
  const dialogs = [];
  const consoleWarnings = [];
  let stage = "before-mount";
  try {
    const raw = JSON.stringify([valid]);
    await context.addInitScript(({ MAIN, raw }) => {
      if (sessionStorage.getItem("__qa_quantity_failure_seeded")) return;
      sessionStorage.setItem("__qa_quantity_failure_seeded", "yes");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({ language: "en", onboardingCompleted: true }));
      localStorage.setItem(MAIN, raw);
      // An edit must start from a settled, complete guest workspace, not
      // race against first-render effects creating these three caches.
      localStorage.setItem("balkanbite_recipes", "[]");
      localStorage.setItem("balkanbite_mealplan", "[]");
      localStorage.setItem("balkanbite_shopping", "[]");
      localStorage.setItem("balkanbite_progression", "[]");
    }, { MAIN, raw });
    page = await context.newPage();
    page.on("dialog", async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.dismiss();
    });
    page.on("console", event => {
      if (["warning", "error"].includes(event.type())) {
        consoleWarnings.push(event.text().slice(0, 1200));
      }
    });
    await page.goto(new URL("/", base).toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("#nav-tab-pantry").click();
    await page.getByText("QA Rice", { exact: true }).waitFor({ state: "visible", timeout: 15000 });
    await page.getByRole("button", { name: "Increase quantity" }).waitFor({ state: "visible", timeout: 15000 });
    stage = "hydrated";
    await page.waitForFunction(() => ["balkanbite_recipes", "balkanbite_mealplan",
      "balkanbite_shopping"].every(key => localStorage.getItem(key) === "[]"), null,
      { timeout: 12000 });
    const before = await page.evaluate(MAIN => localStorage.getItem(MAIN), MAIN);
    assert.equal(before, raw);

    // The guest write fails AFTER app hydration, like a quota/security error
    // on a real mutation. A successful React update must never be claimed.
    await page.evaluate(({ MAIN, silent }) => {
      const nativeSetItem = Storage.prototype.setItem;
      window.__qaFailedQuantityWriteAttempts = 0;
      Storage.prototype.setItem = function(key, value) {
        if (key === MAIN) {
          window.__qaFailedQuantityWriteAttempts++;
          if (silent) return;
          throw new DOMException("local storage quota reached", "QuotaExceededError");
        }
        return nativeSetItem.call(this, key, value);
      };
    }, { MAIN, silent });

    stage = "injected-fault";
    await page.getByRole("button", { name: "Increase quantity" }).click();
    // A green assertion must prove that the poisoned storage method was
    // actually exercised. Otherwise a blocked click can look like a rollback.
    await page.waitForFunction(() => window.__qaFailedQuantityWriteAttempts > 0,
      null, { timeout: 12000 });
    stage = "storage-fault-observed";
    // The old direct writer and new journal writer signal storage failure in
    // different banners. The assertions below still require unchanged bytes
    // and unchanged displayed stock, never an optimistic write.
    const explicitBlockingAlert = dialogs.some(dialog =>
      dialog.type === "alert" &&
      /The entire operation could not be confirmed\. Reload and review the data before continuing\./.test(dialog.message)
    );
    if (!explicitBlockingAlert) {
      // The guarded write path can report failure using a blocking browser
      // alert rather than an in-page banner. Require at least one verified
      // warning channel, not one particular component layout.
      await page.locator(
        '[data-testid="guest-pantry-recovery"], [data-testid="guest-shopping-consistency-warning"], [data-testid="guest-journal-recovery-warning"]',
      ).filter({ hasText: /could not be protected|pantry and shopping consistency could not be confirmed|unfinished local operation/i })
        .first().waitFor({ state: "visible", timeout: 12000 });
    }
    stage = "warning-shown";
    const after = await page.evaluate(MAIN => localStorage.getItem(MAIN), MAIN);
    assert.equal(after, before, "failed writes must keep original storage");
    const riceCard = page.getByText("QA Rice", { exact: true }).locator("xpath=ancestor::div[contains(@class, 'group')][1]");
    await riceCard.getByText("500", { exact: false }).first().waitFor({ state: "visible", timeout: 5000 });
    assert.equal(await page.getByText("550", { exact: false }).count(), 0, "failed quantity must not appear as confirmed stock");
    evidence.checks.push(silent
      ? "silent-write-rejected-no-optimistic-stock"
      : "failed-mutation-preserves-stock-and-storage");
  } catch (error) {
    // Keep actionable, synthetic-only evidence for CI failures; never infer
    // that a timeout is harmless without seeing the actual UI and bytes.
    const suffix = silent ? "silent" : "throw";
    const diag = { stage, silent, dialogs, consoleWarnings,
      message: error instanceof Error ? error.message : String(error) };
    if (page && !page.isClosed()) {
      try {
        diag.browser = await page.evaluate(MAIN => ({
          pantry: localStorage.getItem(MAIN),
          journal: localStorage.getItem("balkanbite_guest_pantry_shopping_journal_v1"),
          attempts: window.__qaFailedQuantityWriteAttempts ?? null,
          warnings: [...document.querySelectorAll(
            '[data-testid="guest-pantry-recovery"], [data-testid="guest-shopping-consistency-warning"], [data-testid="guest-journal-recovery-warning"]',
          )].map(node => ({ text: node.textContent, visible: node.getBoundingClientRect().height > 0 })),
          displayedQuantity: document.querySelector("#pantry-view")?.textContent?.slice(0, 1300) ?? null,
        }), MAIN);
      } catch (captureError) {
        diag.browserCaptureError = String(captureError);
      }
      try {
        await page.screenshot({ path: path.join(output, `guest-quantity-failure-${suffix}.png`),
          fullPage: true, timeout: 5000 });
      } catch (captureError) {
        diag.screenshotCaptureError = String(captureError);
      }
    }
    await fs.writeFile(path.join(output, `guest-quantity-failure-${suffix}.json`),
      JSON.stringify(diag, null, 2));
    throw error;
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runGuestPantryAddEditDeleteReload() {
  // This is an actual App + localStorage browser flow, not a mocked React
  // state assertion. No account, personal record, or external service used.
  const context = await browser.newContext();
  let page;
  const readRows = async () => JSON.parse(
    await page.evaluate(MAIN => localStorage.getItem(MAIN), MAIN),
  );
  try {
    await context.addInitScript(({ MAIN }) => {
      if (sessionStorage.getItem("__qa_guest_crud_seeded")) return;
      sessionStorage.setItem("__qa_guest_crud_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, "[]");
    }, { MAIN });
    page = await context.newPage();
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.locator("#nav-tab-pantry").click();
    await page.locator("#pantry-view").waitFor({ state: "visible", timeout: 15000 });
    assert.deepEqual(await readRows(), []);

    await page.locator("#pantry-add-item-btn").click();
    await page.locator("#pantry-item-name").fill("QA guest lentils");
    await page.locator("#pantry-quantity").fill("200");
    await page.locator("#pantry-view form select").first().selectOption("g");
    await page.locator("#pantry-category").selectOption("Pantry/Grains");
    await page.locator("#pantry-view form button[type=submit]").click();

    await page.waitForFunction(MAIN => {
      const raw = localStorage.getItem(MAIN);
      if (!raw) return false;
      const rows = JSON.parse(raw);
      return rows.length === 1 && rows[0].name === "QA guest lentils" &&
        rows[0].quantity === 200 && rows[0].unit === "g" &&
        rows[0].category === "Pantry/Grains";
    }, MAIN);
    let [row] = await readRows();
    const id = row.id;
    assert.ok(typeof id === "string" && id.trim(), "item gets real ID");
    await page.locator(`#pantry-item-${id}`).waitFor({ state: "visible" });
    evidence.checks.push("manual-add-commits-before-success");

    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("#nav-tab-pantry").click();
    await page.locator(`#pantry-item-${id}`).waitFor({ state: "visible" });
    [row] = await readRows();
    assert.equal(row.quantity, 200, "refresh retains the exact stored quantity");
    evidence.checks.push("manual-add-rehydrates");

    await page.locator(`#pantry-item-${id}`).getByRole("button", {
      name: "Increase quantity",
    }).click();
    await page.waitForFunction(({ MAIN, id }) => {
      const rows = JSON.parse(localStorage.getItem(MAIN) || "[]");
      return rows.length === 1 && rows[0].id === id && rows[0].quantity === 250;
    }, { MAIN, id });
    evidence.checks.push("manual-edit-commits");

    await page.locator(`#pantry-item-${id}`).getByRole("button", {
      name: "Delete",
    }).click();
    await page.waitForFunction(MAIN => localStorage.getItem(MAIN) === "[]", MAIN);
    assert.equal(await page.locator(`#pantry-item-${id}`).count(), 0);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    assert.deepEqual(await readRows(), [], "deleted items must not return after reload");
    evidence.checks.push("manual-delete-persists-and-reloads");
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runMalformedGuestShoppingOnStartup() {
  const SHOPPING = "balkanbite_shopping";
  const original = JSON.stringify([
    { id: "qa-preserved-broken-record", note: "original unknown user information" },
    { id: "qa-manual", name: "QA manual entry", quantity: 1, unit: "ud",
      category: "Other", checked: false },
  ]);
  const context = await browser.newContext();
  let page;
  try {
    await context.addInitScript(({ MAIN, SHOPPING, valid, original }) => {
      if (sessionStorage.getItem("__qa_malformed_shopping_seeded")) return;
      sessionStorage.setItem("__qa_malformed_shopping_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([valid]));
      localStorage.setItem("balkanbite_mealplan", "[]");
      localStorage.setItem(SHOPPING, original);
    }, { MAIN, SHOPPING, valid, original });
    page = await context.newPage();
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.getByTestId("guest-shopping-consistency-warning")
      .waitFor({ state: "visible", timeout: 15000 });
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SHOPPING), original,
      "guest hydration must not silently discard the unrecognized shopping record");
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.getByTestId("guest-shopping-consistency-warning")
      .waitFor({ state: "visible", timeout: 15000 });
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SHOPPING), original,
      "reload must preserve exact original shopping bytes until assisted recovery");
    evidence.checks.push("malformed-shopping-raw-preserved-across-reload");
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runGuestDerivedShoppingSilentFailure() {
  // #459: prove the crash-consistency boundary with an actual App runtime.
  // No invented household data: all food names and amounts are QA fixtures.
  const SHOPPING = "balkanbite_shopping";
  // Deterministic managed ID matches the planner's FNV-derived identity.
  const hashSource = "qa rice::mass";
  let managedHash = 2166136261;
  for (let i = 0; i < hashSource.length; i++) {
    managedHash ^= hashSource.charCodeAt(i);
    managedHash = Math.imul(managedHash, 16777619);
  }
  const MANAGED_ID = `shortage-v1:${(managedHash >>> 0).toString(36)}`;
  const plannedRecipe = {
    id: "qa-rice-plan", title: { en: "QA planned rice", bg: "QA ориз", es: "QA arroz" },
    description: { en: "QA planned test", bg: "QA тест", es: "QA prueba" },
    prepTimeMin: 0, cookTimeMin: 0, costPerServingEUR: 0, difficulty: "easy",
    servings: 1, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0,
    nutritionDataStatus: "estimated", costDataStatus: "estimated", tags: [],
    ingredients: [{ name: "QA Rice", amount: 520, unit: "g", inPantry: false }],
    instructions: { en: ["QA step"], bg: ["QA стъпка"], es: ["QA paso"] },
    nutritionHighlights: { en: "QA only", bg: "QA", es: "QA" },
  };
  const planDate = new Date().toLocaleDateString("en-CA");
  const plan = [{ date: planDate, lunch: plannedRecipe }];
  const managed = {
    id: MANAGED_ID,
    name: "QA Rice",
    quantity: 20,
    unit: "g",
    category: "Other",
    checked: false,
    amountOrigin: "deterministic_shortfall",
    purchaseAmountConfirmed: false,
    reason: "Para QA planned rice (Today)",
  };
  const manual = {
    id: "qa-manual-item",
    name: "QA manual item",
    quantity: 1,
    unit: "ud",
    category: "Other",
    checked: false,
    amountOrigin: "user_entered",
    purchaseAmountConfirmed: false,
  };
  const context = await browser.newContext();
  let page;
  try {
    await context.addInitScript(({ MAIN, SHOPPING, valid, manual, managed, plan }) => {
      if (sessionStorage.getItem("__qa_crash_seeded")) return;
      sessionStorage.setItem("__qa_crash_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem("balkanbite_recipes", "[]");
      localStorage.setItem("balkanbite_mealplan", JSON.stringify(plan));
      localStorage.setItem(MAIN, JSON.stringify([valid]));
      localStorage.setItem(SHOPPING, JSON.stringify([manual, managed]));
    }, { MAIN, SHOPPING, valid, manual, managed, plan });

    page = await context.newPage();
    page.on("dialog", dialog => dialog.dismiss());
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.locator("#nav-tab-pantry").click();
    await page.locator(`#pantry-item-${valid.id}`).waitFor({ state: "visible" });
    const startingShopping = await page.evaluate(key => localStorage.getItem(key), SHOPPING);
    assert.equal(JSON.parse(startingShopping).length, 2);

    // The shopping effect silently fails after the pantry key has succeeded.
    await page.evaluate(SHOPPING => {
      const native = Storage.prototype.setItem;
      window.__qaShoppingWriteAttempts = 0;
      Storage.prototype.setItem = function(key, value) {
        if (key === SHOPPING) {
          window.__qaShoppingWriteAttempts++;
          return;
        }
        return native.call(this, key, value);
      };
    }, SHOPPING);
    await page.locator(`#pantry-item-${valid.id}`)
      .getByRole("button", { name: "Increase quantity" }).click();
    await page.waitForFunction(MAIN => {
      const rows = JSON.parse(localStorage.getItem(MAIN) || "[]");
      return rows.length === 1 && rows[0].quantity === 550;
    }, MAIN);
    await page.waitForFunction(() => window.__qaShoppingWriteAttempts > 0);
    const stale = await page.evaluate(key => localStorage.getItem(key), SHOPPING);
    assert.equal(stale, startingShopping, "fault injection must retain the old derived snapshot");
    await page.getByTestId("guest-shopping-consistency-warning").waitFor({
      state: "visible", timeout: 10000,
    });

    // After an actual reload, a managed shortfall with no planned recipe
    // must not return as if it were still derived from confirmed stock.
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("#nav-tab-pantry").click();
    await page.locator(`#pantry-item-${valid.id}`).waitFor({ state: "visible" });
    await page.waitForFunction(({ SHOPPING, MANAGED_ID }) => {
      const raw = localStorage.getItem(SHOPPING);
      if (!raw) return false;
      return !JSON.parse(raw).some(row => row.id === MANAGED_ID);
    }, { SHOPPING, MANAGED_ID }, { timeout: 10000 });
    const savedPantry = JSON.parse(await page.evaluate(key => localStorage.getItem(key), MAIN));
    const savedShopping = JSON.parse(await page.evaluate(key => localStorage.getItem(key), SHOPPING));
    assert.equal(savedPantry[0].quantity, 550);
    assert.deepEqual(savedShopping.filter(row => row.id === manual.id), [manual],
      "manual shopping rows must be preserved");
    assert.equal(savedShopping.some(row => row.id === MANAGED_ID), false,
      "a stale derived shortage must be repaired or explicitly quarantined on reload");
    evidence.checks.push("derived-shopping-failed-write-recovery");
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runBulgarianManualShoppingUnits() {
  // Real local BG 390px shopping form must show readable Bulgarian units
  // without changing the canonical storage units (g/kg/uds etc.).
  const SHOPPING = "balkanbite_shopping";
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "bg-BG",
  });
  let page;
  try {
    await context.addInitScript(({ MAIN, valid, SHOPPING }) => {
      if (sessionStorage.getItem("__qa_bg_manual_shopping_seeded")) return;
      sessionStorage.setItem("__qa_bg_manual_shopping_seeded", "yes");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "bg", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([valid]));
      localStorage.setItem(SHOPPING, "[]");
      localStorage.setItem("balkanbite_recipes", "[]");
      localStorage.setItem("balkanbite_mealplan", "[]");
      localStorage.setItem("balkanbite_progression", "[]");
    }, { MAIN, valid, SHOPPING });
    page = await context.newPage();
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.locator("#nav-tab-shopping").click();
    await page.locator("#manual-shopping-open").click();
    const select = page.locator("#manual-shopping-unit");
    await select.waitFor({ state: "visible", timeout: 12000 });
    const options = await select.locator("option").evaluateAll(nodes =>
      nodes.map(node => ({
        value: node.value,
        label: (node.textContent || "").trim(),
      }))
    );
    const expected = {
      uds: "Бройки (бр.)",
      kg: "Килограми (kg)",
      g: "Грамове (g)",
      packs: "Пакети (пак.)",
      manojos: "Връзки",
      l: "Литри (l)",
    };
    for (const [unit, label] of Object.entries(expected)) {
      assert.equal(options.find(option => option.value === unit)?.label, label,
        `Bulgarian label for canonical shopping unit ${unit}`);
    }
    await page.locator("#manual-shopping-name").fill("QA Леща");
    await page.locator("#manual-shopping-quantity").fill("500");
    await select.selectOption("g");
    await page.locator("#manual-shopping-submit").click();
    await page.waitForFunction(SHOPPING => {
      const rows = JSON.parse(localStorage.getItem(SHOPPING) || "[]");
      return rows.length === 1 && rows[0].name === "QA Леща" &&
        rows[0].quantity === 500 && rows[0].unit === "g" &&
        rows[0].checked === false && rows[0].purchaseAmountConfirmed === false;
    }, SHOPPING, { timeout: 12000 });
    const saved = await page.evaluate(SHOPPING => (
      JSON.parse(localStorage.getItem(SHOPPING) || "[]")
    ), SHOPPING);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].amountOrigin, "user_entered");
    assert.equal(saved[0].estimatedPriceEUR, undefined,
      "the localized form must not infer an absent price");
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("#nav-tab-shopping").click();
    await page.locator(`[id=${JSON.stringify("shopping-item-" + saved[0].id)}]`)
      .waitFor({ state: "visible", timeout: 12000 });
    const afterReload = await page.evaluate(SHOPPING => (
      JSON.parse(localStorage.getItem(SHOPPING) || "[]")
    ), SHOPPING);
    assert.deepEqual(afterReload, saved, "Bulgarian labels must not rewrite quantity/unit/user data");
    evidence.checks.push("bulgarian-390px-manual-shopping-units-canonical-ids-and-reload");
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runGuestManualShoppingAddLostWrite() {
  // A failed localStorage write must not close the manual form or claim an
  // added shopping item; the next retry must persist exactly the stated data.
  const SHOPPING = "balkanbite_shopping";
  const existing = { id: "qa-shopping-prior", name: "QA Existing Rice", quantity: 100,
    unit: "g", category: "", checked: false, amountOrigin: "user_entered",
    purchaseAmountConfirmed: false };
  const context = await browser.newContext();
  let page;
  try {
    await context.addInitScript(({ MAIN, valid, SHOPPING, existing }) => {
      if (sessionStorage.getItem("__qa_guest_manual_add_seeded")) return;
      sessionStorage.setItem("__qa_guest_manual_add_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([valid]));
      localStorage.setItem("balkanbite_recipes", "[]");
      localStorage.setItem("balkanbite_mealplan", "[]");
      localStorage.setItem(SHOPPING, JSON.stringify([existing]));
      localStorage.setItem("balkanbite_progression", "[]");
    }, { MAIN, valid, SHOPPING, existing });
    page = await context.newPage();
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.locator("#nav-tab-shopping").click();
    await page.locator("#shopping-item-qa-shopping-prior").waitFor({state:"visible"});
    const before = await page.evaluate(key => localStorage.getItem(key), SHOPPING);
    await page.locator("#manual-shopping-open").click();
    await page.locator("#manual-shopping-name").fill("QA New Lentils");
    await page.locator("#manual-shopping-quantity").fill("250");
    await page.locator("#manual-shopping-unit").selectOption("g");
    await page.evaluate(SHOPPING => {
      const native = Storage.prototype.setItem;
      window.__qaManualAddAttempts = 0;
      window.__qaRestoreManualAdd = () => { Storage.prototype.setItem = native; };
      Storage.prototype.setItem = function(key, value) {
        if (key === SHOPPING) {
          window.__qaManualAddAttempts++;
          return; // silently lost browser storage write
        }
        return native.call(this, key, value);
      };
    }, SHOPPING);
    await page.locator("#manual-shopping-submit").click();
    await page.waitForFunction(() => window.__qaManualAddAttempts > 0);
    await page.getByRole("alert").getByText(/The item was not saved/)
      .waitFor({state:"visible",timeout:10000});
    assert.equal(await page.locator("#manual-shopping-name").inputValue(), "QA New Lentils");
    assert.equal(await page.locator("#manual-shopping-quantity").inputValue(), "250");
    assert.equal(await page.locator("#manual-shopping-unit").inputValue(), "g");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SHOPPING), before,
      "lost add write must not replace original checklist bytes");
    assert.equal(await page.locator("[id^='shopping-item-shop-']").count(), 0);
    await page.getByTestId("guest-shopping-consistency-warning")
      .waitFor({state:"visible",timeout:10000});

    await page.evaluate(() => window.__qaRestoreManualAdd());
    await page.locator("#manual-shopping-submit").click();
    await page.locator("#manual-shopping-name").waitFor({state:"detached",timeout:10000});
    await page.waitForFunction(SHOPPING => {
      const rows=JSON.parse(localStorage.getItem(SHOPPING)||"[]");
      return rows.length===2 && rows[0].id==="qa-shopping-prior" &&
        rows[1].name==="QA New Lentils" && rows[1].quantity===250 &&
        rows[1].unit==="g" && rows[1].checked===false &&
        rows[1].amountOrigin==="user_entered" &&
        rows[1].purchaseAmountConfirmed===false;
    }, SHOPPING);
    const added=JSON.parse(await page.evaluate(key => localStorage.getItem(key), SHOPPING))[1];
    await page.locator(`#shopping-item-${added.id}`).waitFor({state:"visible"});
    await page.reload({waitUntil:"domcontentloaded",timeout:30000});
    await page.locator("#nav-tab-shopping").click();
    await page.locator(`#shopping-item-${added.id}`).waitFor({state:"visible"});
    evidence.checks.push("guest-manual-shopping-add-lost-write-preserves-form-then-retry-persists");
  } finally {
    await page?.close().catch(()=>{});
    await context.close();
  }
}

async function runGuestShoppingClearSilentWriteFailure() {
  // A bulk list deletion must not be acknowledged when localStorage drops
  // the write; the existing review dialog remains open for a safe retry.
  const SHOPPING = "balkanbite_shopping";
  const rows = [
    { id: "qa-clear-salt", name: "QA Salt", quantity: 1, unit: "uds",
      category: "Other", checked: false, amountOrigin: "user_entered",
      purchaseAmountConfirmed: false },
    { id: "qa-clear-rice", name: "QA Rice", quantity: 200, unit: "g",
      category: "Other", checked: true, amountOrigin: "user_entered",
      purchaseAmountConfirmed: true },
  ];
  const context = await browser.newContext();
  let page;
  try {
    await context.addInitScript(({ MAIN, valid, SHOPPING, rows }) => {
      if (sessionStorage.getItem("__qa_shopping_clear_seeded")) return;
      sessionStorage.setItem("__qa_shopping_clear_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([valid]));
      localStorage.setItem("balkanbite_recipes", "[]");
      localStorage.setItem("balkanbite_mealplan", "[]");
      localStorage.setItem(SHOPPING, JSON.stringify(rows));
      localStorage.setItem("balkanbite_progression", "[]");
    }, { MAIN, valid, SHOPPING, rows });
    page = await context.newPage();
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.locator("#nav-tab-shopping").click();
    await page.locator("#shopping-item-qa-clear-salt").waitFor({ state: "visible" });
    const before = await page.evaluate(key => localStorage.getItem(key), SHOPPING);
    await page.evaluate(SHOPPING => {
      const original = Storage.prototype.setItem;
      window.__qaClearWriteAttempts = 0;
      window.__qaRestoreClearWrite = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = function(key, value) {
        if (key === SHOPPING) {
          window.__qaClearWriteAttempts++;
          return;
        }
        return original.call(this, key, value);
      };
    }, SHOPPING);
    await page.locator("#clear-shopping-list-btn").click();
    const heading = page.getByRole("heading", { name: "Clear shopping list?" });
    await heading.waitFor({ state: "visible" });
    const confirm = heading.locator("xpath=../../..").getByRole("button", {
      name: "Clear", exact: true,
    });
    await confirm.click();
    await page.waitForFunction(() => window.__qaClearWriteAttempts > 0);
    await heading.waitFor({ state: "visible" });
    assert.equal(await page.locator("[id^='shopping-item-qa-clear']").count(), 2,
      "failed clear cannot remove either item from React");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SHOPPING), before,
      "failed clear must preserve the exact original saved checklist");
    await page.getByTestId("guest-shopping-consistency-warning")
      .waitFor({ state: "visible", timeout: 10000 });

    await page.evaluate(() => window.__qaRestoreClearWrite());
    await confirm.click();
    await heading.waitFor({ state: "detached", timeout: 10000 });
    await page.waitForFunction(SHOPPING =>
      localStorage.getItem(SHOPPING) === "[]", SHOPPING,
    );
    assert.equal(await page.locator("[id^='shopping-item-qa-clear']").count(), 0);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("#nav-tab-shopping").click();
    assert.equal(await page.locator("[id^='shopping-item-qa-clear']").count(), 0,
      "verified bulk deletion must survive reload");
    evidence.checks.push("guest-shopping-clear-failed-write-retains-dialog-rows-retry-persists");
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runGuestShoppingDeleteSilentWriteFailure() {
  // #459: a guest must never see a removed shopping item as saved when the
  // browser silently refuses to persist the new complete list.
  const SHOPPING = "balkanbite_shopping";
  const row = {
    id: "qa-shopping-delete", name: "QA Salt", quantity: 1, unit: "ud",
    category: "Other", checked: false, amountOrigin: "user_entered",
    purchaseAmountConfirmed: false,
  };
  const context = await browser.newContext();
  let page;
  try {
    await context.addInitScript(({ MAIN, valid, SHOPPING, row }) => {
      if (sessionStorage.getItem("__qa_shopping_delete_seeded")) return;
      sessionStorage.setItem("__qa_shopping_delete_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([valid]));
      localStorage.setItem("balkanbite_recipes", "[]");
      localStorage.setItem("balkanbite_mealplan", "[]");
      localStorage.setItem(SHOPPING, JSON.stringify([row]));
      localStorage.setItem("balkanbite_progression", "[]");
    }, { MAIN, valid, SHOPPING, row });

    page = await context.newPage();
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.locator("#nav-tab-shopping").click();
    const item = page.locator("#shopping-item-qa-shopping-delete");
    await item.waitFor({ state: "visible" });
    const before = await page.evaluate(key => localStorage.getItem(key), SHOPPING);
    await page.evaluate(SHOPPING => {
      const original = Storage.prototype.setItem;
      window.__qaGuestDeleteAttempts = 0;
      window.__qaRestoreGuestDelete = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = function(key, value) {
        if (key === SHOPPING) {
          window.__qaGuestDeleteAttempts++;
          return;
        }
        return original.call(this, key, value);
      };
    }, SHOPPING);
    await item.locator("button").last().click();
    await page.waitForFunction(() => window.__qaGuestDeleteAttempts > 0);
    await page.getByRole("alert").getByText(/The change was not saved/)
      .waitFor({ state: "visible", timeout: 10000 });
    await item.waitFor({ state: "visible" });
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SHOPPING), before,
      "failed deletion must not destroy the only saved row");
    await page.getByTestId("guest-shopping-consistency-warning")
      .waitFor({ state: "visible", timeout: 10000 });

    await page.evaluate(() => window.__qaRestoreGuestDelete());
    await item.locator("button").last().click();
    await item.waitFor({ state: "detached", timeout: 10000 });
    await page.waitForFunction(SHOPPING => localStorage.getItem(SHOPPING) === "[]", SHOPPING);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("#nav-tab-shopping").click();
    assert.equal(await page.locator("#shopping-item-qa-shopping-delete").count(), 0,
      "persisted deletion must survive reload");
    evidence.checks.push("guest-shopping-delete-silent-failure-preserves-row-and-successful-retry-survives-reload");
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runGuestShoppingToggleSilentWriteFailure() {
  // #459: a user-confirmed purchased quantity must not appear saved merely
  // because React updated, when the actual shopping write is silently lost.
  const SHOPPING = "balkanbite_shopping";
  const row = { id: "qa-shopping-commit", name: "QA Salt", quantity: 1,
    unit: "ud", category: "Other", checked: false, amountOrigin: "user_entered",
    purchaseAmountConfirmed: false };
  const context = await browser.newContext();
  let page;
  try {
    await context.addInitScript(({ MAIN, valid, SHOPPING, row }) => {
      if (sessionStorage.getItem("__qa_shopping_toggle_seeded")) return;
      sessionStorage.setItem("__qa_shopping_toggle_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([valid]));
      localStorage.setItem("balkanbite_recipes", "[]");
      localStorage.setItem("balkanbite_mealplan", "[]");
      localStorage.setItem(SHOPPING, JSON.stringify([row]));
      localStorage.setItem("balkanbite_progression", "[]");
    }, { MAIN, valid, SHOPPING, row });
    page = await context.newPage();
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.locator("#nav-tab-shopping").click();
    const item = page.locator("#shopping-item-qa-shopping-commit");
    await item.waitFor({ state: "visible" });
    const original = await page.evaluate(key => localStorage.getItem(key), SHOPPING);
    await page.evaluate(SHOPPING => {
      const native = Storage.prototype.setItem;
      window.__qaShoppingToggleWriteAttempts = 0;
      window.__qaRestoreShoppingToggleWrite = () => { Storage.prototype.setItem = native; };
      Storage.prototype.setItem = function(key, value) {
        if (key === SHOPPING) {
          window.__qaShoppingToggleWriteAttempts++;
          return;
        }
        return native.call(this, key, value);
      };
    }, SHOPPING);
    await item.getByRole("button", { name: /Confirm purchase of/ }).click();
    await page.waitForFunction(() => window.__qaShoppingToggleWriteAttempts > 0);
    await page.getByRole("alert").getByText(/The change was not saved/)
      .waitFor({ state: "visible", timeout: 10000 });
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SHOPPING), original);
    await item.getByRole("button", { name: /Confirm purchase of/ })
      .waitFor({ state: "visible", timeout: 10000 });
    await page.getByTestId("guest-shopping-consistency-warning")
      .waitFor({ state: "visible", timeout: 10000 });

    await page.evaluate(() => window.__qaRestoreShoppingToggleWrite());
    await item.getByRole("button", { name: /Confirm purchase of/ }).click();
    await page.waitForFunction(SHOPPING =>
      JSON.parse(localStorage.getItem(SHOPPING) || "[]")[0]?.checked === true,
      SHOPPING,
    );
    await item.getByRole("button", { name: /Confirm purchase of/ })
      .waitFor({ state: "visible", timeout: 10000 });
    assert.equal(JSON.parse(await page.evaluate(key => localStorage.getItem(key), SHOPPING))[0].purchaseAmountConfirmed, true);
    evidence.checks.push("guest-shopping-toggle-failed-storage-keeps-unchecked-then-confirmed-retry-persists");
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runGuestDerivedWriteWarningCannotBeCleared(faultKey) {
  // #459: an unrelated successful shopping-cache write must not erase the
  // evidence that a recipe or meal plan write was silently dropped.
  const SHOPPING = "balkanbite_shopping";
  const recipe = {
    id: "qa-derived-latch-rice",
    title: { en: "QA Rice Meal", es: "QA Arroz", bg: "QA Ориз" },
    description: { en: "QA", es: "QA", bg: "QA" },
    prepTimeMin: 0, cookTimeMin: 0, costPerServingEUR: 0,
    difficulty: "easy", servings: 1, calories: 0, proteinG: 0,
    carbsG: 0, fatG: 0, fiberG: 0, tags: [],
    ingredients: [{ name: "QA Rice", amount: 520, unit: "g", inPantry: false }],
    instructions: { en: ["QA cook"], es: ["QA cocinar"], bg: ["QA готви"] },
    nutritionHighlights: { en: "QA", es: "QA", bg: "QA" },
  };
  const plan = [{ date: new Date().toLocaleDateString("en-CA"), lunch: recipe }];
  const shopping = [{ id: "qa-latch-manual", name: "QA Salt", quantity: 1,
    unit: "ud", category: "Other", checked: false, amountOrigin: "user_entered",
    purchaseAmountConfirmed: false }];
  const context = await browser.newContext();
  let page;
  try {
    await context.addInitScript(({ MAIN, valid, plan, shopping }) => {
      if (sessionStorage.getItem("__qa_derived_latch_seeded")) return;
      sessionStorage.setItem("__qa_derived_latch_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([valid]));
      localStorage.setItem("balkanbite_recipes", JSON.stringify([plan[0].lunch]));
      localStorage.setItem("balkanbite_mealplan", JSON.stringify(plan));
      localStorage.setItem("balkanbite_shopping", JSON.stringify(shopping));
      localStorage.setItem("balkanbite_progression", "[]");
    }, { MAIN, valid, plan, shopping });
    page = await context.newPage();
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.locator("#nav-tab-pantry").click();
    await page.locator(`#pantry-item-${valid.id}`).waitFor({ state: "visible" });
    const originalDerivedRaw = await page.evaluate(key =>
      localStorage.getItem(key), faultKey);
    await page.evaluate(key => {
      const original = Storage.prototype.setItem;
      window.__qaDerivedWriteAttempts = 0;
      window.__qaRestoreStorageWrite = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = function(name, value) {
        if (name === key) {
          window.__qaDerivedWriteAttempts++;
          return; // browser silently discards just this write
        }
        return original.call(this, name, value);
      };
    }, faultKey);
    await page.locator(`#pantry-item-${valid.id}`).getByRole("button", {
      name: "Increase quantity",
    }).click();
    await page.waitForFunction(MAIN =>
      JSON.parse(localStorage.getItem(MAIN) || "[]")[0]?.quantity === 550, MAIN,
    );
    await page.waitForFunction(() => window.__qaDerivedWriteAttempts > 0);
    await page.getByTestId("guest-shopping-consistency-warning")
      .waitFor({ state: "visible", timeout: 15000 });
    assert.equal(await page.evaluate(key => localStorage.getItem(key), faultKey),
      originalDerivedRaw, "injected lost derived write must not overwrite old source");

    // Restore the browser storage and trigger a fully successful, but
    // UNRELATED, manual shopping checkbox write. A previous bug would clear
    // the warning, falsely treating shopping readback as a recovered menu.
    await page.evaluate(() => window.__qaRestoreStorageWrite());
    await page.locator("#nav-tab-shopping").click();
    await page.locator("#shopping-item-qa-latch-manual")
      .getByRole("button", { name: /Confirm purchase of/ }).click();
    await page.waitForFunction(SHOPPING =>
      JSON.parse(localStorage.getItem(SHOPPING) || "[]")[0]?.checked === true,
      SHOPPING,
    );
    await page.getByTestId("guest-shopping-consistency-warning")
      .waitFor({ state: "visible", timeout: 15000 });
    assert.equal(await page.getByTestId("guest-shopping-consistency-warning").count(), 1,
      "shopping success must not erase the unrelated failed derived-write warning");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), faultKey),
      originalDerivedRaw, "shopping checkbox write cannot fix lost meal/recipe bytes");
    evidence.checks.push(`guest-derived-${faultKey}-write-failure-stays-blocked-after-shopping-success`);
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runRealQuantityJournalCommit({ silentShoppingFailure = false } = {}) {
  // Real UI quantity edit, not an artificially seeded journal: capture a
  // newly-created WAL marker before the stock write and verify reload.
  const JOURNAL = "balkanbite_guest_pantry_shopping_journal_v1";
  const SHOPPING = "balkanbite_shopping";
  const planDay = new Date().toLocaleDateString("en-CA");
  const plannedRecipe = {
    id: "qa-journal-live-plan",
    title: { en: "QA rice planned", es: "QA arroz", bg: "QA ориз" },
    description: { en: "QA only", es: "QA prueba", bg: "QA тест" },
    prepTimeMin: 0, cookTimeMin: 0, costPerServingEUR: 0, difficulty: "easy",
    servings: 1, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0,
    nutritionDataStatus: "estimated", costDataStatus: "estimated", tags: [],
    ingredients: [{ name: "QA Rice", amount: 620, unit: "g", inPantry: false }],
    instructions: { en: ["QA step"], es: ["QA paso"], bg: ["QA стъпка"] },
    nutritionHighlights: { en: "QA only", es: "QA", bg: "QA" },
  };
  const manual = {
    id: "qa-live-manual-item", name: "QA manual milk", quantity: 1, unit: "l",
    category: "Dairy", checked: false, amountOrigin: "user_entered",
    purchaseAmountConfirmed: false,
  };
  const hashSource = "qa rice::mass";
  let hash = 2166136261;
  for (const char of hashSource) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const managedId = `shortage-v1:${(hash >>> 0).toString(36)}`;
  const managed = {
    id: managedId, name: "QA Rice", quantity: 120, unit: "g", category: "Other",
    checked: false, amountOrigin: "deterministic_shortfall",
    purchaseAmountConfirmed: false,
    reason: "For QA rice planned (Today)",
  };
  const context = await browser.newContext();
  let page;
  try {
    await context.addInitScript(({ MAIN, SHOPPING, valid, plannedRecipe, planDay, manual, managed }) => {
      if (sessionStorage.getItem("__qa_live_journal_seeded")) return;
      sessionStorage.setItem("__qa_live_journal_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([valid]));
      localStorage.setItem("balkanbite_recipes", "[]");
      localStorage.setItem("balkanbite_mealplan", JSON.stringify([
        { date: planDay, lunch: plannedRecipe },
      ]));
      localStorage.setItem(SHOPPING, JSON.stringify([manual, managed]));
    }, { MAIN, SHOPPING, valid, plannedRecipe, planDay, manual, managed });
    page = await context.newPage();
    page.on("dialog", d => d.dismiss());
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.locator("#nav-tab-pantry").click();
    await page.locator(`#pantry-item-${valid.id}`).waitFor({ state: "visible" });
    await page.evaluate(({ JOURNAL, SHOPPING, silentShoppingFailure }) => {
      const native = Storage.prototype.setItem;
      window.__qaWALStages = 0;
      window.__qaLiveShoppingFailures = 0;
      Storage.prototype.setItem = function(key, value) {
        if (key === JOURNAL) window.__qaWALStages++;
        if (key === SHOPPING && silentShoppingFailure) {
          window.__qaLiveShoppingFailures++;
          return;
        }
        return native.call(this, key, value);
      };
    }, { JOURNAL, SHOPPING, silentShoppingFailure });
    await page.locator(`#pantry-item-${valid.id}`).getByRole("button", {
      name: "Increase quantity",
    }).click();
    await page.waitForFunction(() => window.__qaWALStages > 0, null, {
      timeout: 12000,
    });
    await page.waitForFunction(MAIN => JSON.parse(localStorage.getItem(MAIN))[0].quantity === 550,
      MAIN, { timeout: 12000 });
    if (silentShoppingFailure) {
      await page.getByTestId("guest-journal-recovery-warning")
        .waitFor({ state: "visible", timeout: 12000 });
      assert.equal(await page.evaluate(({ JOURNAL }) => localStorage.getItem(JOURNAL) !== null,
        { JOURNAL }), true, "failed shopping write must preserve WAL");
      assert.equal(await page.evaluate(({ SHOPPING, managedId }) =>
        JSON.parse(localStorage.getItem(SHOPPING))
          .find(x => x.id === managedId)?.quantity,
        { SHOPPING, managedId }), 120, "do not claim 70g shortage committed");
    } else {
      assert.equal(await page.evaluate(JOURNAL => localStorage.getItem(JOURNAL), JOURNAL),
        null, "successful operation must clean WAL");
    }
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(({ MAIN, SHOPPING, JOURNAL, managedId }) => {
      const stock = JSON.parse(localStorage.getItem(MAIN) || "[]");
      const items = JSON.parse(localStorage.getItem(SHOPPING) || "[]");
      const shortage = items.find(item => item.id === managedId);
      return stock.length === 1 && stock[0].quantity === 550 &&
        shortage?.quantity === 70 && localStorage.getItem(JOURNAL) === null;
    }, { MAIN, SHOPPING, JOURNAL, managedId }, { timeout: 15000 });
    const list = JSON.parse(await page.evaluate(SHOPPING => localStorage.getItem(SHOPPING), SHOPPING));
    assert.deepEqual(list.find(x => x.id === manual.id), manual,
      "manually-entered shopping data must not change");
    assert.equal(list.find(x => x.id === managedId)?.quantity, 70);
    evidence.checks.push(silentShoppingFailure
      ? "real-ui-quantity-journal-replays-after-shopping-write-failure"
      : "real-ui-quantity-journal-commits-derived-shortfall");
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runRealGuestVoiceRemoval({ fault = null, purpose = "food-use" } = {}) {
  const INTENT = "balkanbite_guest_voice_removal_intent_v1";
  const RECEIPTS = "balkanbite_guest_voice_removal_receipts_v1";
  const RECIPES = "balkanbite_recipes";
  const PLAN = "balkanbite_mealplan";
  const SHOPPING = "balkanbite_shopping";
  const recipe = {
    id: "qa-voice-rice", title: { en: "QA Rice", es: "Arroz QA", bg: "Ориз QA" },
    description: { en: "QA", es: "QA", bg: "QA" },
    prepTimeMin: 0, cookTimeMin: 0, costPerServingEUR: 0,
    difficulty: "easy", servings: 1, calories: 0, proteinG: 0,
    carbsG: 0, fatG: 0, fiberG: 0, tags: [], imageUrl: "/images/qa-rice.png",
    ingredients: [{ name: "QA Rice", amount: 100, unit: "g", inPantry: true }],
    instructions: { en: ["Cook"], es: ["Cocinar"], bg: ["Готви"] },
    nutritionHighlights: { en: "QA", es: "QA", bg: "QA" },
  };
  const manual = {
    id: "qa-voice-manual-salt", name: "QA salt", quantity: 1, unit: "kg",
    checked: false, category: "Other", amountOrigin: "user_entered",
    purchaseAmountConfirmed: false,
  };
  const context = await browser.newContext();
  let page;
  try {
    await context.addInitScript(({ MAIN, RECIPES, PLAN, SHOPPING, RECEIPTS,
      recipe, manual, valid }) => {
      if (sessionStorage.getItem("__qa_guest_voice_removal_seeded")) return;
      sessionStorage.setItem("__qa_guest_voice_removal_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([{ ...valid, quantity: 150 }]));
      localStorage.setItem(RECIPES, JSON.stringify([recipe]));
      localStorage.setItem(PLAN, "[]");
      localStorage.setItem(SHOPPING, JSON.stringify([manual]));
      localStorage.setItem(RECEIPTS, "[]");
      localStorage.setItem("balkanbite_progression", "[]");
    }, { MAIN, RECIPES, PLAN, SHOPPING, RECEIPTS, recipe, manual, valid });
    await context.route("**/api/ai/parse-intent", route => route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ actionType: "ANSWER", message: "QA controlled answer" }),
    }));
    page = await context.newPage();
    page.on("dialog", dialog => dialog.dismiss());
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    // Voice is reached via the floating Chef IA modal, not bottom navigation.
    await page.locator("#chef-ia-floating-btn").click();
    await page.locator("#chef-ia-modal-panel").waitFor({
      state: "visible", timeout: 15000,
    });
    await page.locator("#voice-text-input").fill(purpose === "discard"
      ? "I threw away 100 g QA Rice"
      : "I used 100 g QA Rice");
    await page.locator("#voice-send-btn").click();
    await page.getByRole("button", { name: "Confirm", exact: true })
      .waitFor({ state: "visible", timeout: 15000 });
    await page.evaluate(({ INTENT, fault }) => {
      const original = Storage.prototype.setItem;
      window.__qaVoiceIntentStages = 0;
      Storage.prototype.setItem = function(key, value) {
        if (key === INTENT) window.__qaVoiceIntentStages++;
        if (window.__qaVoiceIntentStages > 0 && key === fault) return;
        return original.call(this, key, value);
      };
    }, { INTENT, fault });
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await page.waitForFunction(() => window.__qaVoiceIntentStages > 0, null,
      { timeout: 15000 });
    await page.waitForFunction(MAIN =>
      JSON.parse(localStorage.getItem(MAIN) || "[]")?.[0]?.quantity === 50,
      MAIN, { timeout: 15000 });
    if (fault) {
      await page.getByTestId("guest-journal-recovery-warning")
        .waitFor({ state: "visible", timeout: 15000 });
      assert.equal(await page.evaluate(INTENT => localStorage.getItem(INTENT) !== null, INTENT),
        true, "incomplete voice removal retains a durable intent");
      assert.deepEqual(await page.evaluate(RECEIPTS =>
        JSON.parse(localStorage.getItem(RECEIPTS) || "[]"), RECEIPTS), []);
    } else {
      assert.equal(await page.evaluate(INTENT => localStorage.getItem(INTENT), INTENT), null);
    }
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(({ MAIN, INTENT, RECEIPTS, SHOPPING, PLAN }) => {
      const stock = JSON.parse(localStorage.getItem(MAIN) || "[]");
      const receipts = JSON.parse(localStorage.getItem(RECEIPTS) || "[]");
      const shopping = JSON.parse(localStorage.getItem(SHOPPING) || "[]");
      const plan = JSON.parse(localStorage.getItem(PLAN) || "[]");
      return localStorage.getItem(INTENT) === null &&
        stock.length === 1 && stock[0].quantity === 50 &&
        receipts.length === 1 && receipts[0].mutationId.startsWith("voice-") &&
        shopping.some(row => row.id === "qa-voice-manual-salt" && row.quantity === 1) &&
        plan.length === 7;
    }, { MAIN, INTENT, RECEIPTS, SHOPPING, PLAN }, { timeout: 16000 });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    const final = await page.evaluate(({ MAIN, RECEIPTS, SHOPPING }) => ({
      stock: JSON.parse(localStorage.getItem(MAIN) || "[]"),
      receipts: JSON.parse(localStorage.getItem(RECEIPTS) || "[]"),
      shopping: JSON.parse(localStorage.getItem(SHOPPING) || "[]"),
      progress: JSON.parse(localStorage.getItem("balkanbite_progression") || "[]"),
    }), { MAIN, RECEIPTS, SHOPPING });
    assert.equal(final.stock[0].quantity, 50,
      "reload must not re-deduct voice-confirmed items");
    assert.equal(final.receipts.length, 1, "one and only one durable voice receipt");
    assert.equal(final.receipts[0].purpose, purpose);
    assert.deepEqual(final.receipts[0].items,
      [{ name: "QA Rice", quantity: 100, unit: "g" }]);
    assert.deepEqual(final.shopping.filter(row => row.id === manual.id), [manual]);
    assert.deepEqual(final.progress, [],
      "voice removal and discard do not invent a meal or recipe-cook progression event");
    evidence.checks.push(fault
      ? `real-ui-voice-${purpose}-silent-${fault}-replay-once`
      : `real-ui-voice-${purpose}-durable-once`);
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runGuestLocalExportDownload() {
  const context = await browser.newContext({ acceptDownloads: true });
  let page;
  try {
    await context.addInitScript(({ MAIN, valid, receipts }) => {
      if (sessionStorage.getItem("__qa_guest_export_seeded")) return;
      sessionStorage.setItem("__qa_guest_export_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "bg", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([valid]));
      localStorage.setItem("balkanbite_shopping", "[]");
      localStorage.setItem("balkanbite_progression", "[]");
      localStorage.setItem("balkanbite_guest_voice_removal_receipts_v1", receipts);
      localStorage.setItem("qa-auth-token-do-not-export", "private synthetic sentinel");
    }, { MAIN, valid, receipts: JSON.stringify([{ version: 1, mutationId: "qa-export-01", purpose: "food-use", items: [{ name: "QA Rice", quantity: 10, unit: "g" }] }]) });
    page = await context.newPage();
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.locator("#header-profile-btn").click();
    const exportButton = page.getByTestId("guest-local-export-button");
    await exportButton.waitFor({ state: "visible", timeout: 12000 });
    await page.getByText("Копие на локалните данни").waitFor({ state: "visible" });
    const before = await page.evaluate(() => ({
      pantry: localStorage.getItem("balkanbite_pantry"),
      shopping: localStorage.getItem("balkanbite_shopping"),
      profile: localStorage.getItem("balkanbite_profile"),
      progress: localStorage.getItem("balkanbite_progression"),
      voiceReceipts: localStorage.getItem("balkanbite_guest_voice_removal_receipts_v1"),
    }));
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      exportButton.click(),
    ]);
    assert.equal(download.suggestedFilename(), "balkanbite-guest-local-data.json");
    const rawFile = await fs.readFile(await download.path(), "utf8");
    const archive = JSON.parse(rawFile);
    assert.equal(archive.format, "balkanbite-guest-raw-export");
    assert.equal(archive.version, 1);
    assert.equal(archive.scope, "guest-local-only");
    assert.equal(archive.restoreSupported, false);
    assert.equal(archive.consistency, "best-effort-not-atomic-across-tabs");
    assert.equal(archive.values.balkanbite_pantry, before.pantry);
    assert.equal(archive.values.balkanbite_shopping, before.shopping);
    assert.equal(archive.values.balkanbite_profile, before.profile);
    assert.equal(archive.values.balkanbite_progression, before.progress);
    assert.equal(archive.values.balkanbite_guest_voice_removal_receipts_v1, before.voiceReceipts);
    assert.equal(rawFile.includes("private synthetic sentinel"), false,
      "unknown browser secrets must never be included in the guest archive");
    const picker = page.getByTestId("guest-local-export-inspect-input");
    await picker.setInputFiles({
      name: "qa-guest-export.json", mimeType: "application/json",
      buffer: Buffer.from(rawFile, "utf8"),
    });
    const outcome = page.getByTestId("guest-local-export-inspect-result");
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="guest-local-export-inspect-result"]')
        ?.textContent?.includes("Структурата е разпозната."),
      { timeout: 10000 });
    await picker.setInputFiles({
      name: "qa-broken-export.json", mimeType: "application/json",
      buffer: Buffer.from('{"format":"unexpected","values":{}}', "utf8"),
    });
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="guest-local-export-inspect-result"]')
        ?.textContent?.includes("Форматът не е разпознат."),
      { timeout: 10000 });
    assert.ok(await outcome.isVisible());
    const after = await page.evaluate(() => ({
      pantry: localStorage.getItem("balkanbite_pantry"),
      shopping: localStorage.getItem("balkanbite_shopping"),
      profile: localStorage.getItem("balkanbite_profile"),
      progress: localStorage.getItem("balkanbite_progression"),
      voiceReceipts: localStorage.getItem("balkanbite_guest_voice_removal_receipts_v1"),
    }));
    assert.deepEqual(after, before, "download must not modify application data");
    evidence.checks.push("guest-profile-bg-explicit-local-export-includes-voice-receipts");
    evidence.checks.push("guest-export-local-format-check-no-import-or-storage-change");
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runGuestMealToPurchaseCircuit({ language = "en", mobile = false, mobileWidth = 390 } = {}) {
  const mobileSize = { width: mobileWidth, height: 844 };
  const checkMobileButton = async (button, label) => {
    if (!mobile) return;
    await button.scrollIntoViewIfNeeded();
    const bounds = await button.boundingBox();
    assert.ok(bounds, `${label}: accessible interactive control must have bounds`);
    assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= mobileSize.width + 1,
      `${label}: interactive control should fit ${mobileWidth}px mobile viewport, got ${JSON.stringify(bounds)}`);
  };
  // Desktop EN or compact touch/mobile BG: manual stock entry + recorded lunch,
  // confirm cooking, surface a measured shortage, confirm shopping amount,
  // transfer the purchase to pantry and verify recovery after reload.
  // Synthetic values are fixture-only, never inferred user diet facts.
  const SHOPPING = "balkanbite_shopping";
  const RECIPES = "balkanbite_recipes";
  const PLAN = "balkanbite_mealplan";
  const PROGRESS = "balkanbite_progression";
  const riceRecipe = {
    id: "qa-circuit-rice", title: { en: "QA Circuit Rice", es: "Arroz circuito QA", bg: "QA Ориз" },
    description: { en: "Fixture only", es: "Solo prueba", bg: "Само тест" },
    prepTimeMin: 0, cookTimeMin: 0, costPerServingEUR: 0,
    difficulty: "easy", servings: 1, calories: 0,
    proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0,
    tags: [], imageUrl: "/images/qa-rice.png",
    ingredients: [{ name: "QA Rice", amount: 100, unit: "g", inPantry: true }],
    instructions: { en: ["Cook"], es: ["Cocinar"], bg: ["Готви"] },
    nutritionHighlights: { en: "Fixture", es: "Prueba", bg: "Тест" },
  };
  const context = await browser.newContext(mobile
    ? { viewport: mobileSize, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
        locale: "bg-BG" }
    : {});
  let page;
  try {
    await context.addInitScript(({ MAIN, SHOPPING, RECIPES, PLAN, PROGRESS, riceRecipe, language }) => {
      if (sessionStorage.getItem("__qa_full_guest_cycle_seeded")) return;
      sessionStorage.setItem("__qa_full_guest_cycle_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language, onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, "[]");
      localStorage.setItem(RECIPES, JSON.stringify([riceRecipe]));
      const date = new Date();
      const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")].join("-");
      localStorage.setItem(PLAN, JSON.stringify([{ date: day, lunch: riceRecipe }]));
      localStorage.setItem(SHOPPING, "[]");
      localStorage.setItem(PROGRESS, "[]");
    }, { MAIN, SHOPPING, RECIPES, PLAN, PROGRESS, riceRecipe, language });
    page = await context.newPage();
    page.on("dialog", dialog => dialog.dismiss());
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    // First create stock using the REAL pantry form rather than injecting a
    // fictional inventory record. Optional price and expiry stay unknown.
    await page.locator("#nav-tab-pantry").click();
    await checkMobileButton(page.locator("#pantry-add-item-btn"), "pantry add");
    await page.locator("#pantry-add-item-btn").click();
    await page.locator("#pantry-item-name").fill("QA Rice");
    await page.locator("#pantry-quantity").fill("150");
    await page.locator("#pantry-view form select").first().selectOption("g");
    await page.locator("#pantry-category").selectOption("Pantry/Grains");
    await checkMobileButton(page.locator("#pantry-view form button[type=submit]"), "pantry save");
    await page.locator("#pantry-view form button[type=submit]").click();
    await page.waitForFunction(MAIN =>
      JSON.parse(localStorage.getItem(MAIN) || "[]")
        .some(row => row.name === "QA Rice" && row.quantity === 150 && row.unit === "g"),
      MAIN, { timeout: 16000 });
    const before = await page.evaluate(({ MAIN, PLAN }) => ({
      pantry: JSON.parse(localStorage.getItem(MAIN) || "[]"),
      plan: JSON.parse(localStorage.getItem(PLAN) || "[]"),
    }), { MAIN, PLAN });
    assert.equal(before.pantry.filter(row => row.name === "QA Rice").length, 1);
    assert.equal(before.pantry[0].quantity, 150);
    assert.equal(before.pantry[0].estimatedCostEUR, undefined,
      "manual stock creation cannot invent an acquisition cost");
    assert.ok(before.plan.some(day =>
      [day.breakfast, day.lunch, day.dinner].some(meal => meal?.id === riceRecipe.id)),
      "recorded menu should retain the user's planned recipe after adding stock");
    evidence.checks.push("guest-cycle-real-manual-pantry-entry-and-planned-recipe");
    await page.locator("#nav-tab-recipes").click();
    const cookButton = page.locator("#cook-btn-qa-circuit-rice");
    await cookButton.waitFor({ state: "visible", timeout: 15000 });
    await checkMobileButton(cookButton, "cook recipe");
    await cookButton.click();
    await page.getByText(language === "bg" ? "Сготви ли тази рецепта?" : "Have you cooked this recipe?")
      .waitFor({ state: "visible", timeout: 10000 });
    const confirmCook = page.getByRole("button", {
      name: language === "bg" ? "Да, приспадни" : "Yes, deduct",
    });
    await checkMobileButton(confirmCook, "confirm cooking");
    await confirmCook.click();
    await page.waitForFunction(MAIN =>
      JSON.parse(localStorage.getItem(MAIN) || "[]")
        .find(item => item.name === "QA Rice")?.quantity === 50,
      MAIN, { timeout: 16000 });
    await page.waitForFunction(PROGRESS =>
      JSON.parse(localStorage.getItem(PROGRESS) || "[]")
        .some(event => event.type === "recipe_cook_inventory_applied"),
      PROGRESS, { timeout: 16000 });
    evidence.checks.push("guest-cycle-recorded-plan-to-confirmed-cook-and-100g-deduction");

    // A journalled cook can reconcile a managed shortage automatically.
    // Otherwise the user must be able to add the measured missing quantity
    // from the recipe card. Both routes feed the same real shopping UI.
    let shortage = await page.evaluate(SHOPPING =>
      JSON.parse(localStorage.getItem(SHOPPING) || "[]")
        .filter(row => row.name === "QA Rice" && !row.checked),
      SHOPPING);
    let shortageOrigin = "derived";
    if (shortage.length === 0) {
      shortageOrigin = "recipe-action";
      const addMissing = page.locator("#add-missing-btn-qa-circuit-rice");
      await addMissing.waitFor({ state: "visible", timeout: 12000 });
      await checkMobileButton(addMissing, "add missing ingredients");
      await addMissing.click();
    }
    await page.waitForFunction(SHOPPING =>
      JSON.parse(localStorage.getItem(SHOPPING) || "[]")
        .some(row => row.name === "QA Rice" && !row.checked &&
          row.quantity > 0 && row.unit === "g"),
      SHOPPING, { timeout: 12000 });
    shortage = await page.evaluate(SHOPPING =>
      JSON.parse(localStorage.getItem(SHOPPING) || "[]")
        .filter(row => row.name === "QA Rice" && !row.checked),
      SHOPPING);
    assert.ok(shortage.length > 0);
    const selected = shortage[0];
    assert.ok(Number.isFinite(selected.quantity) && selected.quantity > 0);
    assert.equal(selected.unit, "g");
    assert.equal(selected.purchaseAmountConfirmed, false,
      "shortage suggestion cannot claim a completed purchase");
    assert.equal(selected.estimatedPriceEUR, undefined,
      "no unverified price may be converted to fact");
    evidence.checks.push("guest-cycle-shortage-to-shopping-" + shortageOrigin);

    await page.locator("#nav-tab-shopping").click();
    const row = page.locator(`[id=${JSON.stringify("shopping-item-" + selected.id)}]`);
    await row.waitFor({ state: "visible", timeout: 12000 });
    const purchaseButton = row.getByRole("button", {
      name: language === "bg" ? /Потвърди покупката на/ : /Confirm purchase of/,
    });
    await checkMobileButton(purchaseButton, "confirm purchased amount");
    await purchaseButton.click();
    await page.waitForFunction(({ SHOPPING, id }) =>
      JSON.parse(localStorage.getItem(SHOPPING) || "[]")
        .some(row => row.id === id && row.checked === true &&
          row.purchaseAmountConfirmed === true),
      { SHOPPING, id: selected.id }, { timeout: 12000 });
    await checkMobileButton(page.locator("#transfer-to-pantry-btn"), "restock pantry");
    await page.locator("#transfer-to-pantry-btn").click();
    await page.waitForFunction(({ MAIN, SHOPPING, PROGRESS, id, amount }) => {
      const pantry = JSON.parse(localStorage.getItem(MAIN) || "[]");
      const shopping = JSON.parse(localStorage.getItem(SHOPPING) || "[]");
      const events = JSON.parse(localStorage.getItem(PROGRESS) || "[]");
      return pantry.filter(row => row.name === "QA Rice" && row.unit === "g")
          .reduce((sum, row) => sum + row.quantity, 0) === 50 + amount &&
        !shopping.some(row => row.id === id) &&
        events.some(event => event.eventId === `purchase:shopping:${id}`);
    }, { MAIN, SHOPPING, PROGRESS, id: selected.id, amount: selected.quantity },
    { timeout: 16000 });

    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("#nav-tab-pantry").click();
    await page.locator("#pantry-view").waitFor({ state: "visible" });
    const final = await page.evaluate(({ MAIN, SHOPPING, RECIPES, PLAN, PROGRESS }) => ({
      pantry: JSON.parse(localStorage.getItem(MAIN) || "[]"),
      shopping: JSON.parse(localStorage.getItem(SHOPPING) || "[]"),
      recipes: JSON.parse(localStorage.getItem(RECIPES) || "[]"),
      plan: JSON.parse(localStorage.getItem(PLAN) || "[]"),
      events: JSON.parse(localStorage.getItem(PROGRESS) || "[]"),
      pending: [
        "balkanbite_guest_cook_derived_intent_v1",
        "balkanbite_guest_cook_intent_v1",
        "balkanbite_guest_purchase_intent_v1",
        "balkanbite_guest_pantry_shopping_journal_v1",
      ].filter(key => localStorage.getItem(key) !== null),
    }), { MAIN, SHOPPING, RECIPES, PLAN, PROGRESS });
    assert.equal(final.pantry.filter(row => row.name === "QA Rice" && row.unit === "g")
      .reduce((sum, row) => sum + row.quantity, 0), 50 + selected.quantity,
    "exact confirmed purchase should replenish only its recorded amount");
    assert.ok(final.recipes.some(row => row.id === riceRecipe.id),
      "recipe must survive cooking and purchase");
    assert.ok(final.plan.length > 0, "menu must remain recorded after the purchase");
    assert.equal(final.shopping.some(row => row.id === selected.id), false);
    assert.equal(final.events.filter(event => event.type === "recipe_cook_inventory_applied").length, 1);
    assert.equal(final.events.filter(event => event.eventId ===
      `purchase:shopping:${selected.id}`).length, 1);
    assert.deepEqual(final.pending, [], "completed cycle must not leave stranded local intent");
    evidence.checks.push(mobile
      ? "guest-mobile-bg-cycle-390px-touch-layout-manual-pantry-cook-shortage-purchase-reload"
      : "guest-cycle-purchase-restocks-exact-amount-once-after-reload");
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runRealGuestDerivedCook({ fault = null } = {}) {
  const INTENT = "balkanbite_guest_cook_derived_intent_v1";
  const RECIPES = "balkanbite_recipes";
  const PLAN = "balkanbite_mealplan";
  const SHOPPING = "balkanbite_shopping";
  const PROGRESSION = "balkanbite_progression";
  const recipe = {
    id: "qa-derived-rice", title: { en: "QA Rice", es: "Arroz QA", bg: "Ориз QA" },
    description: { en: "QA", es: "QA", bg: "QA" },
    prepTimeMin: 0, cookTimeMin: 0, costPerServingEUR: 0,
    difficulty: "easy", servings: 1, calories: 0, proteinG: 0,
    carbsG: 0, fatG: 0, fiberG: 0, tags: [], imageUrl: "/images/qa-rice.png",
    ingredients: [{ name: "QA Rice", amount: 100, unit: "g", inPantry: true }],
    instructions: { en: ["Cook"], es: ["Cocinar"], bg: ["Готви"] },
    nutritionHighlights: { en: "QA", es: "QA", bg: "QA" },
  };
  const manual = {
    id: "qa-manual-salt", name: "QA salt", quantity: 1, unit: "kg",
    checked: false, category: "Other", amountOrigin: "user_entered",
    purchaseAmountConfirmed: false,
  };
  const context = await browser.newContext();
  let page;
  try {
    await context.addInitScript(({ MAIN, RECIPES, PLAN, SHOPPING, PROGRESSION,
      recipe, manual, valid }) => {
      if (sessionStorage.getItem("__qa_guest_derived_cook_seeded")) return;
      sessionStorage.setItem("__qa_guest_derived_cook_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([{ ...valid, quantity: 150 }]));
      localStorage.setItem(RECIPES, JSON.stringify([recipe]));
      localStorage.setItem(PLAN, "[]");
      localStorage.setItem(SHOPPING, JSON.stringify([manual]));
      localStorage.setItem(PROGRESSION, "[]");
    }, { MAIN, RECIPES, PLAN, SHOPPING, PROGRESSION, recipe, manual, valid });
    page = await context.newPage();
    page.on("dialog", dialog => dialog.dismiss());
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.locator("#nav-tab-recipes").click();
    await page.locator("#cook-btn-qa-derived-rice")
      .waitFor({ state: "visible", timeout: 15000 });
    await page.locator("#cook-btn-qa-derived-rice").click();
    await page.getByText("Have you cooked this recipe?")
      .waitFor({ state: "visible" });
    await page.evaluate(({ INTENT, fault }) => {
      const original = Storage.prototype.setItem;
      window.__qaDerivedStages = 0;
      Storage.prototype.setItem = function(key, value) {
        if (key === INTENT) window.__qaDerivedStages++;
        if (window.__qaDerivedStages > 0 && key === fault) return;
        return original.call(this, key, value);
      };
    }, { INTENT, fault });
    await page.getByRole("button", { name: "Yes, deduct" }).click();
    await page.waitForFunction(() => window.__qaDerivedStages > 0, null,
      { timeout: 15000 });
    await page.waitForFunction(MAIN =>
      JSON.parse(localStorage.getItem(MAIN) || "[]")?.[0]?.quantity === 50,
      MAIN, { timeout: 15000 });
    if (fault !== null) {
      await page.getByTestId("guest-journal-recovery-warning")
        .waitFor({ state: "visible", timeout: 12000 });
      assert.equal(await page.evaluate(INTENT => localStorage.getItem(INTENT) !== null, INTENT),
        true, "partial multi-key cook retains its durable intent");
      assert.deepEqual(await page.evaluate(() =>
        JSON.parse(localStorage.getItem("balkanbite_progression") || "[]")), [],
        "failed derived step cannot manufacture cook progression");
    } else {
      assert.equal(await page.evaluate(INTENT => localStorage.getItem(INTENT), INTENT),
        null, "successful multi-key cook clears intent");
    }
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(({ INTENT, MAIN, RECIPES, PLAN, SHOPPING, PROGRESSION }) => {
      const stock = JSON.parse(localStorage.getItem(MAIN) || "[]");
      const recipes = JSON.parse(localStorage.getItem(RECIPES) || "[]");
      const plan = JSON.parse(localStorage.getItem(PLAN) || "[]");
      const shopping = JSON.parse(localStorage.getItem(SHOPPING) || "[]");
      const events = JSON.parse(localStorage.getItem(PROGRESSION) || "[]");
      return localStorage.getItem(INTENT) === null &&
        stock.length === 1 && stock[0].quantity === 50 &&
        recipes.length === 1 && recipes[0].ingredients[0].inPantry === false &&
        plan.length === 7 &&
        shopping.some(row => row.id === "qa-manual-salt" && row.quantity === 1) &&
        events.length === 1 && events[0].eventId.startsWith("cook:cook-");
    }, { INTENT, MAIN, RECIPES, PLAN, SHOPPING, PROGRESSION },
    { timeout: 15000 });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    const state = await page.evaluate(({ MAIN, SHOPPING, PROGRESSION }) => ({
      pantry: JSON.parse(localStorage.getItem(MAIN) || "[]"),
      shopping: JSON.parse(localStorage.getItem(SHOPPING) || "[]"),
      progression: JSON.parse(localStorage.getItem(PROGRESSION) || "[]"),
    }), { MAIN, SHOPPING, PROGRESSION });
    assert.equal(state.pantry[0].quantity, 50,
      "retry/reload must not consume 100g twice");
    assert.equal(state.progression.length, 1);
    assert.deepEqual(state.shopping.filter(row => row.id === manual.id), [manual],
      "user-entered shopping remains untouched");
    evidence.checks.push(fault
      ? `real-ui-derived-cook-${fault}-silent-fault-recovers-prefix`
      : "real-ui-derived-cook-five-key-commit");
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runRealGuestCookIntent({ silentProgressionFailure = false } = {}) {
  const INTENT = "balkanbite_guest_cook_intent_v1";
  const PROGRESSION = "balkanbite_progression";
  const recipe = {
    id: "qa-cook-rice", title: { en: "QA Rice", es: "Arroz QA", bg: "Ориз QA" },
    description: { en: "QA", es: "QA", bg: "QA" },
    prepTimeMin: 0, cookTimeMin: 0, costPerServingEUR: 0,
    difficulty: "easy", servings: 1, calories: 0, proteinG: 0, carbsG: 0,
    fatG: 0, fiberG: 0, tags: [], imageUrl: "/images/qa-rice.png",
    ingredients: [{ name: "QA Rice", amount: 100, unit: "g", inPantry: true }],
    instructions: { en: ["Cook"], es: ["Cocinar"], bg: ["Готви"] },
    nutritionHighlights: { en: "QA", es: "QA", bg: "QA" },
  };
  const context = await browser.newContext();
  let page;
  try {
    await context.addInitScript(({ MAIN, PROGRESSION, recipe, valid }) => {
      if (sessionStorage.getItem("__qa_guest_cook_seeded")) return;
      sessionStorage.setItem("__qa_guest_cook_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([{ ...valid, quantity: 5000 }]));
      localStorage.setItem("balkanbite_recipes", JSON.stringify([recipe]));
      // Match the planner's existing seven-day projection exactly. Stock
      // remains above all 21 requirements after this 100 g deduction, so
      // cooking need not rewrite the meal plan or any shortage shopping.
      const today = new Date();
      const plan = Array.from({ length: 7 }, (_, offset) => {
        const day = new Date(today);
        day.setDate(today.getDate() + offset);
        const date = [day.getFullYear(), String(day.getMonth() + 1).padStart(2, "0"),
          String(day.getDate()).padStart(2, "0")].join("-");
        return { date, breakfast: recipe, lunch: recipe, dinner: recipe };
      });
      localStorage.setItem("balkanbite_mealplan", JSON.stringify(plan));
      localStorage.setItem("balkanbite_shopping", "[]");
      localStorage.setItem(PROGRESSION, "[]");
    }, { MAIN, PROGRESSION, recipe, valid });
    page = await context.newPage();
    page.on("dialog", dialog => dialog.dismiss());
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.locator("#nav-tab-recipes").click();
    await page.locator("#cook-btn-qa-cook-rice").waitFor({ state: "visible", timeout: 15000 });
    await page.locator("#cook-btn-qa-cook-rice").click();
    await page.getByText("Have you cooked this recipe?").waitFor({ state: "visible" });
    await page.evaluate(({ INTENT, PROGRESSION, silentProgressionFailure }) => {
      const native = Storage.prototype.setItem;
      window.__qaCookJournalStages = 0;
      Storage.prototype.setItem = function(key, value) {
        if (key === INTENT) window.__qaCookJournalStages++;
        if (key === PROGRESSION && silentProgressionFailure &&
            window.__qaCookJournalStages > 0) return;
        return native.call(this, key, value);
      };
    }, { INTENT, PROGRESSION, silentProgressionFailure });
    await page.getByRole("button", { name: "Yes, deduct" }).click();
    await page.waitForFunction(() => window.__qaCookJournalStages > 0, null, {
      timeout: 15000,
    });
    await page.waitForFunction(MAIN =>
      JSON.parse(localStorage.getItem(MAIN) || "[]")?.[0]?.quantity === 4900,
      MAIN, { timeout: 15000 },
    );
    if (silentProgressionFailure) {
      await page.getByTestId("guest-journal-recovery-warning").waitFor({
        state: "visible", timeout: 12000,
      });
      assert.equal(await page.evaluate(INTENT => localStorage.getItem(INTENT) !== null, INTENT),
        true, "uncommitted cook progression keeps exact WAL marker");
      assert.deepEqual(JSON.parse(await page.evaluate(
        PROGRESSION => localStorage.getItem(PROGRESSION), PROGRESSION,
      )), [], "failure must not pretend cook progression was saved");
    } else {
      assert.equal(await page.evaluate(INTENT => localStorage.getItem(INTENT), INTENT),
        null, "complete cook must clear journal marker");
    }
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(({ INTENT, MAIN, PROGRESSION }) => {
      const stock = JSON.parse(localStorage.getItem(MAIN) || "[]");
      const events = JSON.parse(localStorage.getItem(PROGRESSION) || "[]");
      return localStorage.getItem(INTENT) === null &&
        stock.length === 1 && stock[0].quantity === 4900 &&
        events.length === 1 &&
        events[0].type === "recipe_cook_inventory_applied" &&
        events[0].eventId.startsWith("cook:cook-") &&
        events[0].evidenceCount === 1;
    }, { INTENT, MAIN, PROGRESSION }, { timeout: 15000 });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    const final = await page.evaluate(({ MAIN, PROGRESSION, INTENT }) => ({
      stock: JSON.parse(localStorage.getItem(MAIN) || "[]"),
      events: JSON.parse(localStorage.getItem(PROGRESSION) || "[]"),
      marker: localStorage.getItem(INTENT),
    }), { MAIN, PROGRESSION, INTENT });
    assert.equal(final.stock[0].quantity, 4900);
    assert.equal(final.events.length, 1);
    assert.equal(final.marker, null);
    evidence.checks.push(silentProgressionFailure
      ? "real-ui-cook-silent-progression-failure-recovers-once"
      : "real-ui-cook-confirmation-journal-commits-once");
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runRealGuestPurchaseIntent({ fault = null } = {}) {
  const INTENT = "balkanbite_guest_purchase_intent_v1";
  const SHOPPING = "balkanbite_shopping";
  const PROGRESS = "balkanbite_progression";
  const confirmed = {
    id: "qa-confirmed-milk", name: "QA milk", quantity: 2, unit: "l",
    category: "Dairy", checked: true, amountOrigin: "user_entered",
    purchaseAmountConfirmed: true,
  };
  const manual = {
    id: "qa-other-manual", name: "QA lemons", quantity: 1, unit: "kg",
    category: "Produce", checked: false, amountOrigin: "user_entered",
    purchaseAmountConfirmed: false,
  };
  const originalShopping = JSON.stringify([confirmed, manual]);
  const context = await browser.newContext();
  let page;
  try {
    await context.addInitScript(({ MAIN, SHOPPING, PROGRESS, originalShopping }) => {
      if (sessionStorage.getItem("__qa_real_guest_purchase_seeded")) return;
      sessionStorage.setItem("__qa_real_guest_purchase_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, "[]");
      localStorage.setItem(SHOPPING, originalShopping);
      localStorage.setItem(PROGRESS, "[]");
      localStorage.setItem("balkanbite_recipes", "[]");
      localStorage.setItem("balkanbite_mealplan", "[]");
    }, { MAIN, SHOPPING, PROGRESS, originalShopping });
    page = await context.newPage();
    page.on("dialog", dialog => dialog.dismiss());
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.locator("#nav-tab-shopping").click();
    await page.locator("#shopping-item-qa-confirmed-milk")
      .waitFor({ state: "visible", timeout: 15000 });
    await page.locator("#transfer-to-pantry-btn").waitFor({ state: "visible" });
    await page.evaluate(({ INTENT, SHOPPING, PROGRESS, fault }) => {
      const native = Storage.prototype.setItem;
      window.__qaPurchaseStages = 0;
      Storage.prototype.setItem = function(key, value) {
        if (key === INTENT) window.__qaPurchaseStages++;
        if (window.__qaPurchaseStages > 0 && key === fault &&
          (fault === SHOPPING || fault === PROGRESS)) return;
        return native.call(this, key, value);
      };
    }, { INTENT, SHOPPING, PROGRESS, fault });
    await page.locator("#transfer-to-pantry-btn").click();
    await page.waitForFunction(() => window.__qaPurchaseStages > 0, null, {
      timeout: 15000,
    });
    await page.waitForFunction(MAIN => {
      const pantry = JSON.parse(localStorage.getItem(MAIN) || "[]");
      return pantry.length === 1 && pantry[0].quantity === 2 &&
        pantry[0].unit === "l" &&
        pantry[0].purchaseHistory?.[0]?.sourceId === "shopping:qa-confirmed-milk";
    }, MAIN, { timeout: 15000 });
    if (fault) {
      await page.getByTestId("guest-journal-recovery-warning")
        .waitFor({ state: "visible", timeout: 12000 });
      assert.equal(await page.evaluate(INTENT => localStorage.getItem(INTENT) !== null, INTENT),
        true, "incomplete purchase must retain a WAL marker");
      assert.deepEqual(JSON.parse(await page.evaluate(PROGRESS => localStorage.getItem(PROGRESS), PROGRESS)),
        [], "no progress must be claimed before its write succeeds");
      if (fault === SHOPPING) {
        assert.equal(await page.evaluate(SHOPPING => localStorage.getItem(SHOPPING), SHOPPING),
          originalShopping, "failed shopping write must retain original items");
      }
    } else {
      assert.equal(await page.evaluate(INTENT => localStorage.getItem(INTENT), INTENT),
        null, "completed purchase must clear its WAL marker");
    }
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(({ INTENT, MAIN, SHOPPING, PROGRESS }) => {
      const pantry = JSON.parse(localStorage.getItem(MAIN) || "[]");
      const shopping = JSON.parse(localStorage.getItem(SHOPPING) || "[]");
      const events = JSON.parse(localStorage.getItem(PROGRESS) || "[]");
      return localStorage.getItem(INTENT) === null &&
        pantry.length === 1 && pantry[0].quantity === 2 &&
        shopping.length === 1 && shopping[0].id === "qa-other-manual" &&
        events.length === 1 &&
        events[0].eventId === "purchase:shopping:qa-confirmed-milk";
    }, { INTENT, MAIN, SHOPPING, PROGRESS }, { timeout: 15000 });
    const after = await page.evaluate(({ MAIN, SHOPPING, PROGRESS }) => ({
      pantry: JSON.parse(localStorage.getItem(MAIN)),
      shopping: JSON.parse(localStorage.getItem(SHOPPING)),
      events: JSON.parse(localStorage.getItem(PROGRESS)),
    }), { MAIN, SHOPPING, PROGRESS });
    assert.equal(after.pantry[0].quantity, 2, "purchase may not be repeated on recovery");
    assert.deepEqual(after.shopping, [manual], "keep untouched manual list rows");
    assert.equal(after.events.length, 1, "idempotent progression evidence");
    evidence.checks.push(fault === SHOPPING
      ? "real-ui-purchase-shopping-fault-recovered-without-repeat"
      : fault === PROGRESS
        ? "real-ui-purchase-progression-fault-recovered-once"
        : "real-ui-confirmed-purchase-three-keys-committed");
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runCorruptedGuestPurchaseIntentAtStartup() {
  const PURCHASE_INTENT = "balkanbite_guest_purchase_intent_v1";
  const SHOPPING = "balkanbite_shopping";
  const PROGRESSION = "balkanbite_progression";
  const corruptedLedger = "[{historical unknown event";
  const rawIntent = "{unrecognized purchase intent";
  const manual = [{
    id: "qa-purchase-manual", name: "QA manual item",
    quantity: 1, unit: "ud", checked: false, category: "Other",
    amountOrigin: "user_entered", purchaseAmountConfirmed: false,
  }];
  const initialShopping = JSON.stringify(manual);
  const initialPantry = JSON.stringify([valid]);
  const context = await browser.newContext();
  let page;
  try {
    await context.addInitScript(({ MAIN, SHOPPING, PROGRESSION, PURCHASE_INTENT,
      initialPantry, initialShopping, corruptedLedger, rawIntent }) => {
      if (sessionStorage.getItem("__qa_guest_purchase_intent_seeded")) return;
      sessionStorage.setItem("__qa_guest_purchase_intent_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, initialPantry);
      localStorage.setItem(SHOPPING, initialShopping);
      localStorage.setItem(PROGRESSION, corruptedLedger);
      localStorage.setItem("balkanbite_recipes", "[]");
      localStorage.setItem("balkanbite_mealplan", "[]");
      localStorage.setItem(PURCHASE_INTENT, rawIntent);
    }, { MAIN, SHOPPING, PROGRESSION, PURCHASE_INTENT,
      initialPantry, initialShopping, corruptedLedger, rawIntent });
    page = await context.newPage();
    page.on("dialog", dialog => dialog.dismiss());
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.getByTestId("guest-journal-recovery-warning").waitFor({
      state: "visible", timeout: 15000,
    });
    const readAll = async () => page.evaluate(
      ({ MAIN, SHOPPING, PROGRESSION, PURCHASE_INTENT }) => ({
        pantry: localStorage.getItem(MAIN),
        shopping: localStorage.getItem(SHOPPING),
        progression: localStorage.getItem(PROGRESSION),
        intent: localStorage.getItem(PURCHASE_INTENT),
      }), { MAIN, SHOPPING, PROGRESSION, PURCHASE_INTENT },
    );
    assert.deepEqual(await readAll(), {
      pantry: initialPantry, shopping: initialShopping,
      progression: corruptedLedger, intent: rawIntent,
    }, "blocked purchase recovery must not rewrite historical keys");
    await page.locator("#nav-tab-pantry").click();
    await page.locator(`#pantry-item-${valid.id}`).waitFor({ state: "visible" });
    await page.locator(`#pantry-item-${valid.id}`).getByRole("button", {
      name: "Increase quantity",
    }).click();
    assert.deepEqual(await readAll(), {
      pantry: initialPantry, shopping: initialShopping,
      progression: corruptedLedger, intent: rawIntent,
    }, "blocked intent must prevent subsequent guest pantry edits");
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.getByTestId("guest-journal-recovery-warning").waitFor({
      state: "visible", timeout: 15000,
    });
    assert.deepEqual(await readAll(), {
      pantry: initialPantry, shopping: initialShopping,
      progression: corruptedLedger, intent: rawIntent,
    }, "repeated startup must retain exact evidence for assisted recovery");
    evidence.checks.push("purchase-intent-corruption-blocks-and-preserves-ledger");
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runGuestJournalHydration(mode) {
  const JOURNAL = "balkanbite_guest_pantry_shopping_journal_v1";
  const SHOPPING = "balkanbite_shopping";
  const PLAN = "balkanbite_mealplan";
  const beforePantry = JSON.stringify([valid]);
  const afterPantry = JSON.stringify([{ ...valid, quantity: 550 }]);
  const conflictingPantry = JSON.stringify([{ ...valid, quantity: 600 }]);
  const manual = {
    id: "qa-journal-manual", name: "QA manual shopping", quantity: 1,
    unit: "ud", category: "Other", checked: false,
    amountOrigin: "user_entered", purchaseAmountConfirmed: false,
  };
  const managed = {
    id: "shortage-v1:qa-obsolete", name: "QA obsolete shortage",
    quantity: 20, unit: "g", category: "Other", checked: false,
    amountOrigin: "deterministic_shortfall", purchaseAmountConfirmed: false,
  };
  const beforeShopping = JSON.stringify([manual, managed]);
  const afterShopping = JSON.stringify([manual]);
  const journal = JSON.stringify({
    version: 1,
    operationId: "qa-guest-journal-recovery-01",
    pantryBefore: beforePantry,
    pantryAfter: afterPantry,
    shoppingBefore: beforeShopping,
    shoppingAfter: afterShopping,
    mealPlanBefore: "[]",
  });
  const context = await browser.newContext();
  let page;
  try {
    await context.addInitScript(({ MAIN, SHOPPING, PLAN, JOURNAL, journal,
      mode, beforePantry, afterPantry, conflictingPantry, beforeShopping }) => {
      if (sessionStorage.getItem("__qa_guest_journal_seeded")) return;
      sessionStorage.setItem("__qa_guest_journal_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem("balkanbite_recipes", mode === "conflict"
        ? "{historical-recipe-raw" : "[]");
      localStorage.setItem(PLAN, mode === "malformed" ? "{historical-plan-raw" : "[]");
      localStorage.setItem(MAIN, mode === "unapplied" ? beforePantry
        : mode === "conflict" ? conflictingPantry : afterPantry);
      localStorage.setItem(SHOPPING, beforeShopping);
      localStorage.setItem(JOURNAL, mode === "malformed" ? "{unparseable" : journal);
    }, { MAIN, SHOPPING, PLAN, JOURNAL, journal, mode, beforePantry,
      afterPantry, conflictingPantry, beforeShopping });
    page = await context.newPage();
    page.on("dialog", dialog => dialog.dismiss());
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    if (mode === "conflict" || mode === "malformed") {
      await page.getByTestId("guest-journal-recovery-warning")
        .waitFor({ state: "visible", timeout: 15000 });
      const preserved = await page.evaluate(({ MAIN, SHOPPING, JOURNAL }) => ({
        pantry: localStorage.getItem(MAIN),
        shopping: localStorage.getItem(SHOPPING),
        journal: localStorage.getItem(JOURNAL),
      }), { MAIN, SHOPPING, JOURNAL });
      assert.equal(preserved.pantry, mode === "conflict" ? conflictingPantry : afterPantry);
      assert.equal(preserved.shopping, beforeShopping);
      assert.equal(preserved.journal, mode === "malformed" ? "{unparseable" : journal);
      if (mode === "conflict") {
        assert.equal(await page.evaluate(() => localStorage.getItem("balkanbite_recipes")),
          "{historical-recipe-raw", "pending WAL must not replace malformed original recipe bytes");
      } else {
        assert.equal(await page.evaluate(PLAN => localStorage.getItem(PLAN), PLAN),
          "{historical-plan-raw", "pending WAL must not replace malformed original menu bytes");
      }
      await page.locator("#nav-tab-pantry").click();
      await page.locator(`#pantry-item-${valid.id}`).getByRole("button", {
        name: "Increase quantity",
      }).click();
      assert.equal(await page.evaluate(key => localStorage.getItem(key), MAIN), preserved.pantry,
        "unresolved WAL must block UI stock writes");
      evidence.checks.push(`journal-${mode}-blocked-without-data-overwrite`);
    } else {
      await page.waitForFunction(JOURNAL => localStorage.getItem(JOURNAL) === null,
        JOURNAL, { timeout: 15000 });
      await page.waitForFunction(({ SHOPPING, expected }) =>
        JSON.parse(localStorage.getItem(SHOPPING) || "[]")
          .every(row => row.id !== "shortage-v1:qa-obsolete") &&
        JSON.parse(localStorage.getItem(SHOPPING) || "[]")
          .some(row => row.id === expected.id), { SHOPPING, expected: manual }, { timeout: 12000 });
      const persisted = await page.evaluate(({ MAIN, SHOPPING }) => ({
        pantry: JSON.parse(localStorage.getItem(MAIN)),
        shopping: JSON.parse(localStorage.getItem(SHOPPING)),
      }), { MAIN, SHOPPING });
      assert.equal(persisted.pantry[0].quantity, mode === "unapplied" ? 500 : 550);
      assert.deepEqual(persisted.shopping, [manual],
        "keep confirmed manual shopping unchanged while dropping stale managed row");
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
      assert.equal(await page.evaluate(key => localStorage.getItem(key), JOURNAL), null);
      assert.equal(JSON.parse(await page.evaluate(key => localStorage.getItem(key), MAIN))[0].quantity,
        mode === "unapplied" ? 500 : 550);
      evidence.checks.push(`journal-${mode}-recovered-after-reload`);
    }
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runLateGuestJournalPreventsLegacyWrite(mode) {
  // A second tab can stage a journal after this tab has finished hydrating.
  // The React boot status is still "clear", so every legacy write must
  // re-read the real shared markers instead of overwriting another intent.
  const marker = mode === "legacy-pantry"
    ? "balkanbite_guest_cook_derived_intent_v1"
    : "balkanbite_guest_purchase_intent_v1";
  const manual = {
    id: "qa-late-journal-manual", name: "QA Salt", quantity: 1,
    unit: "kg", category: "Other", checked: false,
    amountOrigin: "user_entered", purchaseAmountConfirmed: false,
  };
  const SHOPPING = "balkanbite_shopping";
  const RECIPES = "balkanbite_recipes";
  const context = await browser.newContext();
  let page;
  try {
    await context.addInitScript(({ MAIN, SHOPPING, manual, valid }) => {
      if (sessionStorage.getItem("__qa_late_journal_seeded")) return;
      sessionStorage.setItem("__qa_late_journal_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([valid]));
      localStorage.setItem(SHOPPING, JSON.stringify([manual]));
      localStorage.setItem("balkanbite_mealplan", "[]");
      localStorage.setItem("balkanbite_recipes", "[]");
      localStorage.setItem("balkanbite_progression", "[]");
    }, { MAIN, SHOPPING, manual, valid });
    page = await context.newPage();
    page.on("dialog", dialog => dialog.dismiss());
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    if (mode === "legacy-pantry") {
      await page.locator("#nav-tab-pantry").click();
      await page.locator(`#pantry-item-${valid.id}`).waitFor({
        state: "visible", timeout: 15000,
      });
    } else {
      await page.locator("#nav-tab-shopping").click();
      await page.locator(`#shopping-item-${manual.id}`).waitFor({
        state: "visible", timeout: 15000,
      });
    }

    const before = await page.evaluate(({ MAIN, SHOPPING }) => ({
      pantry: localStorage.getItem(MAIN),
      shopping: localStorage.getItem(SHOPPING),
    }), { MAIN, SHOPPING });
    const historical = "{legacy recipe evidence";
    await page.evaluate(({ marker, mode, RECIPES, historical }) => {
      localStorage.setItem(marker, "synthetic unfinished cross-tab journal");
      // Make the normal quantity-WAL route deliberately ineligible so
      // the legacy commitGuestPantry guard is actually exercised.
      if (mode === "legacy-pantry") localStorage.setItem(RECIPES, historical);
    }, { marker, mode, RECIPES, historical });
    if (mode === "legacy-pantry") {
      await page.locator(`#pantry-item-${valid.id}`)
        .getByRole("button", { name: "Increase quantity" }).click();
    } else {
      await page.locator(`#shopping-item-${manual.id}`)
        .getByRole("button", { name: /Confirm purchase of/i }).click();
    }
    await page.getByTestId("guest-journal-recovery-warning").waitFor({
      state: "visible", timeout: 15000,
    });
    const after = await page.evaluate(({ MAIN, SHOPPING, RECIPES, marker }) => ({
      pantry: localStorage.getItem(MAIN),
      shopping: localStorage.getItem(SHOPPING),
      recipes: localStorage.getItem(RECIPES),
      pending: localStorage.getItem(marker),
    }), { MAIN, SHOPPING, RECIPES, marker });
    assert.equal(after.pantry, before.pantry, "no legacy pantry overwrite with active cross-tab WAL");
    assert.equal(after.shopping, before.shopping, "no shopping effect overwrite with active cross-tab WAL");
    assert.equal(after.pending, "synthetic unfinished cross-tab journal",
      "unrecognized pending WAL bytes must remain intact for review");
    if (mode === "legacy-pantry") {
      assert.equal(after.recipes, historical,
        "invalid historical recipe evidence cannot be sanitized by a legacy write");
      assert.equal(await page.locator(`#pantry-item-${valid.id}`)
        .getByText("550", { exact: false }).count(), 0,
        "rejected pantry edit must not appear as confirmed stock");
    } else {
      assert.equal((await page.locator(`#shopping-item-${manual.id}`)
        .getAttribute("class"))?.includes("line-through"), false,
        "a rejected shopping confirmation may not look checked in React");
    }
    evidence.checks.push(mode === "legacy-pantry"
      ? "late-pending-wal-refuses-legacy-pantry-edit"
      : "late-pending-wal-refuses-optimistic-shopping-confirmation");
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

async function runTwoTabStaleShoppingDestructiveMutations() {
  // #459: a stale tab must never delete, mark purchased or clear a newer
  // shopping row created by another tab, even if it appears actionable.
  const SHOPPING = "balkanbite_shopping";
  const PROGRESS = "balkanbite_progression";
  const oldRow = { id: "qa-two-tab-kept", name: "QA Flour", quantity: 1,
    unit: "kg", category: "", checked: false, amountOrigin: "user_entered",
    purchaseAmountConfirmed: false };
  const context = await browser.newContext();
  const pages = [];
  const saved = async page => page.evaluate(
    key => localStorage.getItem(key), SHOPPING);
  try {
    await context.addInitScript(({ MAIN, valid, SHOPPING, PROGRESS, oldRow }) => {
      if (localStorage.getItem("__qa_two_tab_destructive_seeded")) return;
      localStorage.setItem("__qa_two_tab_destructive_seeded", "yes");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([valid]));
      localStorage.setItem(SHOPPING, JSON.stringify([oldRow]));
      localStorage.setItem("balkanbite_recipes", "[]");
      localStorage.setItem("balkanbite_mealplan", "[]");
      localStorage.setItem(PROGRESS, "[]");
    }, { MAIN, valid, SHOPPING, PROGRESS, oldRow });
    for (let i = 0; i < 4; i++) {
      const page = await context.newPage();
      pages.push(page);
      page.on("dialog", dialog => dialog.dismiss());
      await page.goto(new URL("/", base).toString(), {
        waitUntil: "domcontentloaded", timeout: 30000,
      });
      await page.locator("#nav-tab-shopping").click();
      await page.locator("#shopping-item-qa-two-tab-kept")
        .waitFor({ state: "visible", timeout: 12000 });
    }
    const [writer, oldToggle, oldDelete, oldClear] = pages;
    await writer.locator("#manual-shopping-open").click();
    await writer.locator("#manual-shopping-name").fill("QA Apples");
    await writer.locator("#manual-shopping-quantity").fill("2");
    await writer.locator("#manual-shopping-unit").selectOption("kg");
    await writer.locator("#manual-shopping-submit").click();
    await writer.waitForFunction(SHOPPING =>
      JSON.parse(localStorage.getItem(SHOPPING) || "[]").length === 2,
      SHOPPING, { timeout: 12000 });
    const authoritative = await saved(writer);
    const actual = JSON.parse(authoritative);
    assert.deepEqual(actual.map(row => row.name), ["QA Flour", "QA Apples"]);
    assert.ok(actual.every(row => !row.checked &&
      row.purchaseAmountConfirmed === false));

    const staleToggleRow = oldToggle.locator("#shopping-item-qa-two-tab-kept");
    await staleToggleRow.getByRole("button", { name: /Confirm purchase of/ }).click();
    await oldToggle.getByRole("alert").getByText(/The change was not saved/)
      .waitFor({ state: "visible", timeout: 12000 });
    await oldToggle.getByTestId("guest-shopping-consistency-warning")
      .waitFor({ state: "visible", timeout: 12000 });
    assert.equal(await saved(oldToggle), authoritative,
      "stale toggle must not overwrite newly added shopping item");
    await staleToggleRow.getByRole("button", { name: /Confirm purchase of/ })
      .waitFor({ state: "visible" });

    const staleDeleteRow = oldDelete.locator("#shopping-item-qa-two-tab-kept");
    await staleDeleteRow.locator("button").last().click();
    await oldDelete.getByRole("alert").getByText(/The change was not saved/)
      .waitFor({ state: "visible", timeout: 12000 });
    await staleDeleteRow.waitFor({ state: "visible" });
    assert.equal(await saved(oldDelete), authoritative,
      "stale deletion must not destroy a newer shopping snapshot");

    await oldClear.locator("#clear-shopping-list-btn").click();
    const heading = oldClear.getByRole("heading", { name: "Clear shopping list?" });
    await heading.waitFor({ state: "visible" });
    const confirm = heading.locator("xpath=../../..").getByRole("button", {
      name: "Clear", exact: true,
    });
    await confirm.click();
    await heading.waitFor({ state: "visible" });
    await oldClear.getByTestId("guest-shopping-consistency-warning")
      .waitFor({ state: "visible", timeout: 12000 });
    assert.equal(await saved(oldClear), authoritative,
      "stale clear cannot erase all rows added by another tab");

    // Rehydration is the explicit recovery boundary: one tab refreshes its
    // entire source snapshot before reapplying a human purchase confirmation.
    await oldToggle.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await oldToggle.locator("#nav-tab-shopping").click();
    await oldToggle.locator("#shopping-item-qa-two-tab-kept")
      .getByRole("button", { name: /Confirm purchase of/ }).click();
    await oldToggle.waitForFunction(SHOPPING => {
      const rows = JSON.parse(localStorage.getItem(SHOPPING) || "[]");
      return rows.length === 2 && rows[0].checked === true &&
        rows[0].purchaseAmountConfirmed === true &&
        rows[1].name === "QA Apples" && rows[1].checked === false;
    }, SHOPPING, { timeout: 12000 });
    await oldToggle.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await oldToggle.locator("#nav-tab-shopping").click();
    const result = await oldToggle.evaluate(({ SHOPPING, PROGRESS }) => ({
      shopping: JSON.parse(localStorage.getItem(SHOPPING) || "[]"),
      progression: JSON.parse(localStorage.getItem(PROGRESS) || "[]"),
    }), { SHOPPING, PROGRESS });
    assert.equal(result.shopping.length, 2);
    assert.deepEqual(result.shopping.map(row => row.name), ["QA Flour", "QA Apples"]);
    assert.equal(result.shopping[0].purchaseAmountConfirmed, true);
    assert.equal(result.shopping[1].purchaseAmountConfirmed, false);
    assert.deepEqual(result.progression, [],
      "shopping checkbox alone must not invent a pantry purchase event");
    evidence.checks.push("two-tabs-stale-toggle-delete-clear-fail-closed-reload-recovers");
  } finally {
    await Promise.all(pages.map(p => p.close().catch(() => {})));
    await context.close();
  }
}

async function runTwoTabStaleShoppingAdd() {
  // #459: two live guest tabs must not lose a newer shopping row when the
  // second tab submits a different row from an older React snapshot.
  const SHOPPING = "balkanbite_shopping";
  const PROGRESS = "balkanbite_progression";
  const original = {
    id: "qa-two-tab-original-salt", name: "QA Salt", quantity: 1,
    unit: "kg", category: "", checked: false, amountOrigin: "user_entered",
    purchaseAmountConfirmed: false,
  };
  const context = await browser.newContext();
  const pages = [];
  const addManual = async (page, name, qty, unit) => {
    await page.locator("#manual-shopping-open").click();
    await page.locator("#manual-shopping-name").fill(name);
    await page.locator("#manual-shopping-quantity").fill(String(qty));
    await page.locator("#manual-shopping-unit").selectOption(unit);
    await page.locator("#manual-shopping-submit").click();
  };
  try {
    await context.addInitScript(({ MAIN, valid, SHOPPING, PROGRESS, original }) => {
      if (localStorage.getItem("__qa_two_tab_shopping_add_seeded")) return;
      localStorage.setItem("__qa_two_tab_shopping_add_seeded", "yes");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([valid]));
      localStorage.setItem(SHOPPING, JSON.stringify([original]));
      localStorage.setItem("balkanbite_recipes", "[]");
      localStorage.setItem("balkanbite_mealplan", "[]");
      localStorage.setItem(PROGRESS, "[]");
    }, { MAIN, valid, SHOPPING, PROGRESS, original });

    for (let i = 0; i < 2; i++) {
      const page = await context.newPage();
      pages.push(page);
      page.on("dialog", dialog => dialog.dismiss());
      await page.goto(new URL("/", base).toString(), {
        waitUntil: "domcontentloaded", timeout: 30000,
      });
      await page.locator("#nav-tab-shopping").click();
      await page.locator("#shopping-item-qa-two-tab-original-salt")
        .waitFor({ state: "visible", timeout: 12000 });
    }
    const [fresh, stale] = pages;
    await addManual(fresh, "QA Apples", 2, "kg");
    await fresh.waitForFunction(SHOPPING => {
      const rows = JSON.parse(localStorage.getItem(SHOPPING) || "[]");
      return rows.length === 2 && rows.some(row =>
        row.name === "QA Apples" && row.quantity === 2 && row.unit === "kg" &&
        row.amountOrigin === "user_entered" && !row.checked &&
        row.purchaseAmountConfirmed === false
      );
    }, SHOPPING, { timeout: 12000 });
    const savedByFresh = await fresh.evaluate(SHOPPING => localStorage.getItem(SHOPPING), SHOPPING);
    const apples = JSON.parse(savedByFresh).find(row => row.name === "QA Apples");
    await fresh.locator(`[id=${JSON.stringify("shopping-item-" + apples.id)}]`)
      .waitFor({ state: "visible", timeout: 12000 });
    // A second tab should warn proactively, before the stale user submits
    // anything. Its in-memory row is still the original, so no implicit
    // merge/overwrite or invented purchase should occur.
    const staleWarning = stale.getByTestId("guest-shopping-consistency-warning");
    await staleWarning.waitFor({ state: "visible", timeout: 12000 });
    assert.match(await staleWarning.textContent() || "", /Another tab changed the shopping list/);
    assert.equal(await stale.locator("#shopping-item-qa-two-tab-original-salt").count(), 1);
    assert.equal(await stale.locator(`[id=${JSON.stringify("shopping-item-" + apples.id)}]`).count(), 0,
      "newer row must never be guessed into the older in-memory view");
    assert.equal(await stale.evaluate(SHOPPING => localStorage.getItem(SHOPPING), SHOPPING),
      savedByFresh, "proactive stale-tab warning must not mutate saved shopping");
    assert.equal(await fresh.getByTestId("guest-shopping-consistency-warning").count(), 0,
      "originating tab must not warn about its own verified write");

    await addManual(stale, "QA Beans", 500, "g");
    await stale.getByRole("alert").getByText(/The item was not saved/)
      .waitFor({ state: "visible", timeout: 12000 });
    await stale.getByTestId("guest-shopping-consistency-warning")
      .waitFor({ state: "visible", timeout: 12000 });
    assert.equal(await stale.locator("#manual-shopping-name").inputValue(), "QA Beans");
    assert.equal(await stale.locator("#manual-shopping-quantity").inputValue(), "500");
    assert.equal(await stale.locator("#manual-shopping-unit").inputValue(), "g");
    assert.equal(await stale.evaluate(SHOPPING => localStorage.getItem(SHOPPING), SHOPPING),
      savedByFresh, "stale tab cannot overwrite another tab's already saved shopping item");
    assert.equal(await stale.locator("#manual-shopping-submit").isEnabled(), true,
      "failed submission should retain explicit user-entered quantity");

    await stale.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await stale.locator("#nav-tab-shopping").click();
    await stale.locator(`[id=${JSON.stringify("shopping-item-" + apples.id)}]`)
      .waitFor({ state: "visible", timeout: 12000 });
    await addManual(stale, "QA Beans", 500, "g");
    await stale.waitForFunction(({ SHOPPING }) => {
      const rows = JSON.parse(localStorage.getItem(SHOPPING) || "[]");
      return rows.length === 3 && rows.some(row => row.name === "QA Apples") &&
        rows.some(row => row.name === "QA Beans" && row.quantity === 500 &&
          row.unit === "g" && row.checked === false &&
          row.purchaseAmountConfirmed === false);
    }, { SHOPPING }, { timeout: 12000 });
    await stale.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await stale.locator("#nav-tab-shopping").click();
    const final = await stale.evaluate(({ SHOPPING, PROGRESS }) => ({
      rows: JSON.parse(localStorage.getItem(SHOPPING) || "[]"),
      progression: JSON.parse(localStorage.getItem(PROGRESS) || "[]"),
    }), { SHOPPING, PROGRESS });
    assert.equal(final.rows.length, 3);
    assert.deepEqual(final.rows.map(row => row.name),
      ["QA Salt", "QA Apples", "QA Beans"]);
    assert.ok(final.rows.every(row => !row.checked &&
      row.purchaseAmountConfirmed === false &&
      row.estimatedPriceEUR === undefined));
    assert.deepEqual(final.progression, [],
      "list additions alone never assert confirmed purchases or cooking");
    evidence.checks.push("two-tabs-guest-shopping-proactive-storage-event-warning-before-edit");
    evidence.checks.push("two-tabs-guest-shopping-stale-add-fails-closed-then-reloads-and-saves");
  } finally {
    await Promise.all(pages.map(page => page.close().catch(() => {})));
    await context.close();
  }
}

async function runTwoTabDerivedChangeBlocksGuestFacts() {
  // A newer recipe, menu or consumption ledger in a different guest tab
  // invalidates this tab's derived claims BEFORE a stale pantry edit.
  for (const DERIVED of ["balkanbite_recipes", "balkanbite_mealplan", "balkanbite_progression"]) {
    const context = await browser.newContext();
    const pages = [];
    try {
      await context.addInitScript(({ MAIN, valid }) => {
        if (localStorage.getItem("__qa_cross_tab_derived_initialized") !== null) return;
        localStorage.setItem("__qa_cross_tab_derived_initialized", "yes");
        localStorage.setItem("balkanbite_show_landing", "false");
        localStorage.setItem("balkanbite_profile", JSON.stringify({
          language: "en", onboardingCompleted: true,
        }));
        localStorage.setItem(MAIN, JSON.stringify([valid]));
        localStorage.setItem("balkanbite_recipes", "[]");
        localStorage.setItem("balkanbite_mealplan", "[]");
        localStorage.setItem("balkanbite_progression", "[]");
        localStorage.setItem("balkanbite_shopping", "[]");
      }, { MAIN, valid });
      for (let i = 0; i < 2; i++) {
        const page = await context.newPage();
        pages.push(page);
        page.on("dialog", dialog => dialog.dismiss());
        await page.goto(new URL("/", base).toString(), {
          waitUntil: "domcontentloaded", timeout: 30000,
        });
        await page.locator("#nav-tab-pantry").click();
        await page.locator(`#pantry-item-${valid.id}`)
          .waitFor({ state: "visible", timeout: 12000 });
      }
      const [writer, stale] = pages;
      const originalPantry = await stale.evaluate(MAIN => localStorage.getItem(MAIN), MAIN);
      const priorDerived = await writer.evaluate(key => localStorage.getItem(key), DERIVED);
      assert.equal(priorDerived, "[]");
      // Valid JSON with different original bytes; no assumption that changed
      // source content is semantically equivalent or safe to auto-merge.
      const externalDerived = "[ ]";
      await writer.evaluate(({ key, raw }) => localStorage.setItem(key, raw),
        { key: DERIVED, raw: externalDerived });
      const warning = stale.getByTestId("guest-derived-cross-tab-warning");
      await warning.waitFor({ state: "visible", timeout: 12000 });
      assert.match(await warning.textContent() || "",
        /Another tab changed recipes, the meal plan or consumption records/);
      assert.equal(await stale.evaluate(key => localStorage.getItem(key), DERIVED), externalDerived);
      await stale.locator(`#pantry-item-${valid.id}`)
        .getByRole("button", { name: "Increase quantity" }).click();
      await stale.getByTestId("guest-derived-cross-tab-warning")
        .waitFor({ state: "visible" });
      assert.equal(await stale.evaluate(MAIN => localStorage.getItem(MAIN), MAIN), originalPantry,
        `${DERIVED}: stale guest edit must not change verified pantry bytes`);
      assert.equal(await stale.evaluate(key => localStorage.getItem(key), DERIVED), externalDerived,
        `${DERIVED}: stale tab must not overwrite new derived source`);
      await stale.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
      await stale.locator("#nav-tab-pantry").click();
      assert.equal(await stale.getByTestId("guest-derived-cross-tab-warning").count(), 0,
        "reload is the explicit boundary for reviewing stored source");
      evidence.checks.push(`guest-cross-tab-${DERIVED}-source-change-warns-blocks-edit-reloads`);
    } finally {
      await Promise.all(pages.map(page => page.close().catch(() => {})));
      await context.close();
    }
  }
}

async function runTwoTabExternalStorageClearBlocksGuestFacts() {
  // Deliberately destroy ONLY synthetic fixture bytes in an isolated local
  // browser context. A global clear event has event.key === null, unlike
  // per-key pantry/shopping mutations; the other tab must not resurrect data.
  const SHOPPING = "balkanbite_shopping";
  const original = { id: "qa-clear-signal-salt", name: "QA Salt",
    quantity: 1, unit: "kg", category: "", checked: false,
    amountOrigin: "user_entered", purchaseAmountConfirmed: false };
  const context = await browser.newContext();
  const pages = [];
  try {
    await context.addInitScript(({ MAIN, valid, SHOPPING, original }) => {
      if (localStorage.getItem("__qa_clear_signal_seeded") !== null) return;
      localStorage.setItem("__qa_clear_signal_seeded", "yes");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile",
        JSON.stringify({ language: "en", onboardingCompleted: true }));
      localStorage.setItem(MAIN, JSON.stringify([valid]));
      localStorage.setItem(SHOPPING, JSON.stringify([original]));
      localStorage.setItem("balkanbite_mealplan", "[]");
      localStorage.setItem("balkanbite_recipes", "[]");
      localStorage.setItem("balkanbite_progression", "[]");
    }, { MAIN, valid, SHOPPING, original });
    for (let i = 0; i < 2; i++) {
      const page = await context.newPage();
      pages.push(page);
      page.on("dialog", dialog => dialog.dismiss());
      await page.goto(new URL("/", base).toString(), {
        waitUntil: "domcontentloaded", timeout: 30000,
      });
      await page.locator("#nav-tab-pantry").click();
      await page.locator(`#pantry-item-${valid.id}`)
        .waitFor({ state: "visible", timeout: 12000 });
    }
    const [clearingTab, staleTab] = pages;
    const saved = await staleTab.evaluate(({ MAIN, SHOPPING }) => ({
      pantry: localStorage.getItem(MAIN),
      shopping: localStorage.getItem(SHOPPING),
    }), { MAIN, SHOPPING });
    assert.equal(JSON.parse(saved.pantry)[0].quantity, valid.quantity);
    assert.deepEqual(JSON.parse(saved.shopping), [original]);
    await clearingTab.evaluate(() => localStorage.clear());
    await staleTab.getByTestId("guest-pantry-cross-tab-warning")
      .waitFor({ state: "visible", timeout: 12000 });
    await staleTab.getByTestId("guest-shopping-consistency-warning")
      .waitFor({ state: "visible", timeout: 12000 });
    assert.match(await staleTab.getByTestId("guest-pantry-cross-tab-warning")
      .textContent() || "", /Another tab changed the pantry/);
    assert.match(await staleTab.getByTestId("guest-shopping-consistency-warning")
      .textContent() || "", /Another tab changed the shopping list/);
    // The stale React row remains visible for review; it is NOT proof that
    // the now absent underlying data was kept or may be silently restored.
    await staleTab.locator(`#pantry-item-${valid.id}`)
      .waitFor({ state: "visible" });
    const afterClear = await staleTab.evaluate(({ MAIN, SHOPPING }) => ({
      pantry: localStorage.getItem(MAIN),
      shopping: localStorage.getItem(SHOPPING),
    }), { MAIN, SHOPPING });
    assert.deepEqual(afterClear, { pantry: null, shopping: null },
      "clear must not be hidden by automatic guest cache rehydration");
    await staleTab.locator(`#pantry-item-${valid.id}`)
      .getByRole("button", { name: "Increase quantity" }).click();
    await staleTab.locator("#nav-tab-shopping").click();
    await staleTab.locator("#manual-shopping-open").click();
    await staleTab.locator("#manual-shopping-name").fill("QA Beans");
    await staleTab.locator("#manual-shopping-quantity").fill("500");
    await staleTab.locator("#manual-shopping-unit").selectOption("g");
    await staleTab.locator("#manual-shopping-submit").click();
    await staleTab.getByRole("alert").getByText(/The item was not saved/)
      .waitFor({ state: "visible", timeout: 12000 });
    assert.equal(await staleTab.locator("#manual-shopping-name").inputValue(), "QA Beans");
    const afterRejectedEdits = await staleTab.evaluate(({ MAIN, SHOPPING }) => ({
      pantry: localStorage.getItem(MAIN),
      shopping: localStorage.getItem(SHOPPING),
    }), { MAIN, SHOPPING });
    assert.deepEqual(afterRejectedEdits, { pantry: null, shopping: null },
      "stale guest actions may not resurrect keys cleared in another tab");
    evidence.checks.push("guest-cross-tab-global-storage-clear-warns-and-blocks-resurrection");
  } finally {
    await Promise.all(pages.map(page => page.close().catch(() => {})));
    await context.close();
  }
}

async function runTwoTabStaleInventory() {
  const context = await browser.newContext();
  const pages = [];
  try {
    await context.addInitScript(({ MAIN, valid }) => {
      if (localStorage.getItem("__qa_two_tab_initialized") !== null) return;
      localStorage.setItem("__qa_two_tab_initialized", "yes");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([valid]));
    }, { MAIN, valid });

    for (let index = 0; index < 2; index++) {
      const page = await context.newPage();
      pages.push(page);
      page.on("dialog", dialog => dialog.dismiss());
      await page.goto(new URL("/", base).toString(), {
        waitUntil: "domcontentloaded", timeout: 30000,
      });
      await page.locator("#nav-tab-pantry").click();
      await page.locator(`#pantry-item-${valid.id}`).waitFor({
        state: "visible", timeout: 15000,
      });
    }
    const [first, stale] = pages;
    const increment = page => page.locator(`#pantry-item-${valid.id}`)
      .getByRole("button", { name: "Increase quantity" });
    await increment(first).click();
    await first.waitForFunction(({ MAIN, id }) => {
      const rows = JSON.parse(localStorage.getItem(MAIN) || "[]");
      return rows.length === 1 && rows[0].id === id && rows[0].quantity === 550;
    }, { MAIN, id: valid.id });

    // Warn BEFORE the stale user edits, not only after a failed write.
    const externalWarning = stale.getByTestId("guest-pantry-cross-tab-warning");
    await externalWarning.waitFor({ state: "visible", timeout: 12000 });
    assert.match(await externalWarning.textContent() || "", /Another tab changed the pantry/);
    assert.equal(await stale.locator(`#pantry-item-${valid.id}`)
      .getByText("500", { exact: false }).count() > 0, true,
      "the stale tab must not silently replace the displayed quantity");
    const freshRaw = await stale.evaluate(MAIN => localStorage.getItem(MAIN), MAIN);
    assert.equal(JSON.parse(freshRaw)[0].quantity, 550);
    // The second tab loaded 500g, so overwriting 550g must fail closed.
    await increment(stale).click();
    // Both the original single-key guard and the new journal preflight reject
    // stale second-tab stock. They surface different but explicit UI warnings.
    await stale.locator(
      '[data-testid="guest-pantry-recovery"], [data-testid="guest-pantry-cross-tab-warning"], [data-testid="guest-shopping-consistency-warning"], [data-testid="guest-journal-recovery-warning"]',
    ).filter({ hasText: /Another tab changed the pantry|could not be protected|not safely synchronized|unfinished local operation|pantry and shopping consistency could not be confirmed/i })
      .first().waitFor({ state: "visible", timeout: 12000 });
    const originalAfterStaleWrite = await stale.evaluate(MAIN =>
      localStorage.getItem(MAIN), MAIN);
    assert.equal(JSON.parse(originalAfterStaleWrite)[0].quantity, 550);
    assert.equal(await stale.locator(`#pantry-item-${valid.id}`)
      .getByText("500", { exact: false }).count() > 0, true);

    // A fresh reload sees the latest quantity and can safely add 50g.
    await stale.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await stale.locator("#nav-tab-pantry").click();
    await increment(stale).click();
    await stale.waitForFunction(({ MAIN, id }) => {
      const rows = JSON.parse(localStorage.getItem(MAIN) || "[]");
      return rows.length === 1 && rows[0].id === id && rows[0].quantity === 600;
    }, { MAIN, id: valid.id });
    evidence.checks.push("stale-second-tab-proactive-pantry-warning-and-no-overwrite");
  } finally {
    await Promise.all(pages.map(page => page.close().catch(() => {})));
    await context.close();
  }
}

async function runTwoTabVoicePurchaseRecovery() {
  const INTENT = "balkanbite_guest_voice_removal_intent_v1";
  const RECEIPTS = "balkanbite_guest_voice_removal_receipts_v1";
  const SHOPPING = "balkanbite_shopping";
  const PROGRESS = "balkanbite_progression";
  const confirmedMilk = {
    id: "qa-two-tab-milk", name: "QA milk", quantity: 2, unit: "l",
    category: "Dairy", checked: true, amountOrigin: "user_entered",
    purchaseAmountConfirmed: true,
  };
  const manual = {
    id: "qa-two-tab-salt", name: "QA Salt", quantity: 1, unit: "kg",
    category: "Other", checked: false, amountOrigin: "user_entered",
    purchaseAmountConfirmed: false,
  };
  const context = await browser.newContext();
  const pages = [];
  try {
    await context.addInitScript(({ MAIN, SHOPPING, PROGRESS, RECEIPTS, valid,
      confirmedMilk, manual }) => {
      if (localStorage.getItem("__qa_two_tab_voice_purchase_seeded")) return;
      localStorage.setItem("__qa_two_tab_voice_purchase_seeded", "yes");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([{ ...valid, quantity: 150 }]));
      localStorage.setItem(SHOPPING, JSON.stringify([confirmedMilk, manual]));
      localStorage.setItem(PROGRESS, "[]");
      localStorage.setItem("balkanbite_recipes", "[]");
      localStorage.setItem("balkanbite_mealplan", "[]");
      localStorage.setItem(RECEIPTS, "[]");
    }, { MAIN, SHOPPING, PROGRESS, RECEIPTS, valid, confirmedMilk, manual });
    await context.route("**/api/ai/parse-intent", route => route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ actionType: "ANSWER", message: "QA controlled answer" }),
    }));
    for (let index = 0; index < 2; index++) {
      const page = await context.newPage();
      pages.push(page);
      page.on("dialog", dialog => dialog.dismiss());
      await page.goto(new URL("/", base).toString(), {
        waitUntil: "domcontentloaded", timeout: 30000,
      });
    }
    const [voiceTab, purchaseTab] = pages;
    await purchaseTab.locator("#nav-tab-shopping").click();
    await purchaseTab.locator(`#shopping-item-${confirmedMilk.id}`)
      .waitFor({ state: "visible", timeout: 15000 });
    await purchaseTab.locator("#transfer-to-pantry-btn")
      .waitFor({ state: "visible", timeout: 15000 });
    await voiceTab.locator("#chef-ia-floating-btn").click();
    await voiceTab.locator("#voice-text-input").fill("I used 100 g QA Rice");
    await voiceTab.locator("#voice-send-btn").click();
    await voiceTab.getByRole("button", { name: "Confirm", exact: true })
      .waitFor({ state: "visible", timeout: 15000 });
    await voiceTab.evaluate(({ INTENT, RECEIPTS }) => {
      const native = Storage.prototype.setItem;
      window.__qaTwoTabVoiceIntentStages = 0;
      Storage.prototype.setItem = function(key, value) {
        if (key === INTENT) window.__qaTwoTabVoiceIntentStages++;
        if (window.__qaTwoTabVoiceIntentStages > 0 && key === RECEIPTS) return;
        return native.call(this, key, value);
      };
    }, { INTENT, RECEIPTS });
    await voiceTab.getByRole("button", { name: "Confirm", exact: true }).click();
    await voiceTab.waitForFunction(({ MAIN, INTENT }) => {
      const stock = JSON.parse(localStorage.getItem(MAIN) || "[]");
      return stock.find(row => row.id === "qa-guest-rice")?.quantity === 50 &&
        localStorage.getItem(INTENT) !== null;
    }, { MAIN, INTENT }, { timeout: 15000 });

    // Keep the same synthetic receipt-write failure active in BOTH browser
    // tabs. A blocked mutation can trigger an eager journal recovery in the
    // other tab; without this interception it may legitimately complete
    // the receipt and clear the marker before our assertions run.
    await purchaseTab.evaluate(RECEIPTS => {
      const original = Storage.prototype.setItem;
      window.__qaTwoTabRecoveryReceiptWrites = 0;
      Storage.prototype.setItem = function(key, value) {
        if (key === RECEIPTS) {
          window.__qaTwoTabRecoveryReceiptWrites++;
          return;
        }
        return original.call(this, key, value);
      };
    }, RECEIPTS);
    // A different real browser tab must refuse purchase while the voice WAL
    // is incomplete. No optimistic milk stock/progression may be published.
    await purchaseTab.locator("#transfer-to-pantry-btn").click();
    const whilePending = await purchaseTab.evaluate(({ MAIN, INTENT, PROGRESS, RECEIPTS }) => ({
      stock: JSON.parse(localStorage.getItem(MAIN) || "[]"),
      marker: localStorage.getItem(INTENT),
      receipts: JSON.parse(localStorage.getItem(RECEIPTS) || "[]"),
      progression: JSON.parse(localStorage.getItem(PROGRESS) || "[]"),
    }), { MAIN, INTENT, PROGRESS, RECEIPTS });
    assert.ok(whilePending.marker, "unfinished voice intent stays visible to the other tab");
    assert.equal(whilePending.stock.find(row => row.id === valid.id)?.quantity, 50);
    assert.equal(whilePending.stock.some(row => row.name === confirmedMilk.name), false,
      "second tab must not transfer shopping during unfinished voice removal");
    assert.deepEqual(whilePending.receipts, [], "silent receipt write has not succeeded");
    assert.deepEqual(whilePending.progression, [], "rejected purchase cannot claim progression");

    // Reload removes the deliberately injected write fault. Recovery resumes
    // from exact after-snapshots: it never deducts the rice a second time.
    await voiceTab.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await voiceTab.waitForFunction(({ MAIN, INTENT, RECEIPTS }) => {
      const stock = JSON.parse(localStorage.getItem(MAIN) || "[]");
      const receipts = JSON.parse(localStorage.getItem(RECEIPTS) || "[]");
      return localStorage.getItem(INTENT) === null &&
        stock.find(row => row.id === "qa-guest-rice")?.quantity === 50 &&
        receipts.length === 1;
    }, { MAIN, INTENT, RECEIPTS }, { timeout: 16000 });
    await purchaseTab.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await purchaseTab.locator("#nav-tab-shopping").click();
    await purchaseTab.locator(`#shopping-item-${confirmedMilk.id}`)
      .waitFor({ state: "visible", timeout: 15000 });
    await purchaseTab.locator("#transfer-to-pantry-btn").click();
    await purchaseTab.waitForFunction(({ MAIN, PROGRESS }) => {
      const stock = JSON.parse(localStorage.getItem(MAIN) || "[]");
      const progression = JSON.parse(localStorage.getItem(PROGRESS) || "[]");
      return stock.find(row => row.id === "qa-guest-rice")?.quantity === 50 &&
        stock.find(row => row.name === "QA milk")?.quantity === 2 &&
        progression.filter(row => row.type === "confirmed_purchase_applied").length === 1;
    }, { MAIN, PROGRESS }, { timeout: 15000 });
    const final = await purchaseTab.evaluate(({ MAIN, SHOPPING, PROGRESS, RECEIPTS }) => ({
      stock: JSON.parse(localStorage.getItem(MAIN) || "[]"),
      shopping: JSON.parse(localStorage.getItem(SHOPPING) || "[]"),
      progression: JSON.parse(localStorage.getItem(PROGRESS) || "[]"),
      receipts: JSON.parse(localStorage.getItem(RECEIPTS) || "[]"),
    }), { MAIN, SHOPPING, PROGRESS, RECEIPTS });
    assert.equal(final.stock.find(row => row.id === valid.id)?.quantity, 50);
    assert.equal(final.stock.find(row => row.name === confirmedMilk.name)?.quantity, 2);
    assert.equal(final.receipts.length, 1);
    assert.equal(final.progression.filter(row => row.type === "confirmed_purchase_applied").length, 1);
    assert.deepEqual(final.shopping.filter(row => row.id === manual.id), [manual]);
    evidence.checks.push("two-real-tabs-voice-fault-blocks-purchase-then-recovers-without-repeat");
  } finally {
    await Promise.all(pages.map(page => page.close().catch(() => {})));
    await context.close();
  }
}

async function runChefWorkspaceFacts() {
  const context = await browser.newContext();
  const pages = [];
  let aiRequests = 0;
  const when = new Date();
  const key = [when.getFullYear(), String(when.getMonth() + 1).padStart(2, "0"),
    String(when.getDate()).padStart(2, "0")].join("-");
  const recipe = {
    id: "qa-workspace-recipe", title: { en: "Rice meal", es: "Arroz", bg: "Ориз" },
    description: { en: "QA", es: "QA", bg: "QA" },
    prepTimeMin: 0, cookTimeMin: 0, costPerServingEUR: 0,
    difficulty: "easy", servings: 1, calories: 0, proteinG: 0, carbsG: 0,
    fatG: 0, fiberG: 0, tags: [],
    ingredients: [{ name: "QA Rice", amount: 100, unit: "g", inPantry: false }],
    instructions: { en: ["Cook"], es: ["Cocinar"], bg: ["Готви"] },
    nutritionHighlights: { en: "QA", es: "QA", bg: "QA" },
  };
  const plan = [{ date: key, lunch: recipe }];
  const shopping = [
    { id: "qa-list-oil", name: "QA Olive Oil", quantity: 1.5, unit: "L",
      category: "Other", checked: false, amountOrigin: "ai_estimated",
      purchaseAmountConfirmed: false },
    { id: "qa-list-eggs", name: "QA Eggs", quantity: 6, unit: "ud",
      category: "Other", checked: true, amountOrigin: "user_entered",
      purchaseAmountConfirmed: false },
  ];
  const progression = [{
    version: 1, eventId: "purchase:qa-workspace-1",
    type: "confirmed_purchase_applied", occurredAt: "2026-10-16T10:00:00Z",
    evidence: "deterministic_state_transition", evidenceCount: 1,
  }];
  try {
    await context.addInitScript(({ MAIN, valid, plan, shopping, progression }) => {
      if (sessionStorage.getItem("__qa_workspace_facts_seeded")) return;
      sessionStorage.setItem("__qa_workspace_facts_seeded", "yes");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([{ ...valid, quantity: 50 }]));
      localStorage.setItem("balkanbite_mealplan", JSON.stringify(plan));
      localStorage.setItem("balkanbite_shopping", JSON.stringify(shopping));
      localStorage.setItem("balkanbite_recipes", "[]");
      localStorage.setItem("balkanbite_progression", JSON.stringify(progression));
    }, { MAIN, valid, plan, shopping, progression });
    await context.route("**/api/ai/parse-intent", route => {
      aiRequests++;
      return route.fulfill({
        status: 503, contentType: "application/json",
        body: JSON.stringify({ success: false }),
      });
    });
    const page = await context.newPage();
    pages.push(page);
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.locator("#chef-ia-floating-btn").click();
    await page.locator("#chef-ia-modal-panel").waitFor({ state: "visible", timeout: 15000 });
    const ask = async (question, expected) => {
      const matching = page.getByText(expected, { exact: false });
      const previousCount = await matching.count();
      await page.locator("#voice-text-input").fill(question);
      await page.locator("#voice-send-btn").click();
      // Two legitimate fail-closed answers have identical text. Require an
      // additional message, not just visibility of an older matching bubble.
      await matching.nth(previousCount)
        .waitFor({ state: "visible", timeout: 15000 });
    };
    await ask("What meals are planned?", "Rice meal");
    await page.getByText("These are plans, not confirmed consumption.", { exact: false })
      .waitFor({ state: "visible" });
    await ask("What meals are planned for today?", "lunch: Rice meal");
    await page.getByText("This is a plan, not confirmed consumption.", { exact: false })
      .waitFor({ state: "visible" });
    await ask("What is missing for my meal plan?", "QA Rice (50 g");
    await ask("What ingredients are missing for today's meals?",
      "Calculated shortages for today's recorded meals");
    await page.getByText("These are not completed purchases, verified prices or a food-safety guarantee.",
      { exact: false }).waitFor({ state: "visible" });
    await ask("What is on my shopping list?", "QA Olive Oil");
    await page.getByText("1 checked. This summary does not verify quantities, prices or completed purchases.",
      { exact: false }).waitFor({ state: "visible" });
    await ask("What is my progress?", "1 verified events");
    await page.getByText("1 applied purchases", { exact: false }).waitFor({ state: "visible" });
    assert.equal(aiRequests, 0, "workspace facts must not call unavailable/paid AI");
    const before = await page.evaluate(MAIN => ({
      pantry: localStorage.getItem(MAIN),
      progression: localStorage.getItem("balkanbite_progression"),
      plan: localStorage.getItem("balkanbite_mealplan"),
      shopping: localStorage.getItem("balkanbite_shopping"),
    }), MAIN);
    assert.equal(before.pantry && JSON.parse(before.pantry)[0].quantity, 50);
    assert.equal(JSON.parse(before.progression).length, 1);
    assert.deepEqual(JSON.parse(before.shopping), shopping,
      "read-only shopping question must not rewrite actual checklist");
    // Unrelated shopping corruption cannot invalidate verified event counts.
    const other = await context.newPage();
    pages.push(other);
    await other.goto(new URL("/", base).toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
    await other.evaluate(() => localStorage.setItem("balkanbite_shopping", '[{"legacy":"unverified"}]'));
    await ask("What is on my shopping list?", "I cannot verify the recorded shopping list yet");
    await ask("What is my progress?", "1 verified events");
    await ask("What is missing for my meal plan?", "QA Rice (50 g");
    await ask("What ingredients are missing for today's meals?", "Calculated shortages for today's recorded meals");
    // Other tab corrupts source AFTER this tab hydrated. No filtered-data
    // snapshot may be advertised as a complete progress history.
    await other.evaluate(() =>
      localStorage.setItem("balkanbite_progression", '[{"legacy":"unverified"}]'));
    await ask("What is my progress?", "I cannot verify the recorded progress history yet");
    await ask("What is missing for my meal plan?", "QA Rice (50 g");
    await ask("What ingredients are missing for today's meals?", "Calculated shortages for today's recorded meals");
    await ask("What meals are planned?", "Rice meal");
    await ask("What meals are planned for today?", "lunch: Rice meal");
    // The other tab still contains invalid shopping data: keep it blocked.
    await ask("What is on my shopping list?", "I cannot verify the recorded shopping list yet");
    await ask("What meals are planned?", "Rice meal");
    await other.evaluate(() =>
      localStorage.setItem("balkanbite_mealplan", '[{"date":"2026-02-30"}]'));
    await ask("What meals are planned?", "I cannot verify the recorded meal plan yet");
    await ask("What is missing for my meal plan?", "I cannot verify pantry and meal plan together for ingredient shortages yet");
    await ask("What ingredients are missing for today's meals?", "I cannot verify pantry and meal plan together for ingredient shortages yet");
    assert.equal(await page.evaluate(() => localStorage.getItem("balkanbite_mealplan")),
      '[{"date":"2026-02-30"}]', "menu refusal must preserve unknown original bytes");
    assert.equal(await page.evaluate(() => localStorage.getItem("balkanbite_progression")),
      '[{"legacy":"unverified"}]', "read-only query preserves raw unknown historical evidence");
    assert.equal(await page.evaluate(MAIN => localStorage.getItem(MAIN), MAIN), before.pantry,
      "read-only query cannot rewrite pantry");
    assert.equal(aiRequests, 0, "unverified data cannot trigger an AI guess");
    assert.equal(await page.evaluate(() => localStorage.getItem("balkanbite_shopping")),
      '[{"legacy":"unverified"}]', "failed-closed shopping list must preserve unverified bytes");
    evidence.checks.push("chef-shopping-independent-of-broken-progression-and-fails-on-corrupt-shopping");
    evidence.checks.push("chef-menu-independent-of-invalid-progress-shopping-but-rejects-invalid-menu");
    evidence.checks.push("chef-progress-independent-of-invalid-shopping-but-rejects-invalid-ledger");
    evidence.checks.push("chef-shortages-read-verified-pantry-menu-with-invalid-shopping-progress-and-refuse-invalid-menu");
  } finally {
    await Promise.all(pages.map(page => page.close().catch(() => {})));
    await context.close();
  }
}

async function runChefGroundedPantryQuestions() {
  const context = await browser.newContext();
  const pages = [];
  let aiRequests = 0;
  const MARKER = "balkanbite_guest_cook_intent_v1";
  const SHOPPING = "balkanbite_shopping";
  const today = new Date();
  const capture = [
    today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  const recorded = [
    { ...valid, quantity: 150, addedAt: capture, expiryDaysLeft: 1 },
    {
      id: "qa-facts-salt", name: "QA Salt", quantity: 1, unit: "kg",
      category: "Other", addedAt: capture,
    },
    {
      id: "qa-facts-yogurt", name: "QA Yogurt", quantity: 0.5, unit: "kg",
      category: "Dairy", addedAt: capture, expiryDaysLeft: 1,
      expiryIsPartial: true,
    },
  ];
  try {
    await context.addInitScript(({ MAIN, SHOPPING, recorded }) => {
      if (sessionStorage.getItem("__qa_grounded_facts_seeded")) return;
      sessionStorage.setItem("__qa_grounded_facts_seeded", "yes");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify(recorded));
      localStorage.setItem(SHOPPING, "[]");
      localStorage.setItem("balkanbite_mealplan", "[]");
      localStorage.setItem("balkanbite_recipes", "[]");
      localStorage.setItem("balkanbite_progression", "[]");
    }, { MAIN, SHOPPING, recorded });
    await context.route("**/api/ai/parse-intent", route => {
      aiRequests++;
      return route.fulfill({ status: 503, contentType: "application/json",
        body: JSON.stringify({ success: false, error: "synthetic AI unavailable" }) });
    });
    const page = await context.newPage();
    pages.push(page);
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.locator("#chef-ia-floating-btn").click();
    await page.locator("#chef-ia-modal-panel").waitFor({ state: "visible", timeout: 15000 });

    const question = async (text, expected) => {
      await page.locator("#voice-text-input").fill(text);
      await page.locator("#voice-send-btn").click();
      await page.getByText(expected, { exact: false })
        .waitFor({ state: "visible", timeout: 15000 });
    };
    const original = await page.evaluate(({ MAIN, SHOPPING }) => ({
      pantry: localStorage.getItem(MAIN),
      shopping: localStorage.getItem(SHOPPING),
    }), { MAIN, SHOPPING });
    await question("What is in my pantry?", "3 recorded products");
    await page.getByText("QA Rice (150 g)", { exact: false }).waitFor({ state: "visible" });
    await question("What expires soon?", "2 products without reliable expiry data");
    await page.getByText("QA Rice (in 1 day)", { exact: false }).waitFor({ state: "visible" });
    assert.equal(aiRequests, 0, "grounded read-only questions must never reach AI");
    assert.deepEqual(await page.evaluate(({ MAIN, SHOPPING }) => ({
      pantry: localStorage.getItem(MAIN), shopping: localStorage.getItem(SHOPPING),
    }), { MAIN, SHOPPING }), original, "read-only facts cannot mutate pantry/shopping");

    // The second real tab stages a guest WAL *after* the first tab hydrated.
    // Chef must not answer stale inventory facts or silently clear this marker.
    const other = await context.newPage();
    pages.push(other);
    await other.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await other.evaluate(MARKER =>
      localStorage.setItem(MARKER, "{unreviewed-second-tab-intent"), MARKER);
    await question("What do I have in my pantry?", "I cannot verify your pantry yet");
    assert.equal(aiRequests, 0, "an unresolved second-tab journal cannot trigger an AI guess");
    assert.equal(await page.evaluate(MARKER => localStorage.getItem(MARKER), MARKER),
      "{unreviewed-second-tab-intent",
      "read-only query must preserve unknown WAL evidence for recovery");
    assert.equal(await page.evaluate(MAIN => localStorage.getItem(MAIN), MAIN),
      original.pantry, "stale query cannot rewrite stock evidence");
    evidence.checks.push("chef-grounded-pantry-expiry-no-ai-and-cross-tab-unknown");
  } finally {
    await Promise.all(pages.map(page => page.close().catch(() => {})));
    await context.close();
  }
}

async function runChefReadOnlyNavigationAndFailure() {
  const context = await browser.newContext();
  let page;
  let parseIntentRequests = 0;
  try {
    await context.addInitScript(({ MAIN, valid }) => {
      window.__qaMicAbortCount = 0;
      window.__qaMicStartCount = 0;
      window.SpeechRecognition = class {
        start() {
          window.__qaMicStartCount++;
          this.onstart?.();
        }
        stop() { this.onend?.(); }
        abort() { window.__qaMicAbortCount++; }
      };
      if (sessionStorage.getItem("__qa_chef_navigation_seeded")) return;
      sessionStorage.setItem("__qa_chef_navigation_seeded", "true");
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({
        language: "en", onboardingCompleted: true,
      }));
      localStorage.setItem(MAIN, JSON.stringify([valid]));
      localStorage.setItem("balkanbite_shopping", "[]");
      localStorage.setItem("balkanbite_mealplan", "[]");
      localStorage.setItem("balkanbite_recipes", "[]");
      localStorage.setItem("balkanbite_progression", "[]");
    }, { MAIN, valid });
    await context.route("**/api/ai/parse-intent", async route => {
      parseIntentRequests++;
      await route.fulfill({
        status: 503, contentType: "application/json",
        body: JSON.stringify({
          success: false, error: "Synthetic unavailable AI",
          actionType: "ANSWER", items: [], mealLog: null,
        }),
      });
    });
    page = await context.newPage();
    page.on("dialog", dialog => dialog.dismiss());
    await page.goto(new URL("/", base).toString(), {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    const before = await page.evaluate(MAIN => localStorage.getItem(MAIN), MAIN);
    await page.locator("#chef-ia-floating-btn").click();
    await page.locator("#chef-ia-modal-panel").waitFor({ state: "visible", timeout: 15000 });
    await page.locator("#voice-mic-main-btn").click();
    assert.equal(await page.evaluate(() => window.__qaMicStartCount), 1,
      "synthetic recognizer started inside Chef overlay");
    await page.locator("#voice-text-input").fill("Show me my pantry");
    await page.locator("#voice-send-btn").click();
    await page.locator("#chef-ia-modal-panel").waitFor({ state: "hidden", timeout: 15000 });
    assert.equal(await page.evaluate(() => window.__qaMicAbortCount), 1,
      "moving to a new screen must abort recognizer on Chef unmount");
    await page.locator(`#pantry-item-${valid.id}`).waitFor({ state: "visible", timeout: 15000 });
    assert.equal(parseIntentRequests, 0, "read-only navigation must not call paid or unavailable AI");
    assert.equal(await page.evaluate(MAIN => localStorage.getItem(MAIN), MAIN), before,
      "navigation cannot mutate known pantry quantities");
    await page.locator("#chef-ia-floating-btn").click();
    await page.getByText("Opening your pantry.", { exact: true })
      .waitFor({ state: "visible", timeout: 15000 });
    await page.locator("#voice-text-input").fill("What could I cook this weekend?");
    await page.locator("#voice-send-btn").click();
    await page.getByText("Sorry, I had a brief issue processing that. Please try again.", {
      exact: true,
    }).waitFor({ state: "visible", timeout: 15000 });
    assert.equal(parseIntentRequests, 1, "non-navigation request must reach existing interpreter");
    assert.equal(await page.getByText("Got it! Processed your request.", { exact: true }).count(), 0,
      "HTTP 503 cannot masquerade as a successful command");
    assert.equal(await page.evaluate(MAIN => localStorage.getItem(MAIN), MAIN), before,
      "an AI failure cannot overwrite pantry evidence");
    evidence.checks.push("chef-local-navigation-visible-no-ai-and-http-failure-honest");
  } finally {
    await page?.close().catch(() => {});
    await context.close();
  }
}

try {
  await runGuestPantryAddEditDeleteReload();
  await runGuestLocalExportDownload();
  await runChefReadOnlyNavigationAndFailure();
  await runChefGroundedPantryQuestions();
  await runChefWorkspaceFacts();
  await runTwoTabVoicePurchaseRecovery();
  await runTwoTabStaleInventory();
  await runTwoTabDerivedChangeBlocksGuestFacts();
  await runTwoTabExternalStorageClearBlocksGuestFacts();
  await runTwoTabStaleShoppingAdd();
  await runTwoTabStaleShoppingDestructiveMutations();
  await runLateGuestJournalPreventsLegacyWrite("legacy-pantry");
  await runLateGuestJournalPreventsLegacyWrite("shopping-effect");
  await runFailedGuestQuantityWrite();
  await runFailedGuestQuantityWrite({ silent: true });
  await runGuestDerivedShoppingSilentFailure();
  await runGuestManualShoppingAddLostWrite();
  await runBulgarianManualShoppingUnits();
  await runGuestShoppingToggleSilentWriteFailure();
  await runGuestShoppingDeleteSilentWriteFailure();
  await runGuestShoppingClearSilentWriteFailure();
  await runGuestDerivedWriteWarningCannotBeCleared("balkanbite_mealplan");
  await runGuestDerivedWriteWarningCannotBeCleared("balkanbite_recipes");
  await runRealQuantityJournalCommit();
  await runRealQuantityJournalCommit({ silentShoppingFailure: true });
  await runMalformedGuestShoppingOnStartup();
  await runCorruptedGuestPurchaseIntentAtStartup();
  await runRealGuestPurchaseIntent();
  await runRealGuestPurchaseIntent({ fault: "balkanbite_shopping" });
  await runRealGuestPurchaseIntent({ fault: "balkanbite_progression" });
  await runRealGuestCookIntent();
  await runRealGuestCookIntent({ silentProgressionFailure: true });
  await runRealGuestVoiceRemoval();
  await runRealGuestVoiceRemoval({ fault: "balkanbite_shopping", purpose: "discard" });
  await runRealGuestDerivedCook();
  await runGuestMealToPurchaseCircuit();
  await runGuestMealToPurchaseCircuit({ language: "bg", mobile: true });
  await runGuestMealToPurchaseCircuit({ language: "bg", mobile: true, mobileWidth: 320 });
  await runRealGuestDerivedCook({ fault: "balkanbite_mealplan" });
  await runRealGuestDerivedCook({ fault: "balkanbite_shopping" });
  // Persisted derivative write-loss paths recover via the same durable cook intent.
  await runRealGuestDerivedCook({ fault: "balkanbite_recipes" });
  await runRealGuestDerivedCook({ fault: "balkanbite_progression" });
  for (const mode of ["applied", "unapplied", "conflict", "malformed"]) {
    await runGuestJournalHydration(mode);
  }
  const mixed = JSON.stringify([valid, { id: "qa-unknown", note: "keep original untouched" }]);
  await run({ original: mixed });
  await run({ original: "{ malformed original text", expectedExtension: "txt", expectedItems: [] });
  await run({
    original: JSON.stringify([{ id: "qa-new-unknown" }]),
    previousBackup: JSON.stringify([{ id: "older-quarantined-record" }]),
    expectedBlocked: true,
  });

  evidence.result = "PASS";
  console.log("Guest pantry recovery local browser acceptance: PASS");
} catch (error) {
  evidence.result = "FAIL";
  evidence.error = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  await fs.writeFile(path.join(output, "guest-pantry-recovery-result.json"), JSON.stringify(evidence, null, 2));
  await browser.close();
}
