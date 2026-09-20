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
  ShieldAlert,
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
  if (!isOpen) return null;

  const currentText = t[language] || t["es"];
  const [step, setStep] = useState(1);

  // Form State
  const [name, setName] = useState("");
  const [householdSize, setHouseholdSize] = useState<number>(2);
  const [cookingSpeed, setCookingSpeed] = useState<"fast" | "moderate" | "elaborate">("fast");
  const [dietStyle, setDietStyle] = useState<"all" | "mediterranean" | "vegetarian" | "vegan" | "keto" | "gluten_free">("mediterranean");
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [selectedAppliances, setSelectedAppliances] = useState<string[]>([]);
  const [monthlyBudgetEUR, setMonthlyBudgetEUR] = useState<number>(350);

  const toggleAllergy = (allergy: string) => {
    setSelectedAllergies((prev) =>
      prev.includes(allergy) ? prev.filter((a) => a !== allergy) : [...prev, allergy]
    );
  };

  const toggleAppliance = (appliance: string) => {
    setSelectedAppliances((prev) =>
      prev.includes(appliance) ? prev.filter((a) => a !== appliance) : [...prev, appliance]
    );
  };

  const finish = () => {
    const trimmedName = name.trim();

    onComplete({
      ...(trimmedName ? { name: trimmedName } : {}),
      householdSize,
      cookingSpeed,
      dietStyle,
      allergies: selectedAllergies,
      appliances: selectedAppliances,
      monthlyBudgetEUR,
      onboardingCompleted: true,
    });
  };

  const totalSteps = 4;

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
              <div className="grid grid-cols-4 gap-2">
                {[
                  { count: 1, label: "1 (Solo)" },
                  { count: 2, label: "2 (Pareja)" },
                  { count: 3, label: "3-4 (Familia)" },
                  { count: 5, label: "5+ (Grande)" },
                ].map((opt) => (
                  <button
                    key={opt.count}
                    type="button"
                    onClick={() => setHouseholdSize(opt.count)}
                    className={`p-2.5 rounded-xl border text-center transition-all text-xs font-bold ${
                      householdSize === opt.count
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-md"
                        : "bg-white/[0.02] border-white/[0.05] text-stone-400 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold uppercase tracking-widest text-xs flex items-center justify-center gap-2 mt-4 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
            >
              <span>{language === "bg" ? "Напред" : language === "es" ? "Siguiente" : "Next"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* STEP 2: Dieta & Alergias */}
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
                  { id: "gluten_free", label: "Sin Gluten" },
                  { id: "keto", label: "Keto / Baja en Carbos" },
                  { id: "all", label: "Sin Restricciones" },
                ].map((opt) => (
                  <button
                    key={opt.id}
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

            <div>
              <label className="text-xs font-bold text-stone-300 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                {language === "es" ? "Alergias o Intolerancias (Opcional)" : "Allergies or Intolerances"}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {["Gluten", "Lactosa", "Frutos Secos", "Marisco", "Huevos", "Soja"].map((allergy) => {
                  const isSelected = selectedAllergies.includes(allergy);
                  return (
                    <button
                      key={allergy}
                      type="button"
                      onClick={() => toggleAllergy(allergy)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                          : "bg-white/[0.02] border-white/[0.05] text-stone-400 hover:text-white"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-rose-400" />}
                      <span>{allergy}</span>
                    </button>
                  );
                })}
              </div>
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
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold uppercase tracking-widest text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
              >
                <span>Siguiente</span>
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
                type="button"
                onClick={() => setStep(4)}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold uppercase tracking-widest text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
              >
                <span>Siguiente</span>
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
                type="button"
                onClick={finish}
                className="flex-1 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold uppercase tracking-widest text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>{language === "es" ? "Comenzar Experiencia" : "Start Experience"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
