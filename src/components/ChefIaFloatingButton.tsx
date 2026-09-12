import React from "react";
import { Sparkles, Mic } from "lucide-react";
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
      className={`fixed bottom-20 right-4 sm:bottom-22 sm:right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full text-white font-extrabold text-xs sm:text-sm tracking-wide shadow-2xl transition-all duration-300 cursor-pointer group active:scale-95 ${
        isOpen
          ? "bg-stone-800 border border-stone-600 shadow-stone-950/60 scale-95 opacity-80"
          : "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 border border-emerald-400/40 shadow-emerald-950/50 hover:shadow-emerald-900/80 hover:scale-105"
      }`}
      title={language === "es" ? "Abrir Asistente Chef IA" : language === "bg" ? "Отвори AI Шеф" : "Open AI Chef Assistant"}
      aria-label="Chef IA Assistant"
    >
      {/* Glowing pulsing dot */}
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
      </span>

      {/* Sparkles Icon */}
      <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />

      {/* Label */}
      <span className="font-['Outfit'] font-bold drop-shadow-sm">{label}</span>

      {/* Mic icon indicator */}
      <div className="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center text-emerald-200 group-hover:text-white transition-colors">
        <Mic className="w-3 h-3" />
      </div>
    </button>
  );
};
