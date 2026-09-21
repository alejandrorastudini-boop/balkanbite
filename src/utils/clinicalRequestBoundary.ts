export const CLINICAL_REQUEST_BOUNDARY_VERSION = "voice-clinical-v1" as const;

export type ClinicalRequestReason =
  | "medication_or_dose"
  | "diagnosis"
  | "treatment_or_disease_specific_advice"
  | "lab_result_interpretation"
  | "pregnancy_or_lactation_clinical_advice";

export interface ClinicalRequestBoundaryResult {
  blocked: boolean;
  reasons: ClinicalRequestReason[];
  version: typeof CLINICAL_REQUEST_BOUNDARY_VERSION;
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

const MEDICATION_NOUNS = [
  /\bmedication\b|\bmedicine\b|\bdrug\b|\bprescription\b|\bdose\b|\bdosage\b|\bpill\b|\btablet\b|\bcapsule\b|\bmg\b|\bmilligram/,
  /\bmedicacion\b|\bmedicamento\b|\bfarmaco\b|\bdosis\b|\bpastilla\b|\btableta\b|\bcapsula\b/,
  /лекарств|медикамент|\bдоза\b|дозиров|таблет|капсул|\bмг\b/,
];

const MEDICATION_ACTIONS = [
  /\b(take|taking|increase|decrease|reduce|change|adjust|stop|start|combine|mix|interact|interaction|safe|should i|can i|may i|how much)\b/,
  /\b(tomar|tomo|tome|aumentar|subir|reducir|bajar|cambiar|ajustar|dejar|parar|empezar|mezclar|combinar|interaccion|seguro|puedo|debo|cuanto)\b/,
  /прием|взем|увелич|намал|смен|промен|спр|започ|смес|комбинир|взаимодейств|безопас|може ли|трябва ли|колко/,
];

const CONDITION_TERMS = [
  /\b(diabetes|hypertension|high blood pressure|anemia|coeliac|celiac|thyroid disease|kidney disease|liver disease|heart disease|cancer|allergy)\b/,
  /\b(diabetes|hipertension|presion alta|anemia|celiaquia|enfermedad tiroidea|enfermedad renal|enfermedad hepatica|enfermedad cardiaca|cancer|alergia)\b/,
  /диабет|хипертония|високо кръвно|анемия|целиаки|щитовидн|бъбречн|чернодробн|сърдечн|рак|алерги/,
];

const DIAGNOSIS_CUES = [
  /\bdiagnos(e|is|ed|ing)?\b|\bdo i have\b|\bwhat disease do i have\b|\bwhat condition do i have\b/,
  /\bdiagnostic|diagnostica|diagnosticar|tengo\b|\bque enfermedad tengo\b|\bque condicion tengo\b/,
  /диагност|имам ли|какво заболяване имам|каква болест имам/,
];

const TREATMENT_CUES = [
  /\b(treat|treatment|cure|therapy|manage my|reverse)\b|\bwhat should i eat for\b|\bdiet for\b|\bfoods? for\b/,
  /\b(tratar|tratamiento|curar|cura|terapia)\b|\bque debo comer para\b|\bque comer para\b|\bdieta para\b|\balimentos para\b/,
  /лекув|лечение|терапия|излекув|какво да ям при|диета за|храни за/,
];

const LAB_TERMS = [
  /\b(lab result|lab results|blood test|blood tests|bloodwork|test result|test results|hba1c|glucose|cholesterol|hemoglobin|tsh|crp)\b/,
  /\b(analitica|analiticas|analisis de sangre|resultados de analisis|resultado de analisis|hba1c|glucosa|colesterol|hemoglobina|tsh|crp)\b/,
  /изследван|кръвн.*резултат|кръвна картина|глюкоз|холестерол|хемоглобин|\btsh\b|\bcrp\b/,
];

const LAB_INTERPRETATION_CUES = [
  /\b(my|mine|result|results|interpret|means?|high|low|normal|abnormal|range)\b|\d/,
  /\b(mi|mis|resultado|resultados|interpretar|interpreta|significa|alto|alta|bajo|baja|normal|anormal|rango)\b|\d/,
  /\bмои\b|\bмоите\b|резултат|тълкув|значи|висок|ниск|нормал|референт|\d/,
];

const PREGNANCY_TERMS = [
  /\b(pregnant|pregnancy|breastfeeding|breastfeed|lactation|nursing)\b/,
  /\b(embarazada|embarazo|lactancia|amamantar|amamantando)\b/,
  /бременна|бременност|кърмя|кърмене|лактация/,
];

const PREGNANCY_ADVICE_CUES = [
  /\b(should i|can i|may i|what should i eat|what can i eat|safe|avoid|take|diet|supplement|medication|medicine)\b/,
  /\b(debo|puedo|que debo comer|que puedo comer|seguro|evitar|tomar|dieta|suplemento|medicamento|medicacion)\b/,
  /може ли|трябва ли|какво да ям|безопас|избяг|прием|диета|добавк|лекарств/,
];

export function evaluateClinicalRequestBoundary(
  transcript: unknown,
): ClinicalRequestBoundaryResult {
  const text = normalizeText(transcript);
  const reasons: ClinicalRequestReason[] = [];

  if (
    matchesAny(text, MEDICATION_NOUNS) &&
    matchesAny(text, MEDICATION_ACTIONS)
  ) {
    reasons.push("medication_or_dose");
  }

  if (
    matchesAny(text, DIAGNOSIS_CUES) &&
    matchesAny(text, CONDITION_TERMS)
  ) {
    reasons.push("diagnosis");
  }

  if (
    matchesAny(text, TREATMENT_CUES) &&
    matchesAny(text, CONDITION_TERMS)
  ) {
    reasons.push("treatment_or_disease_specific_advice");
  }

  if (
    matchesAny(text, LAB_TERMS) &&
    matchesAny(text, LAB_INTERPRETATION_CUES)
  ) {
    reasons.push("lab_result_interpretation");
  }

  if (
    matchesAny(text, PREGNANCY_TERMS) &&
    matchesAny(text, PREGNANCY_ADVICE_CUES)
  ) {
    reasons.push("pregnancy_or_lactation_clinical_advice");
  }

  return {
    blocked: reasons.length > 0,
    reasons,
    version: CLINICAL_REQUEST_BOUNDARY_VERSION,
  };
}

export function getClinicalRequestBlockedMessage(
  language: "en" | "es" | "bg",
): string {
  if (language === "bg") {
    return "BalkanBite не предоставя диагноза, лечение, промени в лекарства или дози, тълкуване на лабораторни резултати или персонализирани клинични съвети при бременност/кърмене. За такива решения се обърнете към квалифициран лекар или фармацевт. Мога да помогна с готвене, функции на приложението и обща неклинична информация за храненето.";
  }
  if (language === "es") {
    return "BalkanBite no proporciona diagnósticos, tratamientos, cambios de medicación o dosis, interpretación de analíticas ni consejos clínicos personalizados durante el embarazo o la lactancia. Para esas decisiones, consulta con un profesional sanitario o farmacéutico cualificado. Sí puedo ayudarte con cocina, funciones de la app e información general de nutrición no clínica.";
  }
  return "BalkanBite does not provide diagnosis, treatment, medication or dose changes, lab-result interpretation, or personalized clinical guidance during pregnancy or breastfeeding. For those decisions, contact a qualified clinician or pharmacist. I can still help with cooking, app features, and general non-clinical nutrition information.";
}
