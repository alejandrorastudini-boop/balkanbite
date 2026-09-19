import assert from "node:assert/strict";
import test from "node:test";
import {
  formatRecipeCostEUR,
  recipeCheapFilterLabel,
  recipeCostCurrencyNotice,
} from "../src/utils/recipeCostDisplay";

test("recipe costs remain in their declared EUR source currency", () => {
  assert.equal(formatRecipeCostEUR(2.5, true, "EUR"), "€2.50");
  assert.equal(formatRecipeCostEUR(2.5, false, "EUR"), "≈€2.50");
  assert.equal(formatRecipeCostEUR(2.5, true, "USD"), "€2.50 (EUR)");
  assert.equal(formatRecipeCostEUR(2.5, false, "USD"), "≈€2.50 (EUR)");
});

test("invalid recipe cost does not become a numeric display", () => {
  assert.equal(formatRecipeCostEUR(Number.NaN, false, "EUR"), "—");
  assert.equal(formatRecipeCostEUR(-1, false, "USD"), "—");
});

test("cheap filter truthfully states its EUR threshold", () => {
  assert.equal(recipeCheapFilterLabel("EUR"), "💰 ≈<3€");
  assert.equal(recipeCheapFilterLabel("USD"), "💰 ≈<3€ (EUR)");
});

test("non-EUR preference gets an explicit no-FX notice", () => {
  assert.equal(recipeCostCurrencyNotice("EUR", "es"), null);
  assert.match(recipeCostCurrencyNotice("USD", "es") || "", /EUR/);
  assert.match(recipeCostCurrencyNotice("USD", "bg") || "", /EUR/);
  assert.match(recipeCostCurrencyNotice("USD", "en") || "", /EUR/);
});
