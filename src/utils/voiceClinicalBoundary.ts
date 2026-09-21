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
  /лекарств(?:о|а)/u,
  /медикамент(?:и)?/u,
  /антибиотик(?:и)?/u,
  /инсулин/u,
  /метформин/u,
  /варфарин/u,
];

const SUPPLEMENT_TERMS = [
  /\bsupplement\b/u,
  /\bvitamin\b/u,
  /\bsuplemento\b/u,
  /\bvitamina\b/u,
  /добавк(?:а|и)/u,
  /витамин/u,
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
  /доз(?:а|ировка)/u,
  /колко да (?:вземам|приемам)/u,
  /мога ли да (?:вземам|приемам|спра|сменя|увелича|намаля)/u,
  /взаимодейства/u,
  /с храна/u,
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
  /диагноз(?:а|ирай|иране)/u,
  /какво заболяване имам/u,
  /медицинско лечение/u,
  /лечение на/u,
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
  /лабораторн(?:и|ия) резултат(?:и)?/u,
  /кръвн(?:и(?:те)?|о)(?: ми)? изследван(?:ия|е)/u,
  /моят hba1c/u,
  /моят креатинин/u,
  /моят холестерол/u,
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
  /тълкува(?:й|не)?/u,
  /какво означава(?:т)?/u,
  /(?:висок|нисък|нормален) ли е/u,
  /обясни ми/u,
];

const CLINICAL_CONDITION_TERMS = [
  /\bdiabetes\b/u,
  /\bkidney disease\b/u,
  /\bchronic kidney disease\b/u,
  /\bceliac disease\b/u,
  /\bhypertension\b/u,
  /\bcancer\b/u,
  /\bcrohn(?:s)?\b/u,
  /\bulcerative colitis\b/u,
  /\bgout\b/u,
  /\bliver disease\b/u,
  /\benfermedad renal\b/u,
  /\bceliaquia\b/u,
  /\bhipertension\b/u,
  /\bcancer\b/u,
  /\bcolitis ulcerosa\b/u,
  /\bgota\b/u,
  /\benfermedad hepatica\b/u,
  /диабет/u,
  /бъбречно заболяване/u,
  /цьолиакия/u,
  /хипертония/u,
  /рак/u,
  /болест на крон/u,
  /улцерозен колит/u,
  /подагра/u,
  /чернодробно заболяване/u,
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
  /какво да ям/u,
  /какво мога да ям/u,
  /какви храни да избягвам/u,
  /диета за/u,
];

const PREGNANCY_LACTATION_TERMS = [
  /\bpregnan(?:t|cy)\b/u,
  /\bbreastfeed(?:ing)?\b/u,
  /\blactat(?:e|ing|ion)\b/u,
  /\bembarazad(?:a|o)\b/u,
  /\bembarazo\b/u,
  /\blactancia\b/u,
  /\bamamantando\b/u,
  /бременн(?:а|ост)/u,
  /кърм(?:я|ене)/u,
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
  /да избягвам/u,
  /да приемам/u,
  /добавк(?:а|и)/u,
  /витамин/u,
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

  if (
    hasAny(text, PREGNANCY_LACTATION_TERMS) &&
    hasAny(text, CLINICAL_NUTRITION_ACTION_TERMS)
  ) {
    return { blocked: true, reason: "pregnancy_lactation_clinical" };
  }

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
    hasAny(text, CLINICAL_CONDITION_TERMS) &&
    hasAny(text, FOOD_ADVICE_TERMS)
  ) {
    return { blocked: true, reason: "disease_specific_advice" };
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
