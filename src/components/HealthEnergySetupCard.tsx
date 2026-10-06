import React, { useEffect, useState } from "react";
import type { HealthDataStatus, HealthProfile, Language } from "../types";
import { planAdultMaintenanceEnergyCollection } from "../utils/adultEnergyCollectionPlan";
import { setSelfReportedHealthProfileField } from "../utils/healthProfileEntry";

interface Props {
  profile: HealthProfile | undefined;
  language: Language;
  onSave: (profile: HealthProfile) => Promise<boolean>;
}

const options: Record<string, readonly string[]> = {
  physiologicalSex: ["female", "male"],
  activityCategory: ["low_active", "moderately_active", "active", "very_active"],
  pregnancyLactationStatus: ["not_pregnant_or_lactating", "pregnant_or_lactating"],
};

export const HealthEnergySetupCard: React.FC<Props> = ({ profile, language, onSave }) => {
  const plan = planAdultMaintenanceEnergyCollection(profile);
  const field = plan.status === "needs_input" ? plan.fieldsToRequest[0] : undefined;
  const [status, setStatus] = useState<HealthDataStatus | "">("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus("");
    setValue("");
    setError(null);
  }, [field]);

  if (!field) return null;

  const labels: Record<string, Record<Language, string>> = {
    ageYears: { en: "Age", es: "Edad", bg: "Възраст" },
    heightCm: { en: "Height (cm)", es: "Altura (cm)", bg: "Ръст (cm)" },
    weightKg: { en: "Weight (kg)", es: "Peso (kg)", bg: "Тегло (kg)" },
    physiologicalSex: { en: "Physiological sex for this calculation", es: "Sexo fisiológico para este cálculo", bg: "Физиологичен пол за това изчисление" },
    activityCategory: { en: "Whole-day activity", es: "Actividad diaria", bg: "Дневна активност" },
    pregnancyLactationStatus: { en: "Pregnancy/lactation status", es: "Embarazo/lactancia", bg: "Бременност/кърмене" },
  };

  const save = async () => {
    if (!status || saving) return;
    setError(null);
    const numeric = ["ageYears", "heightCm", "weightKg"].includes(field);
    const entryValue = status === "known" ? (numeric ? Number(value) : value) : undefined;
    const result = setSelfReportedHealthProfileField(profile, field, {
      status,
      value: entryValue,
      recordedAt: new Date().toISOString(),
    });
    if (!result.ok) {
      setError(language === "es" ? "El dato no es válido." : language === "bg" ? "Данните не са валидни." : "The value is invalid.");
      return;
    }
    setSaving(true);
    const persisted = await onSave(result.profile);
    setSaving(false);
    if (!persisted) setError(language === "es" ? "No se pudo guardar." : language === "bg" ? "Запазването не бе успешно." : "Could not save.");
  };

  return (
    <div data-testid="health-energy-progressive-entry" className="rounded-3xl border border-emerald-500/20 bg-[#131A1F]/60 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-white">
          {language === "es" ? "Datos opcionales para la estimación energética" : language === "bg" ? "Незадължителни данни за енергийната оценка" : "Optional data for the energy estimate"}
        </h3>
        <p className="mt-1 text-xs text-stone-400">
          {language === "es" ? "Pedimos solo el siguiente dato necesario. Puedes indicar que no lo sabes o que prefieres no decirlo. No usamos valores por defecto." : language === "bg" ? "Искаме само следващите необходими данни. Можете да посочите, че не знаете или предпочитате да не отговаряте. Не използваме стойности по подразбиране." : "Only the next necessary field is requested. You can say you do not know or prefer not to say. No defaults are used."}
        </p>
      </div>
      <div className="text-xs font-bold text-stone-200">{labels[field][language]}</div>
      <select value={status} onChange={(e) => setStatus(e.target.value as HealthDataStatus | "")} className="w-full rounded-xl border border-white/[0.08] bg-[#0B0F12] px-3 py-2.5 text-sm text-white">
        <option value="">{language === "es" ? "Elige una opción" : language === "bg" ? "Изберете опция" : "Choose an option"}</option>
        <option value="known">{language === "es" ? "Quiero indicarlo" : language === "bg" ? "Искам да посоча" : "I want to provide it"}</option>
        <option value="unknown">{language === "es" ? "No lo sé" : language === "bg" ? "Не знам" : "I don't know"}</option>
        <option value="prefer_not_to_say">{language === "es" ? "Prefiero no decirlo" : language === "bg" ? "Предпочитам да не отговарям" : "Prefer not to say"}</option>
      </select>
      {status === "known" && (
        options[field] ? (
          <select value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-[#0B0F12] px-3 py-2.5 text-sm text-white">
            <option value="">{language === "es" ? "Selecciona un valor" : language === "bg" ? "Изберете стойност" : "Select a value"}</option>
            {options[field].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
          </select>
        ) : (
          <input type="number" min="0" step={field === "ageYears" ? "1" : "0.1"} value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-[#0B0F12] px-3 py-2.5 text-sm text-white" />
        )
      )}
      {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
      <button type="button" disabled={!status || (status === "known" && !value) || saving} onClick={save} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-stone-950 disabled:opacity-40">
        {saving ? "…" : language === "es" ? "Guardar y continuar" : language === "bg" ? "Запази и продължи" : "Save and continue"}
      </button>
    </div>
  );
};
