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
  const label =
    language === "es" ? "Chef IA" : language === "bg" ? "AI Шеф" : "AI Chef";

  return (
    <button
      id="chef-ia-floating-btn"
      type="button"
      onClick={onClick}
      className={`fixed bottom-22 right-3 sm:bottom-26 sm:right-6 md:right-8 z-40 flex flex-col items-center justify-center w-13 h-13 sm:w-14 sm:h-14 rounded-2xl font-bold text-xs shadow-[0_8px_25px_rgba(16,185,129,0.35)] transition-all duration-300 cursor-pointer group active:scale-95 ${
        isOpen
          ? "bg-[#131A1F] border border-emerald-500/50 text-emerald-400 shadow-[0_8px_25px_rgba(0,0,0,0.8)] scale-95"
          : "bg-emerald-500 hover:bg-emerald-400 text-stone-950 border border-emerald-400/50 hover:shadow-[0_10px_35px_rgba(16,185,129,0.5)] hover:scale-105"
      }`}
      title={language === "es" ? "Abrir Asistente Chef IA" : language === "bg" ? "Отвори AI Шеф" : "Open AI Chef Assistant"}
      aria-label="Chef IA Assistant"
    >
      <div className="relative flex items-center justify-center">
        <Mic className={`w-4 h-4 sm:w-5 sm:h-5 ${isOpen ? "text-emerald-400 animate-pulse" : "text-stone-950"}`} />
        <Sparkles className="w-2 h-2 absolute -top-1 -right-2 text-amber-300 animate-pulse" />
      </div>

      <span className="font-['Outfit'] font-extrabold text-[9px] sm:text-[10px] uppercase tracking-tight mt-0.5 leading-none">
        {label}
      </span>
    </button>
  );
};
