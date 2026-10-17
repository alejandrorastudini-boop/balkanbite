import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem } from "../src/types";
import { describeChefPantryQuery, parseChefPantryQueryIntent } from "../src/utils/chefPantryFacts";

const rice: PantryItem = {
  id: "qa-rice", name: "Rice", quantity: 150, unit: "g",
  category: "Pantry/Grains", addedAt: "2026-10-14", expiryDaysLeft: 5,
};
const eggs: PantryItem = {
  id: "qa-eggs", name: "Eggs", quantity: 2, unit: "ud",
  category: "Dairy", addedAt: "2026-10-14", expiryDaysLeft: 1,
};
const partial: PantryItem = {
  id: "qa-partial", name: "Yogurt", quantity: 0.5, unit: "kg",
  category: "Dairy", addedAt: "2026-10-14", expiryDaysLeft: 1,
  expiryIsPartial: true,
};
const unknown: PantryItem = {
  id: "qa-unknown", name: "Salt", quantity: 1, unit: "kg",
  category: "Other", addedAt: "2026-10-14",
};
const now = new Date("2026-10-17T12:00:00");

test("literal pantry questions parse in Bulgarian, Spanish, English without a model", () => {
  for (const text of [
    "¿Qué tengo en la despensa?", "¿Qué hay en mi despensa?",
    "What do I have in my pantry?", "What's in my pantry?",
    "Какво имам в килера?",
  ]) assert.deepEqual(parseChefPantryQueryIntent(text), { actionId: "SHOW_PANTRY_ITEMS" }, text);
  for (const text of [
    "¿Qué va a caducar?", "¿Qué alimentos caducan pronto?",
    "What expires soon?", "Кое изтича скоро?",
  ]) assert.deepEqual(parseChefPantryQueryIntent(text), { actionId: "SHOW_EXPIRING" }, text);
});

test("compound, mutation and health questions cannot silently become inventory assertions", () => {
  for (const text of [
    "¿Qué tengo en la despensa y qué me recomiendas?", "añade arroz y dime qué tengo",
    "¿Qué va a caducar y qué debo tirar?", "¿Qué va a caducar mañana?",
    "what is in my pantry and remove all rice", "what is the safe expiration date of eggs",
    "какво имам в килера и добави мляко", "", 42, null,
  ]) assert.equal(parseChefPantryQueryIntent(text), null, String(text));
});

test("quantities are separate per row, no mass/unit conversions or fabricated expiry", () => {
  const result = describeChefPantryQuery("SHOW_PANTRY_ITEMS", [rice, eggs], "es", now);
  assert.match(result!, /2 productos registrados/);
  assert.match(result!, /Rice \(150 g\)/);
  assert.match(result!, /Eggs \(2 ud\)/);
  assert.doesNotMatch(result!, /152 g|152 ud|caduca/);
});

test("empty pantry is not confused with a claim about food actually in the house", () => {
  const text = describeChefPantryQuery("SHOW_PANTRY_ITEMS", [], "en", now);
  assert.match(text!, /No products are recorded/);
  assert.match(text!, /does not mean you have no food/);
});

test("expiry uses calendar-day evidence, marks past dates and counts partial/unknown", () => {
  const text = describeChefPantryQuery("SHOW_EXPIRING", [rice, eggs, partial, unknown], "es", now);
  assert.match(text!, /Rice \(en 2 días\)/);
  assert.match(text!, /Eggs \(fecha registrada pasada\)/);
  assert.match(text!, /2 productos sin caducidad fiable/);
  assert.doesNotMatch(text!, /Yogurt \(/);
  assert.match(text!, /no garantiza seguridad alimentaria/);
});

test("one-day warnings use singular localized wording", () => {
  const dueTomorrow = { ...rice, expiryDaysLeft: 4 };
  assert.match(describeChefPantryQuery("SHOW_EXPIRING", [dueTomorrow], "es", now)!, /en 1 día/);
  assert.match(describeChefPantryQuery("SHOW_EXPIRING", [dueTomorrow], "en", now)!, /in 1 day/);
  assert.match(describeChefPantryQuery("SHOW_EXPIRING", [dueTomorrow], "bg", now)!, /след 1 ден/);
});

test("unknown or partial expiry never becomes 'everything safe'", () => {
  for (const lang of ["es", "en", "bg"] as const) {
    const text = describeChefPantryQuery("SHOW_EXPIRING", [partial, unknown], lang, now);
    assert.ok(text && !text.includes("undefined") && !text.includes("NaN"));
    assert.doesNotMatch(text, /Yogurt \(/);
    assert.doesNotMatch(text, /Salt \(/);
  }
});

test("corrupt inventory, duplicate identity or invalid clock blocks rather than asserting facts", () => {
  const badQuantity = { ...rice, quantity: NaN };
  const duplicate = { ...rice };
  assert.equal(describeChefPantryQuery("SHOW_PANTRY_ITEMS", [badQuantity], "en", now), null);
  assert.equal(describeChefPantryQuery("SHOW_EXPIRING", [rice, duplicate], "en", now), null);
  assert.equal(describeChefPantryQuery("SHOW_EXPIRING", [rice], "en", new Date("invalid")), null);
});

test("long inventories are summarized without silently dropping the remainder", () => {
  const products = Array.from({ length: 9 }, (_, i) => ({ ...rice, id: `qa-rice-${i}`, name: `Item ${i}` }));
  const text = describeChefPantryQuery("SHOW_PANTRY_ITEMS", products, "bg", now);
  assert.match(text!, /9 продукта/);
  assert.match(text!, /още 3 записани продукта/);
  assert.doesNotMatch(text!, /Item 8/);
});
