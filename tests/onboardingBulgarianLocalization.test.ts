import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const ui = readFileSync(new URL("../src/components/OnboardingModal.tsx", import.meta.url), "utf8");
const harness = readFileSync(new URL("../src/qa/FreshGuestOnboardingQaHarness.tsx", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../qa/runtime/startup-cloud-sync.mjs", import.meta.url), "utf8");

test("Bulgarian onboarding has localized prompts in all four steps", () => {
  for (const text of [
    "Стъпка", "Как се казвате?", "Колко души се хранят у дома?",
    "Предпочитан стил на хранене", "Без кулинарни ограничения",
    "Колко време имате за готвене?", "Обичайно (20–40 мин)",
    "Налично кухненско оборудване", "Прогнозен месечен бюджет за храна",
    "Назад", "Напред", "Започни",
  ]) {
    assert.ok(ui.includes(text), `Missing Bulgarian text: ${text}`);
  }
  assert.doesNotMatch(ui, /<span>Atrás<\/span>/);
  assert.doesNotMatch(ui, /\bPaso \{step\} de \{totalSteps\}/);
  assert.doesNotMatch(ui, /placeholder="Ej\. Alejandro"/);
});

test("translated appliances retain canonical stored identifiers", () => {
  for (const id of ["Airfryer", "Horno", "Thermomix / Robot", "Microondas", "Sartén / Vitro"]) {
    assert.ok(ui.includes(`id: "${id}"`));
  }
  assert.match(ui, /toggleAppliance\(appliance\)/);
  assert.match(ui, /appliances:\s*selectedAppliances/);
  assert.match(ui, /<span>\{option.label\}<\/span>/);
  assert.match(harness, /qa-fresh-guest-appliances/);
  assert.match(runtime, /language === "bg" \? "Horno" : ""/);
});

test("mobile Bulgarian QA exercises explicit culinary choices without clinical inputs", () => {
  assert.match(harness, /get\("lang"\) === "bg"/);
  assert.match(runtime, /runFreshGuestOnboardingScenario\(context, "bg"\)/);
  assert.match(runtime, /getByText\("Без кулинарни ограничения"\)/);
  assert.match(runtime, /getByRole\("button", \{ name: "Фурна", exact: true \}\)/);
  assert.doesNotMatch(ui, /allergies:\s*selected/);
  assert.doesNotMatch(ui, /healthProfile\s*:/);
});
