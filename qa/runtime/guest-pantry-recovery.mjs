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
  try {
    const raw = JSON.stringify([valid]);
    await context.addInitScript(({ MAIN, raw }) => {
      localStorage.setItem("balkanbite_show_landing", "false");
      localStorage.setItem("balkanbite_profile", JSON.stringify({ language: "en", onboardingCompleted: true }));
      localStorage.setItem(MAIN, raw);
    }, { MAIN, raw });
    page = await context.newPage();
    page.on("dialog", dialog => dialog.dismiss());
    await page.goto(new URL("/", base).toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("#nav-tab-pantry").click();
    await page.getByText("QA Rice", { exact: true }).waitFor({ state: "visible", timeout: 15000 });
    await page.getByRole("button", { name: "Increase quantity" }).waitFor({ state: "visible", timeout: 15000 });
    const before = await page.evaluate(MAIN => localStorage.getItem(MAIN), MAIN);
    assert.equal(before, raw);

    // The guest write fails AFTER app hydration, like a quota/security error
    // on a real mutation. A successful React update must never be claimed.
    await page.evaluate(({ MAIN, silent }) => {
      const nativeSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === MAIN) {
          if (silent) return;
          throw new DOMException("local storage quota reached", "QuotaExceededError");
        }
        return nativeSetItem.call(this, key, value);
      };
    }, { MAIN, silent });

    await page.getByRole("button", { name: "Increase quantity" }).click();
    // The old direct writer and new journal writer signal storage failure in
    // different banners. The assertions below still require unchanged bytes
    // and unchanged displayed stock, never an optimistic write.
    await page.locator(
      '[data-testid="guest-pantry-recovery"], [data-testid="guest-shopping-consistency-warning"], [data-testid="guest-journal-recovery-warning"]',
    ).filter({ hasText: /could not be protected|pantry and shopping consistency could not be confirmed|unfinished local operation/i })
      .first().waitFor({ state: "visible", timeout: 12000 });
    const after = await page.evaluate(MAIN => localStorage.getItem(MAIN), MAIN);
    assert.equal(after, before, "failed writes must keep original storage");
    const riceCard = page.getByText("QA Rice", { exact: true }).locator("xpath=ancestor::div[contains(@class, 'group')][1]");
    await riceCard.getByText("500", { exact: false }).first().waitFor({ state: "visible", timeout: 5000 });
    assert.equal(await page.getByText("550", { exact: false }).count(), 0, "failed quantity must not appear as confirmed stock");
    evidence.checks.push(silent
      ? "silent-write-rejected-no-optimistic-stock"
      : "failed-mutation-preserves-stock-and-storage");
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

    // The second tab loaded 500g, so overwriting 550g must fail closed.
    await increment(stale).click();
    // Both the original single-key guard and the new journal preflight reject
    // stale second-tab stock. They surface different but explicit UI warnings.
    await stale.locator(
      '[data-testid="guest-pantry-recovery"], [data-testid="guest-shopping-consistency-warning"], [data-testid="guest-journal-recovery-warning"]',
    ).filter({ hasText: /could not be protected|not safely synchronized|unfinished local operation|pantry and shopping consistency could not be confirmed/i })
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
    evidence.checks.push("stale-second-tab-cannot-overwrite-newer-stock");
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

async function runChefReadOnlyNavigationAndFailure() {
  const context = await browser.newContext();
  let page;
  let parseIntentRequests = 0;
  try {
    await context.addInitScript(({ MAIN, valid }) => {
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
    await page.locator("#voice-text-input").fill("Show me my pantry");
    await page.locator("#voice-send-btn").click();
    await page.locator("#chef-ia-modal-panel").waitFor({ state: "hidden", timeout: 15000 });
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
  await runChefReadOnlyNavigationAndFailure();
  await runTwoTabVoicePurchaseRecovery();
  await runTwoTabStaleInventory();
  await runLateGuestJournalPreventsLegacyWrite("legacy-pantry");
  await runLateGuestJournalPreventsLegacyWrite("shopping-effect");
  await runFailedGuestQuantityWrite();
  await runFailedGuestQuantityWrite({ silent: true });
  await runGuestDerivedShoppingSilentFailure();
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
  await runRealGuestDerivedCook({ fault: "balkanbite_mealplan" });
  await runRealGuestDerivedCook({ fault: "balkanbite_shopping" });
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
