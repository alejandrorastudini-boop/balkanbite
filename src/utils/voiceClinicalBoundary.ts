export type VoiceClinicalBoundaryReason =
  | "medication_or_dose"
  | "diagnosis_or_treatment"
  | "lab_interpretation"
  | "disease_specific_advice"
  | "pregnancy_lactation_clinical";

export interface VoiceClinicalBoundaryResult {
  blocked: boolean;
  reason?: VoiceClinicalBoundaryReason;
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[“”"'!?;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

const MEDICATION_TERMS = [
  /\bmedication\b/u,
  /\bmedicine\b/u,
  /\bprescription\b/u,
  /\bdrug\b/u,
  /\bantibiotic\b/u,
  /\binsulin\b/u,
  /\bmetformin\b/u,
  /\bwarfarin\b/u,
  /\bmedicamento\b/u,
  /\bmedicina\b/u,
  /\bfarmaco\b/u,
  /\bantibiotico\b/u,
  /\binsulina\b/u,
  /\bmetformina\b/u,
  /\bwarfarina\b/u,
  /\bлекарств(?:о|а)\b/u,
  /\bмедикамент(?:и)?\b/u,
  /\bантибиотик(?:и)?\b/u,
  /\bинсулин\b/u,
  /\bметформин\b/u,
  /\bварфарин\b/u,
];

const SUPPLEMENT_TERMS = [
  /\bsupplement\b/u,
  /\bvitamin\b/u,
  /\bsuplemento\b/u,
  /\bvitamina\b/u,
  /\bдобавк(?:а|и)\b/u,
  /\bвитамин\b/u,
];

const DOSE_OR_INTERACTION_TERMS = [
  /\bdose\b/u,
  /\bdosage\b/u,
  /\bhow (?:much|many)\b/u,
  /\bmg\b/u,
  /\bmilligrams?\b/u,
  /\bshould i take\b/u,
  /\bcan i (?:take|stop|change|increase|decrease)\b/u,
  /\binteract(?:s|ion|ions)?\b/u,
  /\bwith food\b/u,
  /\bdosis\b/u,
  /\bdosificacion\b/u,
  /\bcuanto debo tomar\b/u,
  /\bpuedo (?:tomar|dejar|cambiar|subir|bajar)\b/u,
  /\binteracci(?:on|ones)\b/u,
  /\binteractua\b/u,
  /\bcon comida\b/u,
  /\bдоз(?:а|ировка)\b/u,
  /\bколко да (?:вземам|приемам)\b/u,
  /\bмога ли да (?:вземам|приемам|спра|сменя|увелича|намаля)\b/u,
  /\bвзаимодейства\b/u,
  /\bс храна\b/u,
];

const DIAGNOSIS_OR_TREATMENT_TERMS = [
  /\bdiagnos(?:e|is|ed|ing)\b/u,
  /\bmedical diagnosis\b/u,
  /\bwhat disease do i have\b/u,
  /\btreatment\b/u,
  /\bmedical treatment\b/u,
  /\bdiagnosticar\b/u,
  /\bdiagnostico\b/u,
  /\bque enfermedad tengo\b/u,
  /\btratamiento medico\b/u,
  /\btratamiento para\b/u,
  /\bдиагноз(?:а|ирай|иране)\b/u,
  /\bкакво заболяване имам\b/u,
  /\bмедицинско лечение\b/u,
  /\bлечение на\b/u,
];

const LAB_CONTEXT_TERMS = [
  /\blab results?\b/u,
  /\bblood test results?\b/u,
  /\bblood work\b/u,
  /\bmy hba1c\b/u,
  /\bmy creatinine\b/u,
  /\bmy cholesterol\b/u,
  /\bresultados? (?:de laboratorio|de sangre)\b/u,
  /\banalitica\b/u,
  /\bmi hba1c\b/u,
  /\bmi creatinina\b/u,
  /\bmi colesterol\b/u,
  /\bлабораторн(?:и|ия) резултат(?:и)?\b/u,
  /\bкръвн(?:и|о)(?: ми)? изследван(?:ия|е)\b/u,
  /\bмоят hba1c\b/u,
  /\bмоята креатинин\b/u,
  /\bмоят холестерол\b/u,
];

const INTERPRETATION_TERMS = [
  /\binterpret\b/u,
  /\bwhat does .* mean\b/u,
  /\bis .* (?:high|low|normal)\b/u,
  /\bexplain my\b/u,
  /\binterpretar\b/u,
  /\bque significa\b/u,
  /\bes .* (?:alto|bajo|normal)\b/u,
  /\bexplica mi\b/u,
  /\bтълкува(?:й|не)?\b/u,
  /\bкакво означава(?:т)?\b/u,
  /\b(?:висок|нисък|нормален) ли е\b/u,
  /\bобясни ми\b/u,
];

const PERSONAL_CONDITION_TERMS = [
  /\bi (?:have|was diagnosed with) (?:diabetes|kidney disease|celiac disease|hypertension|cancer|crohn(?:'s)?|ulcerative colitis|gout|liver disease)\b/u,
  /\bmy (?:diabetes|kidney disease|celiac disease|hypertension|cancer|crohn(?:'s)?|ulcerative colitis|gout|liver disease)\b/u,
  /\b(?:tengo|me diagnosticaron) (?:diabetes|enfermedad renal|celiaquia|hipertension|cancer|crohn|colitis ulcerosa|gota|enfermedad hepatica)\b/u,
  /\bmi (?:diabetes|enfermedad renal|celiaquia|hipertension|cancer|crohn|colitis ulcerosa|gota|enfermedad hepatica)\b/u,
  /\b(?:имам|диагностициран съм с|диагностицирана съм с) (?:диабет|бъбречно заболяване|цьолиакия|хипертония|рак|болест на крон|улцерозен колит|подагра|чернодробно заболяване)\b/u,
  /\bмоят (?:диабет|рак)\b/u,
  /\bмоята (?:хипертония|цьолиакия|подагра)\b/u,
];

const FOOD_ADVICE_TERMS = [
  /\bwhat should i eat\b/u,
  /\bwhat can i eat\b/u,
  /\bwhat foods should i avoid\b/u,
  /\bdiet for\b/u,
  /\bmeal plan for\b/u,
  /\bque debo comer\b/u,
  /\bque puedo comer\b/u,
  /\bque alimentos debo evitar\b/u,
  /\bdieta para\b/u,
  /\bкакво да ям\b/u,
  /\bкакво мога да ям\b/u,
  /\bкакви храни да избягвам\b/u,
  /\bдиета за\b/u,
];

const PREGNANCY_LACTATION_TERMS = [
  /\bpregnan(?:t|cy)\b/u,
  /\bbreastfeed(?:ing)?\b/u,
  /\blactat(?:e|ing|ion)\b/u,
  /\bembarazad(?:a|o)\b/u,
  /\bembarazo\b/u,
  /\blactancia\b/u,
  /\bamamantando\b/u,
  /\bбременн(?:а|ост)\b/u,
  /\bкърм(?:я|ене)\b/u,
];

const CLINICAL_NUTRITION_ACTION_TERMS = [
  ...FOOD_ADVICE_TERMS,
  /\bshould i avoid\b/u,
  /\bshould i take\b/u,
  /\bsupplement\b/u,
  /\bvitamin\b/u,
  /\bdebo evitar\b/u,
  /\bdebo tomar\b/u,
  /\bsuplemento\b/u,
  /\bvitamina\b/u,
  /\bда избягвам\b/u,
  /\bда приемам\b/u,
  /\bдобавк(?:а|и)\b/u,
  /\bвитамин\b/u,
];

/**
 * Narrow pre-LLM safety boundary for explicit clinical requests.
 *
 * This is intentionally not a diagnostic classifier. It only catches clear
 * high-risk intents that BalkanBite does not currently support and leaves
 * ordinary cooking/general nutrition education available.
 */
export function assessVoiceClinicalBoundary(
  transcript: unknown,
): VoiceClinicalBoundaryResult {
  if (typeof transcript !== "string" || !transcript.trim()) {
    return { blocked: false };
  }

  const text = normalize(transcript);
  const hasMedication = hasAny(text, MEDICATION_TERMS);
  const hasSupplement = hasAny(text, SUPPLEMENT_TERMS);
  const hasDoseOrInteraction = hasAny(text, DOSE_OR_INTERACTION_TERMS);

  if ((hasMedication || hasSupplement) && hasDoseOrInteraction) {
    return { blocked: true, reason: "medication_or_dose" };
  }

  if (hasAny(text, DIAGNOSIS_OR_TREATMENT_TERMS)) {
    return { blocked: true, reason: "diagnosis_or_treatment" };
  }

  if (
    hasAny(text, LAB_CONTEXT_TERMS) &&
    hasAny(text, INTERPRETATION_TERMS)
  ) {
    return { blocked: true, reason: "lab_interpretation" };
  }

  if (
    hasAny(text, PERSONAL_CONDITION_TERMS) &&
    hasAny(text, FOOD_ADVICE_TERMS)
  ) {
    return { blocked: true, reason: "disease_specific_advice" };
  }

  if (
    hasAny(text, PREGNANCY_LACTATION_TERMS) &&
    hasAny(text, CLINICAL_NUTRITION_ACTION_TERMS)
  ) {
    return { blocked: true, reason: "pregnancy_lactation_clinical" };
  }

  return { blocked: false };
}

export function getVoiceClinicalBoundaryMessage(
  language: "en" | "es" | "bg",
): string {
  if (language === "bg") {
    return "BalkanBite не предоставя чрез гласовия асистент диагнози, лечение, съвети за лекарства или дози, тълкуване на лабораторни резултати или лечебни хранителни режими за заболявания. За такива въпроси се обърнете към квалифициран медицински специалист, който познава вашия контекст. Мога да помогна с готвене, организация на храната и обща неклинична информация за храненето. При спешни симптоми потърсете местните спешни служби.";
  }
  if (language === "es") {
    return "BalkanBite no ofrece por voz diagnósticos, tratamientos, consejos sobre medicamentos o dosis, interpretación de analíticas ni dietas terapéuticas para enfermedades. Para esas cuestiones, consulta con un profesional sanitario cualificado que pueda valorar tu contexto. Sí puedo ayudarte con cocina, organización de alimentos e información nutricional general no clínica. Si los síntomas son urgentes, contacta con los servicios de emergencia de tu zona.";
  }
  return "BalkanBite does not provide diagnosis, treatment, medication or dosing advice, lab-result interpretation, or therapeutic diets for diseases through Voice. For those questions, use a qualified healthcare professional who can consider your context. I can still help with cooking, food organization, and general non-clinical nutrition information. If symptoms are urgent, contact your local emergency services.";
}
