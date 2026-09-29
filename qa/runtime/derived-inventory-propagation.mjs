import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.QA_PREVIEW_URL;
const sha = process.env.QA_EXPECTED_SHA;
if (!base || !sha) throw new Error("QA_PREVIEW_URL and QA_EXPECTED_SHA are required");

const url = new URL(base);
if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
  throw new Error("Derived propagation QA must run against isolated local preview");
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(new URL("/__qa/derived-inventory-propagation", url).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  const root = page.getByTestId("qa-derived-propagation-root");
  await root.waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await root.getAttribute("data-deployment-sha"), sha);

  const value = async id => (await page.getByTestId(id).textContent())?.trim();

  assert.equal(await value("qa-derived-recipe-ready"), "true");
  assert.equal(await value("qa-derived-plan-ready"), "true");
  assert.equal(await value("qa-derived-reconciliations"), "0");
  assert.equal(await value("qa-derived-stock"), "200");

  await page.getByRole("button", { name: "Stage provisional deduction" }).click();
  assert.equal(await value("qa-derived-recipe-ready"), "true");
  assert.equal(await value("qa-derived-plan-ready"), "true");
  assert.equal(await value("qa-derived-reconciliations"), "0");
  assert.equal(await value("qa-derived-stock"), "200");

  await page.getByRole("button", { name: "Confirm server snapshot" }).click();
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="qa-derived-reconciliations"]')
      ?.textContent?.trim() === "1",
  );

  assert.equal(await value("qa-derived-stock"), "100");
  assert.equal(await value("qa-derived-recipe-ready"), "false");
  assert.equal(await value("qa-derived-plan-ready"), "false");
  assert.equal(await value("qa-derived-reconciliations"), "1");

  console.log("Server-confirmed derived inventory browser acceptance: PASS");
} finally {
  await context.close();
  await browser.close();
}
