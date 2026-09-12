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
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-emerald-500/40 rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-2xl">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-500 to-amber-500 flex items-center justify-center text-white font-black text-xl shadow-lg mb-2">
            BB
          </div>
          <h2 className="text-lg font-extrabold text-white font-['Outfit']">
            {currentText.welcomeTitle}
          </h2>
          <p className="text-xs text-stone-300">
            {currentText.welcomeSubtitle}
          </p>
        </div>

        {/* Step 1: Speed */}
        {step === 1 && (
          <div className="space-y-3">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
              1/3 • {currentText.cookingSpeed}
            </span>
            <div className="space-y-2">
              {[
                { id: "fast", label: currentText.speedFast },
                { id: "moderate", label: currentText.speedModerate },
                { id: "elaborate", label: currentText.speedElaborate },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSpeed(opt.id as any)}
                  className={`w-full p-3 rounded-xl border text-xs text-left font-medium transition-all ${
                    speed === opt.id
                      ? "bg-emerald-950/50 border-emerald-500 text-white"
                      : "bg-stone-800 border-stone-700 text-stone-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 mt-2"
            >
              <span>{language === "bg" ? "Напред" : "Next"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Step 2: Goal */}
        {step === 2 && (
          <div className="space-y-3">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
              2/3 • {currentText.healthGoals}
            </span>
            <div className="space-y-2">
              {[
                { id: "balanced", label: currentText.goalBalanced },
                { id: "muscle", label: currentText.goalMuscle },
                { id: "fat_loss", label: currentText.goalFatLoss },
                { id: "heart", label: currentText.goalHeart },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setGoal(opt.id as any)}
                  className={`w-full p-3 rounded-xl border text-xs text-left font-medium transition-all ${
                    goal === opt.id
                      ? "bg-amber-950/40 border-amber-500 text-white"
                      : "bg-stone-800 border-stone-700 text-stone-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(3)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 mt-2"
            >
              <span>{language === "bg" ? "Напред" : "Next"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Step 3: Diet */}
        {step === 3 && (
          <div className="space-y-3">
            <span className="text-xs font-bold text-teal-400 uppercase tracking-wider block">
              3/3 • {currentText.dietType}
            </span>
            <div className="space-y-2">
              {[
                { id: "all", label: currentText.dietAll },
                { id: "mediterranean", label: currentText.dietMed },
                { id: "vegetarian", label: currentText.dietVegetarian },
                { id: "vegan", label: currentText.dietVegan },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setDiet(opt.id as any)}
                  className={`w-full p-3 rounded-xl border text-xs text-left font-medium transition-all ${
                    diet === opt.id
                      ? "bg-teal-950/40 border-teal-500 text-white"
                      : "bg-stone-800 border-stone-700 text-stone-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={finish}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs flex items-center justify-center gap-1 mt-2 shadow-lg"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{currentText.quickStart}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
