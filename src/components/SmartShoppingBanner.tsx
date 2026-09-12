import React, { useState } from "react";
import { ShoppingCart, AlertTriangle, ArrowRight, X, Clock, Sparkles, PlusCircle, CheckCircle2 } from "lucide-react";
import { Language, Currency, ShoppingItem } from "../types";
import { ShoppingAlertDiagnostic } from "../utils/shoppingAdvisor";

interface SmartShoppingBannerProps {
  diagnostic: ShoppingAlertDiagnostic;
  language: Language;
  currency: Currency;
  onOpenAdvisorModal: () => void;
  onAddMissingToShoppingList: (items: Array<Omit<ShoppingItem, "id" | "checked">>) => void;
  onGoToShoppingTab: () => void;
}

export const SmartShoppingBanner: React.FC<SmartShoppingBannerProps> = ({
  diagnostic,
  language,
  currency,
  onOpenAdvisorModal,
  onAddMissingToShoppingList,
  onGoToShoppingTab,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);

  if (isDismissed) return null;
  if (diagnostic.urgencyLevel === "optimal") return null;

  const isUrgent = diagnostic.urgencyLevel === "urgent";

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (diagnostic.itemsToAddToShoppingList.length > 0) {
      onAddMissingToShoppingList(diagnostic.itemsToAddToShoppingList);
      setAddedSuccess(true);
      setTimeout(() => setAddedSuccess(false), 3500);
    }
  };

  return (
    <div
      id="smart-shopping-alert-banner"
      className={`relative overflow-hidden rounded-3xl p-3.5 sm:p-4 border transition-all duration-300 shadow-[0_4px_25px_rgba(0,0,0,0.3)] mb-4 ${
        isUrgent
          ? "bg-gradient-to-r from-red-950/40 via-[#181313]/90 to-amber-950/20 border-red-500/40"
          : "bg-gradient-to-r from-amber-950/30 via-[#171613]/90 to-emerald-950/20 border-amber-500/40"
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            onClick={onOpenAdvisorModal}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border cursor-pointer ${
              isUrgent
                ? "bg-red-500/20 border-red-500/40 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.25)]"
                : "bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
            }`}
          >
            {isUrgent ? (
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            ) : (
              <ShoppingCart className="w-5 h-5" />
            )}
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  isUrgent
                    ? "bg-red-500 text-stone-950 font-black tracking-wider"
                    : "bg-amber-400 text-stone-950 font-black tracking-wider"
                }`}
              >
                {isUrgent
                  ? language === "es"
                    ? "¡Aviso de Compra Hoy!"
                    : language === "bg"
                    ? "Пазаруване днес!"
                    : "Shopping Needed Today!"
                  : language === "es"
                  ? "Sugerencia de Compra"
                  : language === "bg"
                  ? "Препоръка за пазар"
                  : "Shopping Suggested"}
              </span>

              {diagnostic.missingMealIngredients.length > 0 && (
                <span className="text-[11px] font-bold text-stone-300">
                  {language === "es"
                    ? `Faltan ${diagnostic.missingMealIngredients.length} ingredientes en menú`
                    : language === "bg"
                    ? `Липсват ${diagnostic.missingMealIngredients.length} съставки за менюто`
                    : `Missing ${diagnostic.missingMealIngredients.length} ingredients for meals`}
                </span>
              )}
            </div>

            <p className="text-xs text-stone-300 font-medium line-clamp-1 sm:line-clamp-none">
              {diagnostic.reasons[language][0] || diagnostic.headline[language]}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          {diagnostic.itemsToAddToShoppingList.length > 0 && (
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={addedSuccess}
              className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              {addedSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{language === "es" ? "¡Añadidos!" : "Added!"}</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>
                    {language === "es"
                      ? `Añadir faltantes (${diagnostic.itemsToAddToShoppingList.length})`
                      : `Add missing (${diagnostic.itemsToAddToShoppingList.length})`}
                  </span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAdvisorModal}
            className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-bold text-white flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <span>{language === "es" ? "Ver detalles" : "Details"}</span>
            <ArrowRight className="w-3 h-3 text-stone-400" />
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.05] transition-colors cursor-pointer"
            title={language === "es" ? "Ocultar aviso" : "Dismiss"}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
