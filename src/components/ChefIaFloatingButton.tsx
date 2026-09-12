import React from "react";
import { Mic, Sparkles } from "lucide-react";
import { Language } from "../types";

interface ChefIaFloatingButtonProps {
  onClick: () => void;
  language: Language;
  isOpen?: boolean;
}

export const ChefIaFloatingButton: React.FC<ChefIaFloatingButtonProps> = ({
  onClick,
  language,
  isOpen = false,
}) => {
  if (isOpen) return null;

  const label =
    language === "es" ? "Chef IA" : language === "bg" ? "AI Шеф" : "AI Chef";

  return (
    <button
      id="chef-ia-floating-btn"
      type="button"
      onClick={onClick}
      className="fixed bottom-24 right-4 sm:bottom-28 sm:right-6 md:right-8 z-40 flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl font-bold shadow-[0_10px_30px_rgba(16,185,129,0.4)] transition-all duration-300 cursor-pointer group active:scale-95 ring-4 bg-gradient-to-b from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-stone-950 border border-emerald-300/60 ring-emerald-500/25 hover:shadow-[0_12px_40px_rgba(16,185,129,0.6)] hover:scale-105"
      title={language === "es" ? "Abrir Asistente Chef IA por Voz" : language === "bg" ? "Отвори Гласов AI Шеф" : "Open Voice AI Chef Assistant"}
      aria-label="Chef IA Voice Assistant"
    >
      <div className="relative flex items-center justify-center">
        <Mic className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:scale-110 text-stone-950" />
        <Sparkles className="w-2.5 h-2.5 absolute -top-1.5 -right-2.5 text-amber-300 animate-pulse" />
      </div>

      <span className="font-['Outfit'] font-extrabold text-[9px] sm:text-[10px] uppercase tracking-wider mt-0.5 leading-none">
        {label}
      </span>
    </button>
  );
};
