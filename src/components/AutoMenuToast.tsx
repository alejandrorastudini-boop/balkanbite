import React, { useEffect } from "react";
import { Sparkles, Calendar, ArrowRight, X, ChefHat, CheckCircle2 } from "lucide-react";
import { Language } from "../types";

interface AutoMenuToastProps {
  isVisible: boolean;
  onClose: () => void;
  onViewMenu: () => void;
  language: Language;
  readyMealsCount?: number;
}

export const AutoMenuToast: React.FC<AutoMenuToastProps> = ({
  isVisible,
  onClose,
  onViewMenu,
  language,
  readyMealsCount = 0,
}) => {
  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(() => {
      onClose();
    }, 7000);
    return () => clearTimeout(timer);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div
      id="auto-menu-toast-banner"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[45] w-[94%] max-w-md bg-[#131A1F]/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl p-3.5 shadow-[0_12px_40px_rgba(16,185,129,0.25)] animate-in fade-in slide-in-from-bottom-5 duration-300 flex items-start gap-3"
    >
      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500/30 to-amber-500/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
        <Sparkles className="w-5 h-5 animate-pulse" />
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-emerald-400 tracking-wide uppercase flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {language === "es"
              ? "Menú semanal actualizado"
              : language === "bg"
              ? "Менюто е актуализирано"
              : "Meal plan updated"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-white p-0.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-stone-200 leading-relaxed font-medium">
          {language === "es"
            ? "Tus comidas planificadas se han adaptado automáticamente a los nuevos ingredientes de tu despensa para evitar desperdicios."
            : language === "bg"
            ? "Вашите планирани ястия бяха пренаредени според новите продукти в килера."
            : "Your meal plan has adapted to use your newly added ingredients and reduce food waste."}
        </p>

        {readyMealsCount > 0 && (
          <p className="text-[11px] font-semibold text-emerald-300/90 pt-0.5">
            {language === "es"
              ? `🎯 ${readyMealsCount} platos listos para cocinar al 100%`
              : language === "bg"
              ? `🎯 ${readyMealsCount} ястия готови за готвене`
              : `🎯 ${readyMealsCount} meals ready to cook immediately`}
          </p>
        )}

        <div className="pt-1.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onViewMenu();
              onClose();
            }}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {language === "es"
                ? "Ver Menú Semanal"
                : language === "bg"
                ? "Виж менюто"
                : "View Meal Plan"}
            </span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
