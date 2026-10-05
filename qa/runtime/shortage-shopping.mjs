import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.QA_PREVIEW_URL;
const sha = process.env.QA_EXPECTED_SHA;
if (!base || !sha) throw new Error("QA_PREVIEW_URL and QA_EXPECTED_SHA are required");
const url = new URL(base);
if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
  throw new Error("Shortage shopping QA requires isolated local preview");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const value = async id => (await page.getByTestId(id).textContent())?.trim();

try {
  await page.goto(new URL("/__qa/shortage-shopping", url).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  const root = page.getByTestId("qa-shortage-shopping-root");
  await root.waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await root.getAttribute("data-deployment-sha"), sha);
  assert.equal(await value("qa-shortage-count"), "0");
  assert.equal(await value("qa-manual-count"), "1");

  await page.getByRole("button", { name: "Set shortage 1L" }).click();
  assert.equal(await value("qa-shortage-count"), "1");
  assert.equal(await value("qa-shortage-quantity"), "1");
  assert.equal(await value("qa-purchase-confirmed"), "false");

  // Repeating the same target remains one managed row.
  await page.getByRole("button", { name: "Set shortage 1L" }).click();
  assert.equal(await value("qa-shortage-count"), "1");

  await page.getByRole("button", { name: "Update shortage 0.5L" }).click();
  assert.equal(await value("qa-shortage-count"), "1");
  assert.equal(await value("qa-shortage-quantity"), "0.5");

  await page.getByRole("button", { name: "Resolve shortage" }).click();
  assert.equal(await value("qa-shortage-count"), "0");
  assert.equal(await value("qa-manual-count"), "1");

  console.log("Shortage shopping local browser acceptance: PASS");
} finally {
  await browser.close();
}
