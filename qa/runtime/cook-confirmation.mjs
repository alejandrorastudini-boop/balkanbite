import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.QA_PREVIEW_URL;
const sha = process.env.QA_EXPECTED_SHA;
const output =
  process.env.QA_ARTIFACT_DIR || "artifacts/runtime-qa-local";
if (!base || !sha) {
  throw new Error("QA_PREVIEW_URL and QA_EXPECTED_SHA are required");
}

const url = new URL(base);
if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
  throw new Error(
    "Cook confirmation QA must run against an isolated local preview",
  );
}
const target = new URL("/__qa/cook-confirmation", url).toString();

await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const evidence = {
  buildSha: sha,
  scenario: "async-cook-confirmation",
  result: "running",
};

try {
  await context.route("https://images.unsplash.com/**", route =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body:
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
    }),
  );

  await page.goto(target, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  const root = page.getByTestId("qa-cook-confirmation-root");
  await root.waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await root.getAttribute("data-deployment-sha"), sha);

  const number = async testId => {
    const value = Number(
      (await page.getByTestId(testId).textContent())?.trim(),
    );
    assert.ok(Number.isFinite(value), testId + " must be numeric");
    return value;
  };
  const text = async testId =>
    (await page.getByTestId(testId).textContent())?.trim() || "";

  const confirmTitle = page.getByText(
    "Have you cooked this recipe?",
  );
  const confirmButton = page.getByRole("button", {
    name: "Yes, deduct",
  });
  const cancelButton = page.getByRole("button", { name: "Cancel" });

  // Staging/cancel never reaches the cook callback.
  assert.equal(await number("qa-cook-stock"), 250);
  await page.locator("#cook-btn-qa-rice-available").click();
  await confirmTitle.waitFor({ state: "visible" });
  await cancelButton.click();
  assert.equal(await number("qa-cook-stock"), 250);
  assert.equal(await number("qa-cook-attempts"), 0);
  evidence.cancelLeavesStockUntouched = true;

  // Two native clicks in the same tick can dispatch only one Promise.
  await page.locator("#cook-btn-qa-rice-available").click();
  await confirmTitle.waitFor({ state: "visible" });
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find(
      item => item.textContent?.trim() === "Yes, deduct",
    );
    if (!button) throw new Error("Expected cook confirmation button");
    button.click();
    button.click();
  });

  await page.waitForFunction(() =>
    document.querySelector('[data-testid="qa-cook-attempts"]')
      ?.textContent?.trim() === "1",
  );
  const busyModal = confirmTitle.locator("xpath=ancestor::div[@aria-busy][1]");
  assert.equal(await busyModal.getAttribute("aria-busy"), "true");
  assert.equal(await confirmButton.isDisabled(), true);
  assert.equal(await cancelButton.isDisabled(), true);
  assert.equal(await text("qa-cook-outcome"), "pending");

  await page.waitForFunction(() =>
    document.querySelector('[data-testid="qa-cook-successes"]')
      ?.textContent?.trim() === "1",
  );
  await confirmTitle.waitFor({ state: "hidden" });
  assert.equal(await number("qa-cook-stock"), 150);
  assert.equal(await number("qa-cook-attempts"), 1);
  evidence.doubleConfirmDispatchesOnce = true;
  evidence.pendingControlsLocked = true;

  // Failure returns false: keep the review open with the same mutation ID.
  await page.locator("#cook-btn-qa-rice-insufficient").click();
  await confirmTitle.waitFor({ state: "visible" });
  await confirmButton.click();
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="qa-cook-outcome"]')
      ?.textContent?.trim() === "rejected",
  );
  assert.equal(await number("qa-cook-stock"), 150);
  assert.equal(await number("qa-cook-attempts"), 2);
  assert.equal(await number("qa-cook-successes"), 1);
  await confirmTitle.waitFor({ state: "visible" });

  const failedId = await text("qa-cook-last-id");
  assert.ok(failedId.startsWith("cook-"));
  await confirmButton.click();
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="qa-cook-attempts"]')
      ?.textContent?.trim() === "3",
  );
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="qa-cook-same-id-retries"]')
      ?.textContent?.trim() === "1",
  );
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="qa-cook-outcome"]')
      ?.textContent?.trim() === "rejected",
  );
  assert.equal(await text("qa-cook-last-id"), failedId);
  await confirmTitle.waitFor({ state: "visible" });
  evidence.failureKeepsReviewOpen = true;
  evidence.retryUsesSameConfirmationId = true;
  await cancelButton.click();

  // A failed cook initiated from the recipe drawer must not close the drawer.
  const card = page.locator("#recipe-card-qa-rice-insufficient");
  await card.getByRole("button", { name: "Recipe & Steps" }).click();
  const drawerHeading = page.getByRole("heading", {
    name: "QA Rice Insufficient",
  });
  await drawerHeading.waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Cook This Meal" }).last().click();
  await confirmTitle.waitFor({ state: "visible" });
  await confirmButton.click();
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="qa-cook-attempts"]')
      ?.textContent?.trim() === "4",
  );
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="qa-cook-outcome"]')
      ?.textContent?.trim() === "rejected",
  );
  await confirmTitle.waitFor({ state: "visible" });
  await cancelButton.click();
  await drawerHeading.waitFor({ state: "visible" });
  await page.locator('p[role="alert"]')
    .filter({ hasText: "cannot be safely deducted" })
    .waitFor({ state: "visible" });
  evidence.failedDrawerCookStaysOpen = true;

  evidence.result = "PASS";
  await page.screenshot({
    path: path.join(output, "cook-confirmation.png"),
    fullPage: true,
  });
  console.log("Async cook confirmation local browser acceptance: PASS");
} catch (error) {
  evidence.result = "FAIL";
  evidence.error =
    error instanceof Error ? error.message : String(error);
  await page.screenshot({
    path: path.join(output, "cook-confirmation-failure.png"),
    fullPage: true,
  }).catch(() => {});
  throw error;
} finally {
  await fs.writeFile(
    path.join(output, "cook-confirmation-result.json"),
    JSON.stringify(evidence, null, 2),
  );
  await context.close();
  await browser.close();
}
