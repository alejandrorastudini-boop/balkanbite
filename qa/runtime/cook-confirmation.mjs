import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.QA_PREVIEW_URL;
const sha = process.env.QA_EXPECTED_SHA;
const output = process.env.QA_ARTIFACT_DIR || "artifacts/runtime-qa-local";
if (!base || !sha) throw new Error("QA_PREVIEW_URL and QA_EXPECTED_SHA are required");
const url = new URL(base);
if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
  throw new Error("Cook confirmation QA must run against an isolated local preview");
}
const target = new URL("/__qa/cook-confirmation", url).toString();
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const evidence = { buildSha: sha, scenario: "synthetic-cook-confirmation", result: "running" };
const context = await browser.newContext();
const page = await context.newPage();
try {
  await context.route("https://images.unsplash.com/**", route =>
    route.fulfill({ status: 200, contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' }));
  await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
  const root = page.getByTestId("qa-cook-confirmation-root");
  await root.waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await root.getAttribute("data-deployment-sha"), sha);

  const number = async (id) => {
    const value = Number((await page.getByTestId(id).textContent())?.trim());
    assert.ok(Number.isFinite(value), id + " must be numeric");
    return value;
  };

  // Cancellation never reaches the deduction callback.
  assert.equal(await number("qa-cook-stock"), 250);
  await page.locator("#cook-btn-qa-rice-available").click();
  const confirmTitle = page.getByText("Have you cooked this recipe?");
  await confirmTitle.waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Cancel" }).click();
  assert.equal(await number("qa-cook-stock"), 250);
  assert.equal(await number("qa-cook-attempts"), 0);
  evidence.cancelLeavesStockUntouched = true;

  // Two rapid native clicks in the same dialog dispatch the callback once.
  await page.locator("#cook-btn-qa-rice-available").click();
  await confirmTitle.waitFor({ state: "visible" });
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")]
      .find(item => item.textContent?.trim() === "Yes, deduct");
    if (!button) throw new Error("Expected explicit cook confirmation button");
    button.click();
    button.click();
  });
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="qa-cook-successes"]')?.textContent?.trim() === "1");
  assert.equal(await number("qa-cook-stock"), 150);
  assert.equal(await number("qa-cook-attempts"), 1);
  evidence.rapidDoubleConfirmDeductsOnce = true;

  // Insufficient stock is rejected atomically.
  await page.locator("#cook-btn-qa-rice-insufficient").click();
  await confirmTitle.waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Yes, deduct" }).click();
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="qa-cook-attempts"]')?.textContent?.trim() === "2");
  assert.equal(await number("qa-cook-stock"), 150);
  assert.equal(await number("qa-cook-successes"), 1);
  assert.equal((await page.getByTestId("qa-cook-outcome").textContent())?.trim(), "rejected");
  evidence.insufficientStockFailsClosed = true;

  // Failure from the recipe drawer must not silently close that drawer.
  await page.locator("#recipe-card-qa-rice-insufficient")
    .getByRole("button", { name: "Recipe & Steps" }).click();
  await page.locator("div.fixed.inset-0").getByRole("heading", { name: "QA Rice Insufficient" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Cook This Meal" }).last().click();
  await confirmTitle.waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Yes, deduct" }).click();
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="qa-cook-attempts"]')?.textContent?.trim() === "3");
  assert.equal(await number("qa-cook-stock"), 150);
  await page.locator("div.fixed.inset-0").getByRole("heading", { name: "QA Rice Insufficient" }).waitFor({ state: "visible" });
  await page.locator('p[role="alert"]').filter({ hasText: "cannot be safely deducted" })
    .waitFor({ state: "visible" });
  evidence.failedDrawerCookKeepsRecipeOpen = true;

  evidence.result = "PASS";
  await page.screenshot({ path: path.join(output, "cook-confirmation.png"), fullPage: true });
  console.log("Cook confirmation local browser acceptance: PASS");
} catch (error) {
  evidence.result = "FAIL";
  evidence.error = error instanceof Error ? error.message : String(error);
  await page.screenshot({ path: path.join(output, "cook-confirmation-failure.png"), fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  await fs.writeFile(path.join(output, "cook-confirmation-result.json"),
    JSON.stringify(evidence, null, 2));
  await context.close();
  await browser.close();
}
