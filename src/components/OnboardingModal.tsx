import React, { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Users,
  UtensilsCrossed,
  Wallet,
  Flame,
  CheckCircle2,
  ChefHat,
  Microwave,
  Check,
} from "lucide-react";
import { Language, UserProfile } from "../types";
import { t } from "../utils/translations";

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (profile: Partial<UserProfile>) => void;
  language: Language;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onComplete,
  language,
}) => {
  const currentText = t[language] || t["es"];
  const [step, setStep] = useState(1);

  // Form State
  const [name, setName] = useState("");
  const [householdSize, setHouseholdSize] = useState<number | null>(null);
  const [cookingSpeed, setCookingSpeed] = useState<
    "fast" | "moderate" | "elaborate" | null
  >(null);
  const [dietStyle, setDietStyle] = useState<
    "all" | "mediterranean" | "vegetarian" | "vegan" | null
  >(null);
  const [selectedAppliances, setSelectedAppliances] = useState<string[]>([]);
  const [monthlyBudgetEURInput, setMonthlyBudgetEURInput] = useState("");

  const toggleAppliance = (appliance: string) => {
    setSelectedAppliances((prev) =>
      prev.includes(appliance) ? prev.filter((a) => a !== appliance) : [...prev, appliance]
    );
  };

  const finish = () => {
    if (
      householdSize === null ||
      cookingSpeed === null ||
      dietStyle === null
    ) {
      return;
    }

    const trimmedName = name.trim();
    const trimmedBudget = monthlyBudgetEURInput.trim();
    const parsedBudget =
      trimmedBudget.length > 0 ? Number(trimmedBudget) : undefined;
    const hasValidBudget =
      parsedBudget === undefined ||
      (Number.isFinite(parsedBudget) && parsedBudget >= 0);

    if (!hasValidBudget) return;

    onComplete({
      ...(trimmedName ? { name: trimmedName } : {}),
      householdSize,
      cookingSpeed,
      dietStyle,
      appliances: selectedAppliances,
      ...(parsedBudget !== undefined
        ? { monthlyBudgetEUR: parsedBudget }
        : {}),
      onboardingCompleted: true,
    });
  };

  const totalSteps = 4;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0B0F12] border border-white/[0.08] rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-5 shadow-[0_25px_70px_rgba(0,0,0,0.9)] my-auto relative">
        {/* Header Badge */}
        <div className="text-center space-y-1.5">
          <div className="flex items-center justify-center gap-2 mb-1">
            <img
              src="/images/logo.jpg"
              alt="BalkanBite Logo"
              className="w-10 h-10 rounded-2xl object-cover border-2 border-emerald-500/30 shadow-[0_2px_10px_rgba(16,185,129,0.2)]"
            />
            <span className="text-xl font-bold text-white font-['Outfit'] tracking-wide">
              BalkanBite AI
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
            {language === "es"
              ? "Personaliza tu Cocina Inteligente"
              : language === "bg"
              ? "Персонализирайте вашата кухня"
              : "Customize Your Smart Kitchen"}
          </h2>

          <p className="text-xs text-stone-400 font-medium">
            {language === "es"
              ? "Ajustaremos las recetas y alertas según tu estilo de vida"
              : language === "bg"
              ? "Ще настроим рецептите спрямо вашия начин на живот"
              : "We'll adapt recipes and shopping alerts to your lifestyle"}
          </p>

          {/* Progress Bar */}
          <div className="w-full bg-white/[0.05] h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest block pt-0.5">
            Paso {step} de {totalSteps}
          </span>
        </div>

        {/* STEP 1: Hogar & Nombre */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-stone-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                <ChefHat className="w-3.5 h-3.5 text-emerald-400" />
                {language === "es" ? "¿Cómo te llamas?" : "Your Name"}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Alejandro"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-300 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                {language === "es" ? "¿Cuántas personas comen en casa?" : "Household size"}
              </label>
              <input
                id="onboarding-household-size"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={householdSize ?? ""}
                onChange={(event) => {
                  const raw = event.target.value.trim();
                  if (!raw) {
                    setHouseholdSize(null);
                    return;
                  }
                  const parsed = Number(raw);
                  setHouseholdSize(
                    Number.isInteger(parsed) && parsed >= 1 ? parsed : null,
                  );
                }}
                placeholder={
                  language === "bg"
                    ? "Напр. 2"
                    : language === "es"
                    ? "Ej. 2"
                    : "e.g. 2"
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <button
              id="onboarding-next-step-1"
              type="button"
              onClick={() => setStep(2)}
              disabled={householdSize === null}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 font-extrabold uppercase tracking-widest text-xs flex items-center justify-center gap-2 mt-4 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
            >
              <span>{language === "bg" ? "Напред" : language === "es" ? "Siguiente" : "Next"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* STEP 2: culinary preference only; clinical/restriction capture is deferred */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-stone-300 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-400" />
                {language === "es" ? "Estilo de Dieta Preferido" : "Dietary Style"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "mediterranean", label: "Mediterránea (Equilibrada)" },
                  { id: "vegetarian", label: "Vegetariana" },
                  { id: "vegan", label: "Vegana" },
                  { id: "all", label: "Sin restricciones culinarias" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    id={`onboarding-diet-${opt.id}`}
                    type="button"
                    onClick={() => setDietStyle(opt.id as any)}
                    className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                      dietStyle === opt.id
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-md"
                        : "bg-white/[0.02] border-white/[0.05] text-stone-400 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-[11px] leading-relaxed text-stone-400">
                {language === "bg"
                  ? "Алергии, непоносимости, безглутенови и кето режими временно не се събират тук. BalkanBite ще добави отделен проверим поток за хранителни ограничения, вместо да ги третира като обикновени предпочитания."
                  : language === "es"
                  ? "Las alergias, intolerancias y las opciones sin gluten o keto no se recogen aquí por ahora. BalkanBite añadirá un flujo específico y verificable para restricciones alimentarias en lugar de tratarlas como simples preferencias."
                  : "Allergies, intolerances, gluten-free, and keto options are not collected here for now. BalkanBite will add a dedicated, verifiable food-restriction flow instead of treating them as ordinary preferences."}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-3 px-4 rounded-xl bg-white/[0.04] text-stone-400 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Atrás</span>
              </button>
              <button
                id="onboarding-next-step-2"
                type="button"
                onClick={() => setStep(3)}
                disabled={dietStyle === null}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 font-extrabold uppercase tracking-widest text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
              >
                <span>{language === "bg" ? "Напред" : language === "es" ? "Siguiente" : "Next"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Cooking speed */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-stone-300 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-emerald-400" />
                {language === "es" ? "¿Cuánto tiempo tienes para cocinar?" : "Cooking Speed"}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "fast", label: "Express (< 20 min)" },
                  { id: "moderate", label: "Normal (20-40 min)" },
                  { id: "elaborate", label: "Gourmet (+40 min)" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    id={`onboarding-cooking-${opt.id}`}
                    type="button"
                    onClick={() => setCookingSpeed(opt.id as any)}
                    className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                      cookingSpeed === opt.id
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-md"
                        : "bg-white/[0.02] border-white/[0.05] text-stone-400 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="py-3 px-4 rounded-xl bg-white/[0.04] text-stone-400 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Atrás</span>
              </button>
              <button
                id="onboarding-next-step-3"
                type="button"
                onClick={() => setStep(4)}
                disabled={cookingSpeed === null}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 font-extrabold uppercase tracking-widest text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
              >
                <span>{language === "bg" ? "Напред" : language === "es" ? "Siguiente" : "Next"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Equipamiento & Presupuesto */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-stone-300 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <Microwave className="w-3.5 h-3.5 text-teal-400" />
                {language === "es" ? "Equipamiento de Cocina Disponible" : "Kitchen Appliances"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {["Airfryer", "Horno", "Thermomix / Robot", "Microondas", "Sartén / Vitro"].map((appliance) => {
                  const isSelected = selectedAppliances.includes(appliance);
                  return (
                    <button
                      key={appliance}
                      type="button"
                      onClick={() => toggleAppliance(appliance)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between ${
                        isSelected
                          ? "bg-teal-500/20 border-teal-500/40 text-teal-300"
                          : "bg-white/[0.02] border-white/[0.05] text-stone-400 hover:text-white"
                      }`}
                    >
                      <span>{appliance}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-teal-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-300 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                {language === "es" ? "Presupuesto Mensual de Alimentación Estimado" : "Monthly Grocery Budget"}
              </label>
              <div className="bg-white/[0.02] border border-white/[0.05] p-3 rounded-2xl space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-white">
                  <span>Presupuesto Aproximado:</span>
                  <span className="text-emerald-400 text-sm font-black">{monthlyBudgetEUR} €/mes</span>
                </div>
                <input
                  type="range"
                  min="150"
                  max="800"
                  step="25"
                  value={monthlyBudgetEUR}
                  onChange={(e) => setMonthlyBudgetEUR(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-500 font-medium">
                  <span>150 €</span>
                  <span>800 €</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="py-3 px-4 rounded-xl bg-white/[0.04] text-stone-400 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Atrás</span>
              </button>
              <button
                id="onboarding-finish"
                type="button"
                onClick={finish}
                className="flex-1 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold uppercase tracking-widest text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>{language === "bg" ? "Започни" : language === "es" ? "Comenzar Experiencia" : "Start Experience"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
