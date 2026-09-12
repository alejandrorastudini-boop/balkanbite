import React, { useState } from "react";
import {
  ShoppingCart,
  AlertTriangle,
  Clock,
  Sparkles,
  CheckCircle2,
  X,
  ArrowRight,
  PlusCircle,
  Bell,
  BellRing,
  Volume2,
  PackageX,
  Calendar,
  DollarSign,
} from "lucide-react";
import { Language, Currency, PantryItem, Recipe, MealPlanDay, ShoppingItem } from "../types";
import { ShoppingAlertDiagnostic } from "../utils/shoppingAdvisor";

interface SmartShoppingModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostic: ShoppingAlertDiagnostic;
  language: Language;
  currency: Currency;
  onAddMissingToShoppingList: (items: Array<Omit<ShoppingItem, "id" | "checked">>) => void;
  onGoToShoppingTab: () => void;
  onRequestBrowserNotifications?: () => void;
  hasNotificationPermission?: boolean;
}

export const SmartShoppingModal: React.FC<SmartShoppingModalProps> = ({
  isOpen,
  onClose,
  diagnostic,
  language,
  currency,
  onAddMissingToShoppingList,
  onGoToShoppingTab,
  onRequestBrowserNotifications,
  hasNotificationPermission = false,
}) => {
  const [addedSuccess, setAddedSuccess] = useState(false);

  if (!isOpen) return null;

  const {
    urgencyLevel,
    urgencyScore,
    urgencyLabel,
    headline,
    reasons,
    missingMealIngredients,
    depletedPantryItems,
    pendingShoppingItemsCount,
    estimatedTotalTripEUR,
    itemsToAddToShoppingList,
    daysUntilNextTripNeeded,
  } = diagnostic;

  const currRate = currency === "USD" ? 1.08 : 1.0;
  const currSym = currency === "USD" ? "$" : "€";
  const tripCostFormatted = (estimatedTotalTripEUR * currRate).toFixed(2);

  const handleAddMissing = () => {
    if (itemsToAddToShoppingList.length > 0) {
      onAddMissingToShoppingList(itemsToAddToShoppingList);
      setAddedSuccess(true);
      setTimeout(() => {
        setAddedSuccess(false);
      }, 4000);
    }
  };

  const getUrgencyColor = () => {
    if (urgencyLevel === "urgent") {
      return {
        bg: "bg-red-500/10 border-red-500/30 text-red-400",
        badge: "bg-red-500 text-stone-950",
        progress: "bg-gradient-to-r from-amber-500 to-red-500",
        ring: "border-red-500/40 shadow-[0_0_25px_rgba(239,68,68,0.2)]",
      };
    }
    if (urgencyLevel === "recommended") {
      return {
        bg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
        badge: "bg-amber-400 text-stone-950",
        progress: "bg-gradient-to-r from-emerald-500 to-amber-500",
        ring: "border-amber-500/40 shadow-[0_0_25px_rgba(245,158,11,0.2)]",
      };
    }
    return {
      bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
      badge: "bg-emerald-400 text-stone-950",
      progress: "bg-emerald-500",
      ring: "border-emerald-500/30",
    };
  };

  const colors = getUrgencyColor();

  return (
    <div
      id="smart-shopping-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="smart-shopping-modal-card"
        className="w-full max-w-lg bg-[#11161B] border border-white/[0.08] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 text-white max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${colors.bg} ${colors.ring}`}
            >
              {urgencyLevel === "urgent" ? (
                <AlertTriangle className="w-6 h-6 animate-pulse text-red-400" />
              ) : urgencyLevel === "recommended" ? (
                <ShoppingCart className="w-6 h-6 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold font-['Outfit']">
                  {language === "es"
                    ? "Asesor Inteligente de Compra"
                    : language === "bg"
                    ? "Умен съветник за пазаруване"
                    : "Smart Grocery Shopping Advisor"}
                </h3>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${colors.badge}`}
                >
                  {urgencyScore}%
                </span>
              </div>
              <p className="text-xs text-stone-400">
                {language === "es"
                  ? "Detección proactiva de reposición y menús semanales"
                  : language === "bg"
                  ? "Проактивен анализ на килера и менютата"
                  : "Proactive replenishment & meal inventory diagnostics"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1.5 rounded-xl hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Urgency Status Banner */}
        <div
          className={`p-4 rounded-2xl border ${colors.bg} space-y-2.5`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {urgencyLabel[language]}
            </span>
            <span className="text-xs font-bold text-white">
              {daysUntilNextTripNeeded === 0
                ? language === "es"
                  ? "Recomendado: Hoy"
                  : language === "bg"
                  ? "Препоръка: Днес"
                  : "Recommended: Today"
                : daysUntilNextTripNeeded === 1
                ? language === "es"
                  ? "Recomendado: Mañana"
                  : language === "bg"
                  ? "Препоръка: Утре"
                  : "Recommended: Tomorrow"
                : language === "es"
                ? `En ${daysUntilNextTripNeeded} días`
                : language === "bg"
                ? `След ${daysUntilNextTripNeeded} дни`
                : `In ${daysUntilNextTripNeeded} days`}
            </span>
          </div>

          {/* Progress gauge */}
          <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden border border-white/[0.05]">
            <div
              className={`h-full ${colors.progress} transition-all duration-500`}
              style={{ width: `${Math.max(10, urgencyScore)}%` }}
            />
          </div>

          <p className="text-xs text-stone-200 font-medium leading-relaxed">
            {headline[language]}
          </p>
        </div>

        {/* Reasons Diagnostic List */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
            {language === "es"
              ? "Diagnóstico y Motivos de Compra:"
              : language === "bg"
              ? "Причини за пазаруване:"
              : "Shopping Triggers & Diagnostics:"}
          </h4>
          <div className="space-y-1.5">
            {reasons[language].map((reason, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-xs text-stone-300 bg-white/[0.02] border border-white/[0.04] p-2.5 rounded-xl"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Missing Ingredients for Upcoming Meals Breakdown */}
        {missingMealIngredients.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                {language === "es"
                  ? "Ingredientes que te faltan para cocinar:"
                  : language === "bg"
                  ? "Липсващи съставки за готвене:"
                  : "Missing ingredients for scheduled meals:"}
              </h4>
              <span className="text-[11px] font-bold text-emerald-400">
                {missingMealIngredients.length} {language === "es" ? "faltantes" : "missing"}
              </span>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {missingMealIngredients.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs bg-black/30 border border-white/[0.04] p-2 rounded-xl"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-white capitalize block truncate">
                      {item.ingredientName}
                    </span>
                    <span className="text-[10px] text-stone-400 truncate block">
                      {item.recipeTitle} ({item.dayLabel})
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 shrink-0">
                    {item.amount} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Depleted items breakdown */}
        {depletedPantryItems.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
              <PackageX className="w-3.5 h-3.5 text-red-400" />
              {language === "es"
                ? "Básicos de despensa agotados o bajo mínimos:"
                : language === "bg"
                ? "Изчерпани продукти в килера:"
                : "Pantry items depleted or critical:"}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {depletedPantryItems.map((item) => (
                <span
                  key={item.id}
                  className="text-[11px] font-semibold bg-red-500/10 border border-red-500/20 text-red-300 px-2 py-0.5 rounded-lg"
                >
                  {item.name} ({item.quantity} {item.unit})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Estimated Cost & Items Count */}
        <div className="bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/[0.06] rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-stone-400 uppercase block">
                {language === "es" ? "Presupuesto Estimado" : "Estimated Basket"}
              </span>
              <span className="text-sm font-extrabold text-white">
                {currSym}
                {tripCostFormatted}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold text-stone-400 uppercase block">
              {language === "es" ? "Artículos a comprar" : "Items to buy"}
            </span>
            <span className="text-sm font-extrabold text-amber-400">
              {pendingShoppingItemsCount + itemsToAddToShoppingList.length}
            </span>
          </div>
        </div>

        {/* Browser Notifications Toggle */}
        {onRequestBrowserNotifications && (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400 shrink-0">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-200">
                  {language === "es"
                    ? "Avisos en el Navegador"
                    : language === "bg"
                    ? "Известия в браузъра"
                    : "Browser Notifications"}
                </p>
                <p className="text-[10px] text-stone-400">
                  {language === "es"
                    ? "Recibe alertas proactivas cuando falten ingredientes"
                    : "Receive timely reminders when supplies run low"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onRequestBrowserNotifications}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                hasNotificationPermission
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/[0.1]"
              }`}
            >
              {hasNotificationPermission
                ? language === "es"
                  ? "✓ Activas"
                  : "✓ Active"
                : language === "es"
                ? "Activar"
                : "Enable"}
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-2">
          {itemsToAddToShoppingList.length > 0 && (
            <button
              type="button"
              onClick={handleAddMissing}
              disabled={addedSuccess}
              className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(16,185,129,0.3)] cursor-pointer disabled:opacity-80"
            >
              {addedSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {language === "es"
                      ? "¡Ingredientes añadidos a la Lista!"
                      : language === "bg"
                      ? "Добавени в списъка!"
                      : "Added to Shopping List!"}
                  </span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>
                    {language === "es"
                      ? `Añadir ${itemsToAddToShoppingList.length} faltantes a la Lista`
                      : language === "bg"
                      ? `Добави ${itemsToAddToShoppingList.length} липсващи в списъка`
                      : `Add ${itemsToAddToShoppingList.length} Missing to Shopping List`}
                  </span>
                </>
              )}
            </button>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onGoToShoppingTab();
                onClose();
              }}
              className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-bold text-stone-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {language === "es"
                  ? "Abrir Lista de la Compra"
                  : language === "bg"
                  ? "Отвори списъка"
                  : "Open Shopping List"}
              </span>
              <ArrowRight className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-xs font-bold text-stone-400 transition-colors cursor-pointer"
            >
              {language === "es" ? "Cerrar" : "Close"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
