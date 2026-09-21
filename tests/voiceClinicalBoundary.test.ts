import assert from "node:assert/strict";
import test from "node:test";
import {
  assessVoiceClinicalBoundary,
  getVoiceClinicalBoundaryMessage,
} from "../src/utils/voiceClinicalBoundary";

test("explicit medication, dose and interaction requests are blocked in EN ES BG", () => {
  const cases = [
    ["How many mg of warfarin should I take with food?", "medication_or_dose"],
    ["¿Puedo tomar mi metformina con comida?", "medication_or_dose"],
    ["Мога ли да вземам антибиотик с храна?", "medication_or_dose"],
    ["How much vitamin D should I take?", "medication_or_dose"],
  ] as const;

  for (const [text, reason] of cases) {
    assert.deepEqual(assessVoiceClinicalBoundary(text), {
      blocked: true,
      reason,
    });
  }
});

test("diagnosis and treatment requests are blocked", () => {
  const cases = [
    "Diagnose me from these symptoms",
    "What treatment should I use for diabetes?",
    "¿Qué tratamiento para diabetes debería seguir?",
    "Какво лечение на диабет трябва да следвам?",
  ];

  for (const text of cases) {
    assert.deepEqual(assessVoiceClinicalBoundary(text), {
      blocked: true,
      reason: "diagnosis_or_treatment",
    });
  }
});

test("personal lab-result interpretation requests are blocked", () => {
  const cases = [
    "Interpret my blood test results",
    "What does my HbA1c mean?",
    "¿Qué significa mi analítica?",
    "Какво означават кръвните ми изследвания?",
  ];

  for (const text of cases) {
    assert.deepEqual(assessVoiceClinicalBoundary(text), {
      blocked: true,
      reason: "lab_interpretation",
    });
  }
});

test("disease-specific therapeutic food advice is blocked", () => {
  const cases = [
    "I have diabetes, what should I eat?",
    "I was diagnosed with kidney disease. What foods should I avoid?",
    "Me diagnosticaron enfermedad renal. ¿Qué puedo comer?",
    "Имам диабет, какво да ям?",
  ];

  for (const text of cases) {
    assert.deepEqual(assessVoiceClinicalBoundary(text), {
      blocked: true,
      reason: "disease_specific_advice",
    });
  }
});

test("pregnancy or lactation clinical nutrition requests are blocked", () => {
  const cases = [
    "I'm pregnant. What foods should I avoid?",
    "What vitamin should I take while breastfeeding?",
    "Estoy embarazada, ¿qué debo evitar?",
    "Бременна съм, какво да ям?",
  ];

  for (const text of cases) {
    assert.deepEqual(assessVoiceClinicalBoundary(text), {
      blocked: true,
      reason: "pregnancy_lactation_clinical",
    });
  }
});

test("ordinary cooking and general non-clinical nutrition remain available", () => {
  const cases = [
    "What is protein and why do we need it?",
    "How much rice should I cook for two people?",
    "Can I eat beans for dinner?",
    "What foods are high in iron?",
    "What is vitamin D?",
    "What is insulin?",
    "¿Qué alimentos tienen fibra?",
    "Колко ориз да сготвя за двама?",
  ];

  for (const text of cases) {
    assert.deepEqual(assessVoiceClinicalBoundary(text), { blocked: false });
  }
});

test("empty or non-string input is not treated as a clinical classification", () => {
  for (const value of [undefined, null, "", "   ", 42, {}]) {
    assert.deepEqual(assessVoiceClinicalBoundary(value), { blocked: false });
  }
});

test("localized boundary messages state the unsupported clinical scope without diagnosis", () => {
  for (const language of ["en", "es", "bg"] as const) {
    const message = getVoiceClinicalBoundaryMessage(language);
    assert.ok(message.length > 80);
  }

  assert.match(getVoiceClinicalBoundaryMessage("en"), /does not provide diagnosis/);
  assert.match(getVoiceClinicalBoundaryMessage("es"), /no ofrece por voz diagnósticos/);
  assert.match(getVoiceClinicalBoundaryMessage("bg"), /не предоставя чрез гласовия асистент диагнози/);
});
