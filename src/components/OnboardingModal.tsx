import React, { useState } from "react";
import { Sparkles, Check, ArrowRight, ShieldCheck } from "lucide-react";
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

  const currentText = t[language];
  const [step, setStep] = useState(1);
  const [speed, setSpeed] = useState<"fast" | "moderate" | "elaborate">("fast");
  const [goal, setGoal] = useState<"balanced" | "muscle" | "fat_loss" | "heart">("balanced");
  const [diet, setDiet] = useState<"all" | "mediterranean" | "vegetarian" | "vegan">("mediterranean");

  const finish = () => {
    onComplete({
      cookingSpeed: speed,
      healthGoal: goal,
      dietStyle: diet,
      onboardingCompleted: true,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0B0F12] border border-white/[0.08] rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white font-black text-xl shadow-inner mb-2 tracking-tighter">
            BB
          </div>
          <h2 className="text-lg font-bold text-white font-['Outfit'] tracking-wide">
            {currentText.welcomeTitle}
          </h2>
          <p className="text-xs text-stone-400 font-medium">
            {currentText.welcomeSubtitle}
          </p>
        </div>

        {/* Step 1: Speed */}
        {step === 1 && (
          <div className="space-y-4">
            <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest block text-center">
              1/3 • {currentText.cookingSpeed}
            </span>
            <div className="space-y-2.5">
              {[
                { id: "fast", label: currentText.speedFast },
                { id: "moderate", label: currentText.speedModerate },
                { id: "elaborate", label: currentText.speedElaborate },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSpeed(opt.id as any)}
                  className={`w-full p-3.5 rounded-xl border text-xs text-left font-bold transition-all ${
                    speed === opt.id
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-inner"
                      : "bg-white/[0.02] border-white/[0.04] text-stone-400 hover:text-stone-300 hover:bg-white/[0.04]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold uppercase tracking-widest text-xs flex items-center justify-center gap-1.5 mt-2 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
            >
              <span>{language === "bg" ? "Напред" : language === "es" ? "Siguiente" : "Next"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Step 2: Goal */}
        {step === 2 && (
          <div className="space-y-4">
            <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest block text-center">
              2/3 • {currentText.healthGoals}
            </span>
            <div className="space-y-2.5">
              {[
                { id: "balanced", label: currentText.goalBalanced },
                { id: "muscle", label: currentText.goalMuscle },
                { id: "fat_loss", label: currentText.goalFatLoss },
                { id: "heart", label: currentText.goalHeart },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setGoal(opt.id as any)}
                  className={`w-full p-3.5 rounded-xl border text-xs text-left font-bold transition-all ${
                    goal === opt.id
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-inner"
                      : "bg-white/[0.02] border-white/[0.04] text-stone-400 hover:text-stone-300 hover:bg-white/[0.04]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(3)}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold uppercase tracking-widest text-xs flex items-center justify-center gap-1.5 mt-2 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
            >
              <span>{language === "bg" ? "Напред" : language === "es" ? "Siguiente" : "Next"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Step 3: Diet */}
        {step === 3 && (
          <div className="space-y-4">
            <span className="text-[10px] font-extrabold text-teal-400 uppercase tracking-widest block text-center">
              3/3 • {currentText.dietType}
            </span>
            <div className="space-y-2.5">
              {[
                { id: "all", label: currentText.dietAll },
                { id: "mediterranean", label: currentText.dietMed },
                { id: "vegetarian", label: currentText.dietVegetarian },
                { id: "vegan", label: currentText.dietVegan },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setDiet(opt.id as any)}
                  className={`w-full p-3.5 rounded-xl border text-xs text-left font-bold transition-all ${
                    diet === opt.id
                      ? "bg-teal-500/10 border-teal-500/30 text-teal-400 shadow-inner"
                      : "bg-white/[0.02] border-white/[0.04] text-stone-400 hover:text-stone-300 hover:bg-white/[0.04]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={finish}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold uppercase tracking-widest text-xs flex items-center justify-center gap-2 mt-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{currentText.quickStart}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
