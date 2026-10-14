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

try {
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
