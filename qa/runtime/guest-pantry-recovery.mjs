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
    await page.getByTestId("guest-pantry-recovery").getByText(/could not be protected/i).waitFor({ state: "visible", timeout: 12000 });
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

    const guestDialogs = [];
    for (let index = 0; index < 2; index++) {
      const page = await context.newPage();
      pages.push(page);
      page.on("dialog", dialog => {
        guestDialogs.push({ index, message: dialog.message() });
        return dialog.dismiss();
      });
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
    await stale.waitForTimeout(550);
    const staleDiagnostic = await stale.evaluate(MAIN => ({
      persisted: localStorage.getItem(MAIN),
      warnings: [...document.querySelectorAll(
        '[data-testid="guest-pantry-recovery"], [data-testid="guest-shopping-consistency-warning"], [data-testid="guest-journal-recovery-warning"]',
      )].map(el => el.textContent),
    }), MAIN);
    console.log("QA two-tab stale rejection diagnostic", JSON.stringify({
      ...staleDiagnostic, dialogs: guestDialogs,
    }));
    // Both the original single-key guard and the new journal preflight reject
    // stale second-tab stock. They surface different but explicit UI warnings.
    await stale.locator(
      '[data-testid="guest-pantry-recovery"], [data-testid="guest-shopping-consistency-warning"], [data-testid="guest-journal-recovery-warning"]',
    ).filter({ hasText: /could not be protected|not safely synchronized|unfinished local operation|shopping list could not be confirmed/i })
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

try {
  await runGuestPantryAddEditDeleteReload();
  await runTwoTabStaleInventory();
  await runFailedGuestQuantityWrite();
  await runFailedGuestQuantityWrite({ silent: true });
  await runGuestDerivedShoppingSilentFailure();
  await runRealQuantityJournalCommit();
  await runRealQuantityJournalCommit({ silentShoppingFailure: true });
  await runMalformedGuestShoppingOnStartup();
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
