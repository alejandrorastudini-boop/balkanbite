import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = "http://127.0.0.1:3000";

async function newGuestPage(browser, shopping = []) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript((seedShopping) => {
    localStorage.clear();
    localStorage.setItem("balkanbite_show_landing", "false");
    localStorage.setItem("balkanbite_shopping", JSON.stringify(seedShopping));
  }, shopping);
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.locator("#nav-tab-shopping").waitFor({ state: "visible" });
  return { context, page };
}

async function goShopping(page) {
  await page.locator("#nav-tab-shopping").click();
  await page.locator("#shopping-view").waitFor({ state: "visible" });
}

async function openReconciliationReview(page, phrase) {
  await goShopping(page);
  await page.locator("#voice-shopping-reconcile-banner-btn").click();
  const panel = page.locator("#voice-shopping-modal-panel");
  await panel.waitFor({ state: "visible" });
  await panel.locator("textarea").fill(phrase);
  await panel.getByRole("button", { name: /Procesar Compra/i }).click();
  await panel.getByText(/Análisis de Compra — Revisa antes de guardar/i).waitFor({ state: "visible" });
  return panel;
}

async function confirmReview(panel) {
  await panel.getByRole("button", { name: /Confirmar y Pasar a Despensa/i }).click();
  await panel.waitFor({ state: "hidden" });
}

async function readGuestPantry(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("balkanbite_pantry") || "[]"));
}

async function waitForGuestPantry(page, predicateSource) {
  await page.waitForFunction((source) => {
    const pantry = JSON.parse(localStorage.getItem("balkanbite_pantry") || "[]");
    return Function("pantry", `return (${source})(pantry)`)(pantry);
  }, predicateSource);
}

const browser = await chromium.launch({ headless: true });
try {
  // 1) Existing shopping row is authoritative, merges into pantry, persists, and a repeated phrase is a no-op.
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
    const panel = await openReconciliationReview(page, "He comprado tomate");
    await panel.getByText(/Comprados de la lista \(1\)/i).waitFor({ state: "visible" });
    const tomatoReview = panel.getByText(/Tomate \(2\s+uds\)/i);
    await tomatoReview.waitFor({ state: "visible" });
    await confirmReview(panel);

    await waitForGuestPantry(page, `(pantry) => pantry.some((item) => item.name === "Tomate" && item.quantity === 6 && item.unit === "uds")`);
    let pantry = await readGuestPantry(page);
    let tomato = pantry.find((item) => item.name === "Tomate");
    assert.equal(tomato.quantity, 6);
    assert.equal(tomato.unit, "uds");

    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#nav-tab-shopping").waitFor({ state: "visible" });
    pantry = await readGuestPantry(page);
    tomato = pantry.find((item) => item.name === "Tomate");
    assert.equal(tomato.quantity, 6, "Tomate quantity must persist after reload");
    const persistedShopping = await page.evaluate(() => JSON.parse(localStorage.getItem("balkanbite_shopping") || "[]"));
    assert.equal(persistedShopping.some((item) => item.id === "qa-tomato"), false, "accepted shopping row must stay removed after reload");

    const repeatPanel = await openReconciliationReview(page, "He comprado tomate");
    await confirmReview(repeatPanel);
    await page.waitForTimeout(100);
    pantry = await readGuestPantry(page);
    tomato = pantry.find((item) => item.name === "Tomate");
    assert.equal(tomato.quantity, 6, "repeating the same phrase after reconciliation must not double-add stock");
    await context.close();
  }

  // 2) Valid explicit extra: fallback defaults are ignored; transcript amount wins; price/expiry stay unknown; persistence works.
  {
    const { context, page } = await newGuestPage(browser);
    const panel = await openReconciliationReview(page, "Compré 2 uds de aguacate");
    const extraButton = panel.locator("button").filter({ hasText: /Aguacates \(2 uds\)/i }).first();
    await extraButton.waitFor({ state: "visible" });
    await extraButton.getByText(/REVISAR/i).waitFor({ state: "visible" });
    await extraButton.click();
    await extraButton.getByText(/CONFIRMADO/i).waitFor({ state: "visible" });
    await confirmReview(panel);

    await waitForGuestPantry(page, `(pantry) => pantry.some((item) => item.name === "Aguacates" && item.quantity === 2 && item.unit === "uds")`);
    let pantry = await readGuestPantry(page);
    let avocados = pantry.filter((item) => item.name === "Aguacates");
    assert.equal(avocados.length, 1);
    assert.equal(avocados[0].quantity, 2);
    assert.equal(avocados[0].unit, "uds");
    assert.equal(Object.prototype.hasOwnProperty.call(avocados[0], "estimatedCostEUR"), false, "AI/fallback price must not become pantry fact");
    assert.equal(Object.prototype.hasOwnProperty.call(avocados[0], "expiryDaysLeft"), false, "AI/fallback expiry must not become pantry fact");

    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#nav-tab-shopping").waitFor({ state: "visible" });
    pantry = await readGuestPantry(page);
    avocados = pantry.filter((item) => item.name === "Aguacates");
    assert.equal(avocados.length, 1);
    assert.equal(avocados[0].quantity, 2, "explicit extra must persist after reload");

    // Compatible count alias merges into the existing count lot.
    const compatiblePanel = await openReconciliationReview(page, "Compré 1 unidad de aguacate");
    const compatibleExtra = compatiblePanel.locator("button").filter({ hasText: /Aguacates \(1 uds\)/i }).first();
    await compatibleExtra.waitFor({ state: "visible" });
    await compatibleExtra.click();
    await confirmReview(compatiblePanel);
    await waitForGuestPantry(page, `(pantry) => pantry.filter((item) => item.name === "Aguacates" && item.unit === "uds").some((item) => item.quantity === 3)`);

    // Incompatible mass/count stays as a separate lot.
    const incompatiblePanel = await openReconciliationReview(page, "Compré 500 g de aguacate");
    const incompatibleExtra = incompatiblePanel.locator("button").filter({ hasText: /Aguacates \(500 g\)/i }).first();
    await incompatibleExtra.waitFor({ state: "visible" });
    await incompatibleExtra.click();
    await confirmReview(incompatiblePanel);
    await waitForGuestPantry(page, `(pantry) => pantry.filter((item) => item.name === "Aguacates").length === 2`);
    pantry = await readGuestPantry(page);
    avocados = pantry.filter((item) => item.name === "Aguacates");
    assert.equal(avocados.length, 2);
    assert.ok(avocados.some((item) => item.quantity === 3 && item.unit === "uds"));
    assert.ok(avocados.some((item) => item.quantity === 500 && item.unit === "g"));
    await context.close();
  }

  // 3) Vague/incomplete extras stay blocked and cannot mutate pantry.
  for (const phrase of ["Compré aguacate", "Compré 2 aguacates", "Compré uds de aguacate"]) {
    const { context, page } = await newGuestPage(browser);
    const before = await readGuestPantry(page);
    const panel = await openReconciliationReview(page, phrase);
    await panel.getByText(/BLOQUEADO/i).waitFor({ state: "visible" });
    const blocked = panel.locator("button:disabled").filter({ hasText: /Aguacates/i }).first();
    await blocked.waitFor({ state: "visible" });
    await confirmReview(panel);
    await page.waitForTimeout(100);
    const after = await readGuestPantry(page);
    assert.deepEqual(after, before, `incomplete phrase must not mutate pantry: ${phrase}`);
    await context.close();
  }

  console.log("safe shopping reconciliation browser E2E: PASS");
} finally {
  await browser.close();
}
