import assert from "node:assert/strict";
import test from "node:test";
import {
  CLINICAL_REQUEST_BOUNDARY_VERSION,
  evaluateClinicalRequestBoundary,
  getClinicalRequestBlockedMessage,
} from "../src/utils/clinicalRequestBoundary";

const blockedCases = [
  {
    text: "Can I increase my medication dose from 5 mg to 10 mg?",
    reason: "medication_or_dose",
  },
  {
    text: "¿Puedo bajar la dosis de mi medicamento?",
    reason: "medication_or_dose",
  },
  {
    text: "Може ли да увелича дозата на лекарството?",
    reason: "medication_or_dose",
  },
  {
    text: "Do I have diabetes?",
    reason: "diagnosis",
  },
  {
    text: "¿Crees que tengo diabetes?",
    reason: "diagnosis",
  },
  {
    text: "Имам ли диабет?",
    reason: "diagnosis",
  },
  {
    text: "What should I eat for diabetes?",
    reason: "treatment_or_disease_specific_advice",
  },
  {
    text: "¿Qué comer para la hipertensión?",
    reason: "treatment_or_disease_specific_advice",
  },
  {
    text: "Какво да ям при диабет?",
    reason: "treatment_or_disease_specific_advice",
  },
  {
    text: "Can you interpret my blood test results?",
    reason: "lab_result_interpretation",
  },
  {
    text: "Interpreta mis análisis de sangre",
    reason: "lab_result_interpretation",
  },
  {
    text: "Разтълкувай моите кръвни резултати",
    reason: "lab_result_interpretation",
  },
  {
    text: "I'm pregnant, what should I eat?",
    reason: "pregnancy_or_lactation_clinical_advice",
  },
  {
    text: "Estoy embarazada, ¿qué puedo comer?",
    reason: "pregnancy_or_lactation_clinical_advice",
  },
  {
    text: "Бременна съм, какво да ям?",
    reason: "pregnancy_or_lactation_clinical_advice",
  },
] as const;

test("explicit high-risk clinical requests are blocked in EN ES and BG", () => {
  for (const { text, reason } of blockedCases) {
    const result = evaluateClinicalRequestBoundary(text);
    assert.equal(result.blocked, true, text);
    assert.ok(result.reasons.includes(reason), text);
    assert.equal(result.version, CLINICAL_REQUEST_BOUNDARY_VERSION);
  }
});

test("ordinary cooking and general non-clinical nutrition questions remain available", () => {
  for (const text of [
    "How much rice should I cook for two people?",
    "What foods are generally high in protein?",
    "What is cholesterol in general?",
    "Can I add salt to this soup?",
    "¿Qué receta rápida puedo hacer con arroz y tomate?",
    "¿Qué alimentos suelen tener fibra?",
    "Как да сготвя леща?",
    "Кои храни обикновено съдържат протеин?",
  ]) {
    assert.deepEqual(evaluateClinicalRequestBoundary(text), {
      blocked: false,
      reasons: [],
      version: CLINICAL_REQUEST_BOUNDARY_VERSION,
    });
  }
});

test("medical context statements alone are not treated as explicit advice requests", () => {
  for (const text of [
    "I take medication with breakfast every day.",
    "Tengo diabetes y quiero registrar que comí ensalada.",
    "Estoy embarazada.",
    "Бременна съм.",
  ]) {
    assert.equal(evaluateClinicalRequestBoundary(text).blocked, false, text);
  }
});

test("lab education stays available while personal result interpretation is blocked", () => {
  assert.equal(
    evaluateClinicalRequestBoundary("What is a blood test?").blocked,
    false,
  );
  assert.equal(
    evaluateClinicalRequestBoundary("My glucose result is 145, is that high?").blocked,
    true,
  );
});

test("blocked messages are static localized non-clinical boundaries", () => {
  const en = getClinicalRequestBlockedMessage("en");
  const es = getClinicalRequestBlockedMessage("es");
  const bg = getClinicalRequestBlockedMessage("bg");

  assert.match(en, /does not provide diagnosis/);
  assert.match(en, /qualified clinician or pharmacist/);
  assert.match(es, /no proporciona diagnósticos/);
  assert.match(es, /profesional sanitario o farmacéutico/);
  assert.match(bg, /не предоставя диагноза/);
  assert.match(bg, /лекар или фармацевт/);

  for (const message of [en, es, bg]) {
    assert.doesNotMatch(message, /take \d|tomar \d|приемайте \d/i);
  }
});
