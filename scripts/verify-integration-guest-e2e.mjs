import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = "http://127.0.0.1:3000";

async function readJson(page, key, fallback = []) {
  return page.evaluate(({ key, fallback }) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }, { key, fallback });
}

async function readPantry(page) {
  return readJson(page, "balkanbite_pantry", []);
}

async function readShopping(page) {
  return readJson(page, "balkanbite_shopping", []);
}

async function newGuestPage(browser, shopping = []) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", async (dialog) => {
    try { await dialog.accept(); } catch {}
  });

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate((seedShopping) => {
    localStorage.clear();
    localStorage.setItem("balkanbite_show_landing", "false");
    localStorage.setItem("balkanbite_shopping", JSON.stringify(seedShopping));
  }, shopping);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#app-root").waitFor({ state: "visible" });
  await page.locator("#pantry-view").waitFor({ state: "visible" });
  await page.waitForFunction(() => localStorage.getItem("balkanbite_pantry") !== null);
  return { context, page };
}

async function goPantry(page) {
  await page.locator("#nav-tab-pantry").click();
  await page.locator("#pantry-view").waitFor({ state: "visible" });
}

async function goRecipes(page) {
  await page.locator("#nav-tab-recipes").click();
  await page.locator("#recipes-view").waitFor({ state: "visible" });
}

async function goShopping(page) {
  await page.locator("#nav-tab-shopping").click();
  await page.locator("#shopping-view").waitFor({ state: "visible" });
}

async function waitForPantry(page, predicateSource, message = "pantry predicate") {
  try {
    await page.waitForFunction((source) => {
      const pantry = JSON.parse(localStorage.getItem("balkanbite_pantry") || "[]");
      return Function("pantry", `return (${source})(pantry)`)(pantry);
    }, predicateSource, { timeout: 10000 });
  } catch (error) {
    throw new Error(`${message} not reached: ${error.message}`);
  }
}

async function waitForShopping(page, predicateSource, message = "shopping predicate") {
  try {
    await page.waitForFunction((source) => {
      const shopping = JSON.parse(localStorage.getItem("balkanbite_shopping") || "[]");
      return Function("shopping", `return (${source})(shopping)`)(shopping);
    }, predicateSource, { timeout: 10000 });
  } catch (error) {
    throw new Error(`${message} not reached: ${error.message}`);
  }
}

async function openPurchaseReview(page, phrase) {
  await goShopping(page);
  await page.locator("#voice-shopping-reconcile-banner-btn").click();
  const panel = page.locator("#voice-shopping-modal-panel");
  await panel.waitFor({ state: "visible" });
  await panel.locator("textarea").fill(phrase);
  await panel.getByRole("button", { name: /Procesar Compra/i }).click();
  await panel.getByText(/Análisis de Compra — Revisa antes de guardar/i).waitFor({ state: "visible" });
  return panel;
}

async function confirmPurchaseReview(panel) {
  await panel.getByRole("button", { name: /Confirmar y Pasar a Despensa/i }).click();
  await panel.waitFor({ state: "hidden" });
}

async function openChef(page) {
  await page.locator("#chef-ia-floating-btn").click();
  await page.locator("#chef-ia-modal-panel").waitFor({ state: "visible" });
  await page.locator("#voice-text-input").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("balkanbite_chat_messages");
    return raw && JSON.parse(raw).length >= 1;
  });
}

async function sendChefText(page, text) {
  const before = await page.evaluate(() => {
    const raw = localStorage.getItem("balkanbite_chat_messages");
    return raw ? JSON.parse(raw).length : 0;
  });
  const input = page.locator("#voice-text-input");
  await input.fill(text);
  await input.press("Enter");
  await page.waitForFunction((count) => {
    const raw = localStorage.getItem("balkanbite_chat_messages");
    return raw && JSON.parse(raw).length >= count + 2;
  }, before, { timeout: 15000 });
}

const browser = await chromium.launch({ headless: true });
try {
  // 1. Intentionally empty guest pantry is authoritative and persists.
  {
    const { context, page } = await newGuestPage(browser);
    assert.equal((await readPantry(page)).length, 14, "fixture should start from the demo pantry");
    await page.locator("#pantry-clear-all-btn").click();
    const confirmOverlay = page.locator("div.fixed.inset-0.z-50").last();
    await confirmOverlay.waitFor({ state: "visible" });
    await confirmOverlay.locator("button").last().click();
    await waitForPantry(page, `(pantry) => pantry.length === 0`, "empty pantry after clear");
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#pantry-view").waitFor({ state: "visible" });
    assert.deepEqual(await readPantry(page), [], "intentionally empty pantry must remain empty after reload");
    assert.equal(await page.locator('[id^="pantry-item-"]').count(), 0, "demo items must not reappear");
    await context.close();
  }

  // 2. Direct purchase -> pantry: compatible count merge, shopping removal, reload persistence.
  {
    const shopping = [{
      id: "qa-transfer-tomato",
      name: "Tomate",
      quantity: 2,
      unit: "uds",
      category: "Produce",
      estimatedPriceEUR: 0,
      checked: true,
      reason: "Integration QA",
    }];
    const { context, page } = await newGuestPage(browser, shopping);
    await goShopping(page);
    await page.locator("#transfer-to-pantry-btn").click();
    await waitForPantry(page, `(pantry) => pantry.some((i) => i.name === "Tomate" && i.quantity === 6 && i.unit === "uds")`, "Tomate compatible merge 4 + 2 = 6");
    assert.equal((await readShopping(page)).some((i) => i.id === "qa-transfer-tomato"), false, "accepted purchase must leave shopping list");
    await page.reload({ waitUntil: "networkidle" });
    const pantry = await readPantry(page);
    assert.equal(pantry.filter((i) => i.name === "Tomate" && i.unit === "uds").length, 1);
    assert.equal(pantry.find((i) => i.name === "Tomate" && i.unit === "uds").quantity, 6);
    assert.equal((await readShopping(page)).some((i) => i.id === "qa-transfer-tomato"), false);
    await context.close();
  }

  // 3. Direct purchase with incompatible units must stay as a separate lot.
  {
    const shopping = [{
      id: "qa-transfer-tomato-g",
      name: "Tomate",
      quantity: 500,
      unit: "g",
      category: "Produce",
      estimatedPriceEUR: 0,
      checked: true,
      reason: "Integration QA",
    }];
    const { context, page } = await newGuestPage(browser, shopping);
    await goShopping(page);
    await page.locator("#transfer-to-pantry-btn").click();
    await waitForPantry(page, `(pantry) => pantry.filter((i) => i.name === "Tomate").length === 2`, "incompatible Tomato lots");
    const tomatoLots = (await readPantry(page)).filter((i) => i.name === "Tomate");
    assert.ok(tomatoLots.some((i) => i.quantity === 4 && i.unit === "uds"));
    assert.ok(tomatoLots.some((i) => i.quantity === 500 && i.unit === "g"));
    await context.close();
  }

  // 4. Live pantry mutation -> recipe availability -> exact quantitative shopping shortfall.
  {
    const { context, page } = await newGuestPage(browser);
    const tomatoCard = page.locator("#pantry-item-sp-12");
    const decreaseTomato = tomatoCard.locator('button[title="Reducir cantidad"]');
    await decreaseTomato.click();
    await decreaseTomato.click();
    await decreaseTomato.click();
    await waitForPantry(page, `(pantry) => pantry.some((i) => i.id === "sp-12" && i.quantity === 1)`, "Tomate reduced to 1");

    await goRecipes(page);
    const recipeCard = page.locator("#recipe-card-rec-chicken-tomato");
    await recipeCard.waitFor({ state: "visible" });
    await recipeCard.getByText(/0 de 4/i).waitFor({ state: "visible" });
    await page.locator("#add-missing-btn-rec-chicken-tomato").click();
    await waitForShopping(page, `(shopping) => shopping.some((i) => i.name === "Tomate" && i.quantity === 1 && (i.unit === "uds" || i.unit === "ud"))`, "exact Tomato 1 shortfall");
    let tomatoShopping = (await readShopping(page)).filter((i) => i.name === "Tomate");
    assert.equal(tomatoShopping.length, 1);
    assert.equal(tomatoShopping[0].quantity, 1);
    assert.equal(tomatoShopping[0].estimatedPriceEUR, 0, "shortfall price must remain unknown/zero, not fabricated");

    await page.locator("#add-missing-btn-rec-chicken-tomato").click();
    await page.waitForTimeout(200);
    tomatoShopping = (await readShopping(page)).filter((i) => i.name === "Tomate");
    assert.equal(tomatoShopping.length, 1, "second add-missing must not duplicate a covered pending shortfall");
    assert.equal(tomatoShopping[0].quantity, 1);
    await context.close();
  }

  // 5. Cook -> deterministic pantry deduction, incompatible bottle stays untouched, reload persists.
  {
    const { context, page } = await newGuestPage(browser);
    await goRecipes(page);
    await page.locator("#cook-btn-rec-breakfast-toast-tomato").click();
    await waitForPantry(page, `(pantry) => pantry.some((i) => i.id === "sp-1" && i.quantity === 5) && pantry.some((i) => i.id === "sp-12" && i.quantity === 3)`, "cook deductions");
    let pantry = await readPantry(page);
    assert.equal(pantry.find((i) => i.id === "sp-1").quantity, 5);
    assert.equal(pantry.find((i) => i.id === "sp-12").quantity, 3);
    assert.equal(pantry.find((i) => i.id === "sp-11").quantity, 1, "bottle must not be treated as tablespoon");
    await page.reload({ waitUntil: "networkidle" });
    pantry = await readPantry(page);
    assert.equal(pantry.find((i) => i.id === "sp-1").quantity, 5);
    assert.equal(pantry.find((i) => i.id === "sp-12").quantity, 3);
    assert.equal(pantry.find((i) => i.id === "sp-11").quantity, 1);
    await context.close();
  }

  // 6. Chef text/voice path -> unit-safe removal; incompatible mass vs bottle must not mutate oil.
  {
    const { context, page } = await newGuestPage(browser);
    await openChef(page);
    await sendChefText(page, "He usado 2 huevos frescos");
    await waitForPantry(page, `(pantry) => pantry.some((i) => i.id === "sp-1" && i.quantity === 4)`, "voice/text egg removal");
    const chatsBeforeOil = (await readJson(page, "balkanbite_chat_messages", [])).length;
    await sendChefText(page, "He usado 200 g de aceite de oliva virgen");
    const chatsAfterOil = (await readJson(page, "balkanbite_chat_messages", [])).length;
    assert.ok(chatsAfterOil >= chatsBeforeOil + 2, "incompatible voice request must still complete without hanging");
    let pantry = await readPantry(page);
    assert.equal(pantry.find((i) => i.id === "sp-11").quantity, 1, "200 g must not deduct from one bottle");
    assert.equal(pantry.filter((i) => i.name === "Aceite de oliva virgen").length, 1);
    await page.reload({ waitUntil: "networkidle" });
    pantry = await readPantry(page);
    assert.equal(pantry.find((i) => i.id === "sp-1").quantity, 4, "voice deduction must persist after reload");
    assert.equal(pantry.find((i) => i.id === "sp-11").quantity, 1);
    await context.close();
  }

  // 7. Safe purchase reconciliation: shopping row source-of-truth, persistence and practical replay.
  {
    const shopping = [{
      id: "qa-reconcile-tomato",
      name: "Tomate",
      quantity: 2,
      unit: "uds",
      category: "Produce",
      estimatedPriceEUR: 0,
      checked: false,
      reason: "Integration QA",
    }];
    const { context, page } = await newGuestPage(browser, shopping);
    let panel = await openPurchaseReview(page, "He comprado tomate");
    await panel.getByText(/Comprados de la lista \(1\)/i).waitFor({ state: "visible" });
    await panel.getByText(/Tomate \(2\s+uds\)/i).waitFor({ state: "visible" });
    await confirmPurchaseReview(panel);
    await waitForPantry(page, `(pantry) => pantry.some((i) => i.name === "Tomate" && i.quantity === 6 && i.unit === "uds")`, "reconciled Tomato 6");
    assert.equal((await readShopping(page)).some((i) => i.id === "qa-reconcile-tomato"), false);
    await page.reload({ waitUntil: "networkidle" });
    assert.equal((await readPantry(page)).find((i) => i.name === "Tomate" && i.unit === "uds").quantity, 6);

    panel = await openPurchaseReview(page, "He comprado tomate");
    await confirmPurchaseReview(panel);
    await page.waitForTimeout(200);
    assert.equal((await readPantry(page)).find((i) => i.name === "Tomate" && i.unit === "uds").quantity, 6, "replay without pending row must not duplicate stock");
    await context.close();
  }

  // 8. Explicit reconciliation extras: human confirmation, compatible alias and incompatible lot.
  {
    const { context, page } = await newGuestPage(browser);
    let panel = await openPurchaseReview(page, "Compré 2 uds de aguacate");
    let extra = panel.locator("button").filter({ hasText: /Aguacates \(2 uds\)/i }).first();
    await extra.waitFor({ state: "visible" });
    await extra.getByText(/REVISAR/i).waitFor({ state: "visible" });
    await extra.click();
    await extra.getByText(/CONFIRMADO/i).waitFor({ state: "visible" });
    await confirmPurchaseReview(panel);
    await waitForPantry(page, `(pantry) => pantry.some((i) => i.name === "Aguacates" && i.quantity === 2 && i.unit === "uds")`, "explicit avocado extra");
    let avocados = (await readPantry(page)).filter((i) => i.name === "Aguacates");
    assert.equal(Object.hasOwn(avocados[0], "estimatedCostEUR"), false, "provider/fallback price must not become authoritative");
    assert.equal(Object.hasOwn(avocados[0], "expiryDaysLeft"), false, "provider/fallback expiry must not become authoritative");

    panel = await openPurchaseReview(page, "Compré 1 unidad de aguacate");
    extra = panel.locator("button").filter({ hasText: /Aguacates \(1 uds\)/i }).first();
    await extra.waitFor({ state: "visible" });
    await extra.click();
    await confirmPurchaseReview(panel);
    await waitForPantry(page, `(pantry) => pantry.some((i) => i.name === "Aguacates" && i.quantity === 3 && i.unit === "uds")`, "compatible count alias merge");

    panel = await openPurchaseReview(page, "Compré 500 g de aguacate");
    extra = panel.locator("button").filter({ hasText: /Aguacates \(500 g\)/i }).first();
    await extra.waitFor({ state: "visible" });
    await extra.click();
    await confirmPurchaseReview(panel);
    await waitForPantry(page, `(pantry) => pantry.filter((i) => i.name === "Aguacates").length === 2`, "incompatible avocado units separate lots");
    avocados = (await readPantry(page)).filter((i) => i.name === "Aguacates");
    assert.ok(avocados.some((i) => i.quantity === 3 && i.unit === "uds"));
    assert.ok(avocados.some((i) => i.quantity === 500 && i.unit === "g"));
    await context.close();
  }

  // 9. Vague/incomplete reconciliation extras cannot mutate pantry.
  for (const phrase of [
    "Compré aguacate",
    "Compré 2 aguacates",
    "Compré uds de aguacate",
  ]) {
    const { context, page } = await newGuestPage(browser);
    const before = await readPantry(page);
    const panel = await openPurchaseReview(page, phrase);
    await panel.getByText(/BLOQUEADO/i).waitFor({ state: "visible" });
    await panel.locator("button:disabled").filter({ hasText: /Aguacates/i }).first().waitFor({ state: "visible" });
    await confirmPurchaseReview(panel);
    await page.waitForTimeout(150);
    assert.deepEqual(await readPantry(page), before, `incomplete phrase must not mutate pantry: ${phrase}`);
    await context.close();
  }

  console.log("BalkanBite accumulated guest circuit E2E: PASS");
} finally {
  await browser.close();
}
