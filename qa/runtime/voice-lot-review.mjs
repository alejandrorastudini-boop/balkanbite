import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.QA_PREVIEW_URL;
const sha = process.env.QA_EXPECTED_SHA;
if (!base || !sha) throw new Error("QA_PREVIEW_URL and QA_EXPECTED_SHA are required");
const url = new URL(base);
if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Voice lot QA requires isolated local preview");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const value = async id => (await page.getByTestId(id).textContent())?.trim();

try {
  await page.goto(new URL("/__qa/voice-lot-review", url).toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
  const root = page.getByTestId("qa-voice-lot-root");
  await root.waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await root.getAttribute("data-deployment-sha"), sha);

  // Cancel never confirms anything.
  await page.getByRole("button", { name: "Review food use" }).click();
  await page.getByRole("heading", { name: "Which purchase did you use for each food?" }).waitFor();
  await page.getByRole("button", { name: "Cancel" }).last().click();
  assert.equal(await value("qa-voice-lot-attempts"), "0");

  // Multi-lot exact requires the explicit 0.4 + 0.3 = 0.7 allocation.
  await page.getByRole("button", { name: "Review food use" }).click();
  const confirmUse = page.getByRole("button", { name: "Confirm use" });
  assert.equal(await confirmUse.isDisabled(), true);
  await page.getByLabel("Used 2026-10-01").fill("0.4");
  assert.equal(await confirmUse.isDisabled(), true);
  await page.getByLabel("Used 2026-10-02").fill("0.3");
  assert.equal(await confirmUse.isDisabled(), false);
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find(item => item.textContent?.trim() === "Confirm use");
    if (!button) throw new Error("confirm use missing");
    button.click();
    button.click();
  });
  await page.waitForFunction(() => document.querySelector('[data-testid="qa-voice-lot-successes"]')?.textContent?.trim() === "1");
  assert.equal(await value("qa-voice-lot-attempts"), "1");
  assert.equal(await value("qa-voice-lot-outcome"), "exact");
  const exactEvidence = JSON.parse(await value("qa-voice-lot-evidence"));
  assert.deepEqual(exactEvidence[0].deductions, [{ lotId: "lot-a", quantity: 0.4 }, { lotId: "lot-b", quantity: 0.3 }]);

  // Unknown remains aggregate and never fabricates a lot.
  await page.getByRole("button", { name: "Review food use" }).click();
  await page.getByText("I don't know", { exact: true }).click();
  await page.getByRole("button", { name: "Confirm use" }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="qa-voice-lot-successes"]')?.textContent?.trim() === "2");
  assert.equal(await value("qa-voice-lot-outcome"), "aggregate");
  assert.equal(await value("qa-voice-lot-evidence"), "aggregate");

  // Discard explicitly exposes an expired persisted lot and accepts it.
  await page.getByRole("button", { name: "Review discard" }).click();
  await page.getByText("Expired", { exact: true }).waitFor();
  const confirmDiscard = page.getByRole("button", { name: "Confirm discard" });
  await page.getByLabel("Discarded 2026-09-20").fill("0.2");
  assert.equal(await confirmDiscard.isDisabled(), false);
  await confirmDiscard.click();
  await page.waitForFunction(() => document.querySelector('[data-testid="qa-voice-lot-successes"]')?.textContent?.trim() === "3");
  assert.equal(await value("qa-voice-lot-outcome"), "exact");
  const discardEvidence = JSON.parse(await value("qa-voice-lot-evidence"));
  assert.equal(discardEvidence[0].purpose, "discard");
  assert.deepEqual(discardEvidence[0].deductions, [{ lotId: "lot-expired", quantity: 0.2 }]);

  console.log("Voice exact-lot review local browser acceptance: PASS");
} finally {
  await context.close();
  await browser.close();
}
