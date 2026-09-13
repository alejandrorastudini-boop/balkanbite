import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = "http://127.0.0.1:3000";

async function newGuestPage(browser, shopping = []) {
  const context = await browser.newContext();
  const page = await context.newPage();
  // Seed test state exactly once. Do NOT use addInitScript here: it would run
  // again on every reload and would erase the very persistence we are testing.
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate((seedShopping) => {
    localStorage.clear();
    localStorage.setItem("balkanbite_show_landing", "false");
    localStorage.setItem("balkanbite_shopping", JSON.stringify(seedShopping));
  }, shopping);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#nav-tab-shopping").waitFor({ state: "visible" });
  return { context, page };
}

async function goShopping(page) {
  await page.locator("#nav-tab-shopping").click();
  await page.locator("#shopping-view").waitFor({ state: "visible" });
}

async function openReview(page, phrase) {
  await goShopping(page);
  await page.locator("#voice-shopping-reconcile-banner-btn").click();
  const panel = page.locator("#voice-shopping-modal-panel");
  await panel.waitFor({ state: "visible" });
  await panel.locator("textarea").fill(phrase);
  await panel.getByRole("button", { name: /Procesar Compra/i }).click();
  await panel.getByText(/Análisis de Compra — Revisa antes de guardar/i).waitFor({ state: "visible" });
  return panel;
}

async function confirm(panel) {
  await panel.getByRole("button", { name: /Confirmar y Pasar a Despensa/i }).click();
  await panel.waitFor({ state: "hidden" });
}

async function readPantry(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("balkanbite_pantry") || "[]"));
}

async function readShopping(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("balkanbite_shopping") || "[]"));
}

async function waitForPantry(page, predicateSource) {
  await page.waitForFunction((source) => {
    const pantry = JSON.parse(localStorage.getItem("balkanbite_pantry") || "[]");
    return Function("pantry", `return (${source})(pantry)`)(pantry);
  }, predicateSource);
}

const browser = await chromium.launch({ headless: true });
try {
  // A. Existing product in Compras; list quantity/unit are authoritative.
  // Also covers persistence and practical phrase replay after the row is gone.
  {
    const shopping = [{
      id: "qa-tomato",
      name: "Tomate",
      quantity: 2,
      unit: "uds",
      category: "Produce",
      estimatedPriceEUR: 0,
      checked: false,
      reason: "QA",
    }];
    const { context, page } = await newGuestPage(browser, shopping);
    let panel = await openReview(page, "He comprado tomate");
    await panel.getByText(/Comprados de la lista \(1\)/i).waitFor({ state: "visible" });
    await panel.getByText(/Tomate \(2\s+uds\)/i).waitFor({ state: "visible" });
    await confirm(panel);

    await waitForPantry(page, `(pantry) => pantry.some((i) => i.name === "Tomate" && i.quantity === 6 && i.unit === "uds")`);
    let pantry = await readPantry(page);
    assert.equal(pantry.filter((i) => i.name === "Tomate" && i.unit === "uds").length, 1);
    assert.equal(pantry.find((i) => i.name === "Tomate" && i.unit === "uds").quantity, 6);
    assert.equal((await readShopping(page)).some((i) => i.id === "qa-tomato"), false);

    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#nav-tab-shopping").waitFor({ state: "visible" });
    pantry = await readPantry(page);
    assert.equal(pantry.find((i) => i.name === "Tomate" && i.unit === "uds").quantity, 6, "Tomate 6 uds must persist after reload");
    assert.equal((await readShopping(page)).some((i) => i.id === "qa-tomato"), false, "accepted shopping row must stay removed after reload");

    panel = await openReview(page, "He comprado tomate");
    await confirm(panel);
    await page.waitForTimeout(150);
    pantry = await readPantry(page);
    assert.equal(pantry.find((i) => i.name === "Tomate" && i.unit === "uds").quantity, 6, "repeating phrase without a remaining shopping row must not double-add stock");
    await context.close();
  }

  // B. Explicit extra: user transcript amount overrides fallback's fabricated
  // defaults; price/expiry never become pantry facts; compatible and incompatible
  // units are handled deterministically; persistence survives reload.
  {
    const { context, page } = await newGuestPage(browser);
    let panel = await openReview(page, "Compré 2 uds de aguacate");
    let extra = panel.locator("button").filter({ hasText: /Aguacates \(2 uds\)/i }).first();
    await extra.waitFor({ state: "visible" });
    await extra.getByText(/REVISAR/i).waitFor({ state: "visible" });
    await extra.click();
    await extra.getByText(/CONFIRMADO/i).waitFor({ state: "visible" });
    await confirm(panel);

    await waitForPantry(page, `(pantry) => pantry.some((i) => i.name === "Aguacates" && i.quantity === 2 && i.unit === "uds")`);
    let pantry = await readPantry(page);
    let avocados = pantry.filter((i) => i.name === "Aguacates");
    assert.equal(avocados.length, 1);
    assert.equal(avocados[0].quantity, 2);
    assert.equal(avocados[0].unit, "uds");
    assert.equal(Object.hasOwn(avocados[0], "estimatedCostEUR"), false, "fallback price must remain non-authoritative");
    assert.equal(Object.hasOwn(avocados[0], "expiryDaysLeft"), false, "fallback expiry must remain non-authoritative");

    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#nav-tab-shopping").waitFor({ state: "visible" });
    pantry = await readPantry(page);
    avocados = pantry.filter((i) => i.name === "Aguacates");
    assert.equal(avocados.length, 1);
    assert.equal(avocados[0].quantity, 2, "explicit extra must persist after reload");

    // Compatible count alias: same lot, 2 + 1 = 3 uds.
    panel = await openReview(page, "Compré 1 unidad de aguacate");
    extra = panel.locator("button").filter({ hasText: /Aguacates \(1 uds\)/i }).first();
    await extra.waitFor({ state: "visible" });
    await extra.click();
    await confirm(panel);
    await waitForPantry(page, `(pantry) => pantry.some((i) => i.name === "Aguacates" && i.quantity === 3 && i.unit === "uds")`);

    // Incompatible mass/count: keep a separate 500 g lot.
    panel = await openReview(page, "Compré 500 g de aguacate");
    extra = panel.locator("button").filter({ hasText: /Aguacates \(500 g\)/i }).first();
    await extra.waitFor({ state: "visible" });
    await extra.click();
    await confirm(panel);
    await waitForPantry(page, `(pantry) => pantry.filter((i) => i.name === "Aguacates").length === 2`);
    pantry = await readPantry(page);
    avocados = pantry.filter((i) => i.name === "Aguacates");
    assert.equal(avocados.length, 2);
    assert.ok(avocados.some((i) => i.quantity === 3 && i.unit === "uds"));
    assert.ok(avocados.some((i) => i.quantity === 500 && i.unit === "g"));
    await context.close();
  }

  // C. Vague/incomplete extras are visible but blocked and cannot mutate pantry.
  for (const phrase of [
    "Compré aguacate",       // vague: no amount or unit
    "Compré 2 aguacates",   // quantity but no unit
    "Compré uds de aguacate" // unit but no numeric quantity
  ]) {
    const { context, page } = await newGuestPage(browser);
    const before = await readPantry(page);
    const panel = await openReview(page, phrase);
    await panel.getByText(/BLOQUEADO/i).waitFor({ state: "visible" });
    const blocked = panel.locator("button:disabled").filter({ hasText: /Aguacates/i }).first();
    await blocked.waitFor({ state: "visible" });
    await confirm(panel);
    await page.waitForTimeout(150);
    assert.deepEqual(await readPantry(page), before, `incomplete phrase must not mutate pantry: ${phrase}`);
    await context.close();
  }

  console.log("safe shopping reconciliation browser E2E v2: PASS");
} finally {
  await browser.close();
}
