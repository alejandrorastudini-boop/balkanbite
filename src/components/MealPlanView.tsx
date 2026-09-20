import React, { useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Activity,
  Target,
  Trash2,
  CheckCircle2,
  Sparkles,
  Printer,
  Globe,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { Recipe, MealPlanDay, Language, MealLog, ShoppingItem, Currency, PantryItem } from "../types";
import { t } from "../utils/translations";
import { ConfirmModal } from "./ConfirmModal";
import { PrintMenuModal } from "./PrintMenuModal";
import { useGoogleCalendarSync } from "../hooks/useGoogleCalendarSync";
import { calculateRecipePantryScore } from "../utils/menuAutoPlanner";
import { evaluateShoppingNeeds } from "../utils/shoppingAdvisor";
import { findPlannedMealForDate } from "../utils/mealPlanLookup";
import { summarizeVerifiedMealNutrition, verifiedMealCalories } from "../utils/mealNutritionSummary";

interface MealPlanViewProps {
  mealPlan: MealPlanDay[];
  mealLogs: MealLog[];
  pantry?: PantryItem[];
  language: Language;
  currency?: Currency;
  shoppingList?: ShoppingItem[];
  userName?: string;
  onClearMealPlan?: () => void;
  onNavigateToVoice?: () => void;
  isPro?: boolean;
  onOpenProModal?: () => void;
  onGenerateAiWeekPlan?: () => void;
  onAdaptToPantry?: () => void;
  isGeneratingPlan?: boolean;
  onAddItemsToShoppingList?: (items: Array<Omit<ShoppingItem, "id" | "checked">>) => void;
}

export const MealPlanView: React.FC<MealPlanViewProps> = ({
  mealPlan,
  mealLogs,
  pantry = [],
  language,
  currency = "EUR",
  shoppingList = [],
  userName,
  onClearMealPlan,
  onNavigateToVoice,
  isPro = false,
  onOpenProModal,
  onGenerateAiWeekPlan,
  onAdaptToPantry,
  isGeneratingPlan = false,
  onAddItemsToShoppingList,
}) => {
  const currentText = t[language];
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [logTipVisible, setLogTipVisible] = useState(false);
  const { sync: syncToCalendar, isSyncing: isCalendarSyncing } = useGoogleCalendarSync();

  const selectedDateStr = selectedDate.toISOString().split("T")[0];
  const dailyLogs = mealLogs.filter((log) => log.date === selectedDateStr);

  const nutritionSummary = summarizeVerifiedMealNutrition(dailyLogs);
  const totalNutrition = nutritionSummary.totals;

  const getRecipeTitle = (recipe?: Recipe | null) => {
    if (!recipe) return "-";
    if (language === "es" && recipe.title?.es) return recipe.title.es;
    if (language === "bg" && recipe.title?.bg) return recipe.title.bg;
    return recipe.title?.en || "-";
  };

  // Generate monthly calendar grid for CURRENT month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const days = [];

    // Monday-based padding (0 is Monday, 6 is Sunday)
    const padding = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < padding; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const calendarDays = getDaysInMonth(new Date());

  const getMealForDay = (date: Date): MealPlanDay | null =>
    findPlannedMealForDate(mealPlan, date.toISOString().split("T")[0]);

  const selectedMeal = getMealForDay(selectedDate);

  // Generate Next 7 days list
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return getMealForDay(d);
  }).filter((d): d is MealPlanDay => d !== null);

  const allPlannedMeals = next7Days.flatMap((d) => [d.breakfast, d.lunch, d.dinner]).filter(Boolean) as Recipe[];
  const readyToCookCount = allPlannedMeals.filter((r) => {
    const score = calculateRecipePantryScore(r, pantry);
    return score.matchPercentage === 100;
  }).length;

  const shoppingDiagnostic = evaluateShoppingNeeds(pantry, mealPlan, shoppingList, language);
  const missingCount = shoppingDiagnostic.itemsToAddToShoppingList.length;

  const dayHeaders =
    language === "es"
      ? ["L", "M", "X", "J", "V", "S", "D"]
      : language === "bg"
      ? ["П", "В", "С", "Ч", "П", "С", "Н"]
      : ["M", "T", "W", "T", "F", "S", "S"];

  const monthLabel = new Date().toLocaleString(
    language === "es" ? "es-ES" : language === "bg" ? "bg-BG" : "en-US",
    { month: "long", year: "numeric" }
  );

  const renderPantryBadge = (rec?: Recipe | null) => {
    if (!rec) return null;
    const score = calculateRecipePantryScore(rec, pantry);
    if (score.matchPercentage === 100) {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shadow-xs">
          <CheckCircle2 className="w-2.5 h-2.5" />
          {language === "es" ? "100% Despensa" : language === "bg" ? "100% в килера" : "100% in Pantry"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-400/90 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
        {score.matchPercentage}% {language === "es" ? "disp." : language === "bg" ? "налично" : "stock"}
      </span>
    );
  };

  return (
    <div id="meal-plan-view" className="space-y-4 pb-36 sm:pb-32">
      <p className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs leading-relaxed text-sky-100">
        {language === "bg"
          ? "Записите за храненията отразяват декларираното от вас. Показаните хранителни стойности може да са приблизителни и не са проверена дневна сума."
          : language === "es"
          ? "Los registros de comidas reflejan lo que declaraste. Los valores nutricionales mostrados pueden ser estimados y no son un total diario verificado."
          : "Meal logs reflect what you declared. Nutrition values shown may be estimated and are not a verified daily total."}
      </p>
      {/* AI Meal Plan PRO Feature Banner */}
      <div className="bg-[#131A1F]/80 backdrop-blur-md border border-amber-500/20 rounded-3xl p-5 shadow-[0_8px_30px_rgba(245,158,11,0.08)] relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 blur-[60px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none group-hover:bg-amber-500/15 transition-all duration-700" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5 max-w-lg">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Sparkles className="w-3 h-3" />
                {currentText.mealPlanProBadge || "PRO"}
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white font-['Outfit'] tracking-wide">
                {currentText.mealPlanAutoGeneratePro || "Auto-Generar Menú Semanal con IA"}
              </h3>
            </div>
            <p className="text-sm text-stone-400 leading-relaxed font-medium mt-1">
              {currentText.mealPlanAutoGenerateDesc || "La IA analiza tu despensa y tus objetivos para planificar 7 días equilibrados y recortar tu gasto de súper."}
            </p>
          </div>
          
          <button
            onClick={() => {
              if (isPro && onGenerateAiWeekPlan) {
                onGenerateAiWeekPlan();
              } else if (onOpenProModal) {
                onOpenProModal();
              }
            }}
            disabled={isGeneratingPlan}
            className={`w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-sm tracking-wide transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] flex items-center justify-center gap-2 ${
              isPro
                ? "bg-amber-500 hover:bg-amber-400 text-stone-950 border border-amber-400/50"
                : "bg-white/[0.04] hover:bg-white/[0.08] text-amber-400 border border-amber-500/30"
            }`}
          >
            {isGeneratingPlan ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Generando...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{isPro ? "Generar Plan" : "Desbloquear Planificador IA"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Pantry Sync & Anti-Waste Optimization Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-[#131A1F]/90 to-amber-950/20 border border-emerald-500/30 rounded-3xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.2)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <Sparkles className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white font-['Outfit']">
                {language === "es"
                  ? "Menú Sincronizado con Despensa"
                  : language === "bg"
                  ? "Меню, синхронизирано с килера"
                  : "Menu Synced with Pantry"}
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {readyToCookCount} {language === "es" ? "platos listos al 100%" : "ready meals"}
              </span>
            </div>
            <p className="text-xs text-stone-400 font-medium mt-0.5">
              {language === "es"
                ? "El menú se actualiza automáticamente al hacer la compra o añadir a despensa para aprovechar tus ingredientes."
                : language === "bg"
                ? "Менюто се пренарежда автоматично при пазаруване или добавяне в килера за нулеви отпадъци."
                : "The menu adapts automatically upon shopping or adding to pantry to maximize ingredient use."}
            </p>
          </div>
        </div>

        {onAdaptToPantry && (
          <button
            type="button"
            onClick={onAdaptToPantry}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm shrink-0"
            title={language === "es" ? "Re-adaptar menú con los ingredientes actuales de la despensa" : "Re-sync menu to current pantry"}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>
              {language === "es"
                ? "Adaptar a Despensa"
                : language === "bg"
                ? "Пренареди според килера"
                : "Re-adapt to Pantry"}
            </span>
          </button>
        )}
      </div>

      {missingCount > 0 && onAddItemsToShoppingList && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in shadow-[0_4px_20px_rgba(245,158,11,0.06)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-300 font-['Outfit']">
                {language === "es"
                  ? `Faltan ${missingCount} ingredientes en tu despensa para este menú.`
                  : language === "bg"
                  ? `Липсват ${missingCount} съставки в килера за това меню.`
                  : `${missingCount} ingredients missing from pantry for this menu.`}
              </p>
              <p className="text-xs text-stone-400 font-medium mt-0.5">
                {language === "es"
                  ? "Puedes añadirlos directamente a tu lista de la compra con un solo clic."
                  : "Add them directly to your shopping list with 1 click."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onAddItemsToShoppingList(shoppingDiagnostic.itemsToAddToShoppingList)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] shrink-0 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>
              {language === "es"
                ? "🛒 Añadir faltantes a la compra"
                : "Add missing to shopping list"}
            </span>
          </button>
        </div>
      )}

      {/* Calendar Header */}
      <div className="bg-[#131A1F]/60 backdrop-blur-md border border-white/[0.06] rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-inner">
              <Calendar className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white font-['Outfit'] tracking-wide">
              {currentText.mealPlanTitle}
            </h2>
          </div>
          <p className="text-[10px] text-stone-500 mt-1 uppercase tracking-widest font-bold capitalize ml-10">
            {monthLabel}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => syncToCalendar(next7Days, language)}
            disabled={isCalendarSyncing}
            className="p-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-stone-300 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all flex items-center gap-2 text-sm font-bold cursor-pointer shadow-sm disabled:opacity-50"
            title={language === "es" ? "Sincronizar con Google Calendar" : language === "bg" ? "Синхронизирай с Google Calendar" : "Sync with Google Calendar"}
          >
            <Globe className={`w-4 h-4 text-blue-400 ${isCalendarSyncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">
              {isCalendarSyncing
                ? (language === "es" ? "Sincronizando..." : language === "bg" ? "Синхронизиране..." : "Syncing...")
                : "Google Calendar"}
            </span>
          </button>

          <button
            id="btn-print-fridge-sheet"
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="p-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-stone-300 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all flex items-center gap-2 text-sm font-bold cursor-pointer shadow-sm"
            title={currentText.printWeeklyMenu || "Imprimir Menú de Nevera"}
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">
              {currentText.printWeeklyMenu || "Imprimir Menú"}
            </span>
          </button>

          {onClearMealPlan && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="p-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-rose-500/5 border border-rose-500/10 text-rose-400/80 hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10 transition-all flex items-center gap-2 text-sm font-bold cursor-pointer"
              title={currentText.mealPlanClearAll}
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">
                {currentText.mealPlanClearAll}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Monthly Grid */}
      <div className="bg-black/20 border border-white/[0.04] rounded-3xl p-4 shadow-inner">
        <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] text-stone-500 mb-2 font-bold uppercase tracking-widest">
          {dayHeaders.map((d, i) => (
            <div key={`${d}-${i}`} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day, idx) => {
            if (!day) return <div key={idx} className="h-12" />;
            const isToday = day.toDateString() === new Date().toDateString();
            const isSelected = day.toDateString() === selectedDate.toDateString();
            const meal = getMealForDay(day);
            const hasLog = mealLogs.some((l) => l.date === day.toISOString().split("T")[0]);

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedDate(day)}
                className={`rounded-xl p-1 h-[52px] border transition-all flex flex-col items-center justify-between cursor-pointer ${
                  isSelected
                    ? "bg-emerald-500 border-emerald-400 text-stone-950 shadow-[0_4px_15px_rgba(16,185,129,0.3)] scale-[1.05] z-10"
                    : isToday
                    ? "bg-[#131A1F] border-emerald-500/80 text-emerald-400 font-bold"
                    : "bg-white/[0.02] border-white/[0.04] text-stone-300 hover:bg-white/[0.06] hover:border-white/[0.1]"
                }`}
              >
                <span className={`text-[11px] font-bold mt-0.5 ${isSelected ? 'text-stone-950' : ''}`}>{day.getDate()}</span>
                <div className="flex gap-1 items-center mb-1">
                  {meal && (
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? "bg-stone-900" : "bg-emerald-400 shadow-[0_0_8px_currentColor]"
                      }`}
                    />
                  )}
                  {hasLog && (
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? "bg-amber-600" : "bg-amber-400 shadow-[0_0_8px_currentColor]"
                      }`}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Daily Nutrition Summary */}
      <div className="bg-[#131A1F]/60 backdrop-blur-md border border-white/[0.06] rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-xs uppercase tracking-widest bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            <Activity className="w-4 h-4" />
            <span>
              {language === "es"
                ? "Nutrición registrada verificada"
                : language === "bg"
                ? "Проверени записани хранителни стойности"
                : "Verified logged nutrition"}
            </span>
          </div>
          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-widest bg-white/[0.04] px-3 py-1.5 rounded-lg border border-white/[0.08]">
            {selectedDate.toLocaleDateString(
              language === "es" ? "es-ES" : language === "bg" ? "bg-BG" : "en-US",
              { day: "numeric", month: "short" }
            )}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          {[
            {
              label: language === "es" ? "Cal" : "Cal",
              value: totalNutrition?.calories,
              unit: "kcal",
              color: "text-white",
            },
            {
              label: language === "es" ? "Prot" : "Prot",
              value: totalNutrition?.protein,
              unit: "g",
              color: "text-emerald-400",
            },
            {
              label: language === "es" ? "Carb" : "Carb",
              value: totalNutrition?.carbs,
              unit: "g",
              color: "text-amber-400",
            },
            {
              label: language === "es" ? "Grasa" : language === "bg" ? "Мазнини" : "Fat",
              value: totalNutrition?.fat,
              unit: "g",
              color: "text-stone-300",
            },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="bg-black/40 rounded-2xl p-3 text-center border border-white/[0.04] shadow-inner"
            >
              <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest block mb-1">
                {stat.label}
              </span>
              <span className={`text-sm font-extrabold font-['Outfit'] ${stat.color}`}>
                {typeof stat.value === "number"
                  ? `${Math.round(stat.value)} ${stat.unit}`
                  : "—"}
              </span>
            </div>
          ))}
        </div>

        <p className="text-[10px] leading-relaxed text-stone-500">
          {language === "es"
            ? "Estos valores son únicamente la suma de comidas registradas con nutrición verificada. BalkanBite todavía no calcula objetivos diarios personalizados."
            : language === "bg"
            ? "Тези стойности са само сборът от записаните хранения с проверени хранителни данни. BalkanBite все още не изчислява персонализирани дневни цели."
            : "These values are only the sum of logged meals with verified nutrition. BalkanBite does not calculate personalized daily targets yet."}
        </p>

        {dailyLogs.length > 0 && (
          <div className="space-y-2 mt-4 pt-4 border-t border-stone-800">
            {dailyLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between text-xs bg-stone-800/50 px-3 py-2 rounded-xl"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-3.5 bg-emerald-500 rounded-full" />
                  <span className="text-stone-200 font-medium">{log.manualName}</span>
                </div>
                <span className="text-stone-400 font-bold">
                  {verifiedMealCalories(log) !== null
                    ? `${verifiedMealCalories(log)} kcal`
                    : language === "es"
                    ? "Nutrición no verificada"
                    : language === "bg"
                    ? "Непроверено хранене"
                    : "Nutrition unverified"}
                </span>
              </div>
            ))}
          </div>
        )}

        {nutritionSummary.unverifiedLogCount > 0 && (
          <p className="text-[10px] text-amber-300/90 text-center">
            {language === "es"
              ? `${nutritionSummary.unverifiedLogCount} comida(s) quedan fuera de los totales porque su nutrición no está verificada.`
              : language === "bg"
              ? `${nutritionSummary.unverifiedLogCount} хранене(ия) не участват в общите стойности, защото хранителните данни не са проверени.`
              : `${nutritionSummary.unverifiedLogCount} meal(s) are excluded from totals because their nutrition is not verified.`}
          </p>
        )}

        {dailyLogs.length === 0 && (
          <p className="text-[11px] text-stone-400 italic text-center py-1">
            {language === "es"
              ? "Sin comidas registradas para este día"
              : language === "bg"
              ? "Няма записани хранения за този ден"
              : "No meals logged for this day yet"}
          </p>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              if (onNavigateToVoice) onNavigateToVoice();
            }}
            className="w-full bg-emerald-500 hover:bg-emerald-400 rounded-xl py-3 text-sm font-bold text-stone-950 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
          >
            <Target className="w-4 h-4" />
            <span>
              {language === "es"
                ? "REGISTRAR EN VOICECHEF"
                : language === "bg"
                ? "ЗАПИШИ В VOICECHEF"
                : "LOG WITH VOICECHEF"}
            </span>
          </button>
        </div>
      </div>

      {/* Selected Day Detail */}
      {selectedMeal ? (
        <div className="bg-[#131A1F]/60 backdrop-blur-md border border-white/[0.06] rounded-3xl p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 shadow-[0_8px_30px_rgba(0,0,0,0.4)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-xs uppercase tracking-widest bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              <Calendar className="w-4 h-4" />
              <span className="capitalize">
                {selectedDate.toLocaleDateString(
                  language === "es" ? "es-ES" : language === "bg" ? "bg-BG" : "en-US",
                  { weekday: "long", day: "numeric", month: "short" }
                )}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 relative z-10">
            {[
              { title: currentText.breakfast, recipe: selectedMeal.breakfast, icon: "🍳" },
              { title: currentText.lunch, recipe: selectedMeal.lunch, icon: "🥗" },
              { title: currentText.dinner, recipe: selectedMeal.dinner, icon: "🍲" },
            ].map((meal, idx) => (
              <div
                key={idx}
                className="bg-black/40 rounded-2xl p-4 border border-white/[0.04] flex items-center gap-4 shadow-inner hover:bg-white/[0.02] transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center text-2xl shrink-0 border border-white/[0.08]">
                  {meal.icon}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 block">
                      {meal.title}
                    </span>
                    {renderPantryBadge(meal.recipe)}
                  </div>
                  <p className="text-sm font-bold text-white truncate font-['Outfit'] tracking-wide">
                    {getRecipeTitle(meal.recipe)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-[#131A1F]/60 backdrop-blur-md border border-white/[0.04] rounded-3xl p-8 text-center space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-stone-900 to-stone-800 flex items-center justify-center text-stone-500 shadow-inner border border-stone-800/50">
            <Calendar className="w-7 h-7" />
          </div>
          <p className="text-sm text-stone-400 max-w-sm mx-auto leading-relaxed font-medium">
            {currentText.mealPlanEmptyState}
          </p>
        </div>
      )}

      {/* Weekly Menu List (Next 7 Days) */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest px-2">
          {language === "es"
            ? "Resumen Semanal"
            : language === "bg"
            ? "Предстоящо за седмицата"
            : "Weekly Overview"}
        </h3>
        <div className="space-y-3">
          {next7Days.map((day, idx) => (
            <div
              key={idx}
              className="bg-[#131A1F]/60 backdrop-blur-md border border-white/[0.06] hover:border-emerald-500/30 rounded-3xl p-4 flex flex-col gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.2)] transition-colors group"
            >
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                <span className="text-xs font-bold text-emerald-400 capitalize bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                  {new Date(day.date).toLocaleDateString(
                    language === "es" ? "es-ES" : language === "bg" ? "bg-BG" : "en-US",
                    { weekday: "short", day: "numeric", month: "short" }
                  )}
                </span>
                <span className="text-[11px] text-stone-500 font-bold bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.04]">
                  {day.breakfast ? getRecipeTitle(day.breakfast).slice(0, 18) + "..." : "..."}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="text-center bg-black/40 p-2.5 rounded-2xl border border-white/[0.04] shadow-inner group-hover:bg-white/[0.02] transition-colors flex flex-col justify-between min-h-[70px]">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[9px] text-stone-500 uppercase font-bold tracking-widest">
                      {language === "es" ? "DES" : language === "bg" ? "ЗАК" : "BRK"}
                    </span>
                    {day.breakfast && renderPantryBadge(day.breakfast)}
                  </div>
                  <span className="text-[11px] text-stone-300 truncate block font-bold">
                    {getRecipeTitle(day.breakfast)}
                  </span>
                </div>
                <div className="text-center bg-black/40 p-2.5 rounded-2xl border border-white/[0.04] shadow-inner group-hover:bg-white/[0.02] transition-colors flex flex-col justify-between min-h-[70px]">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[9px] text-stone-500 uppercase font-bold tracking-widest">
                      {language === "es" ? "ALM" : language === "bg" ? "ОБЯ" : "LUN"}
                    </span>
                    {day.lunch && renderPantryBadge(day.lunch)}
                  </div>
                  <span className="text-[11px] text-stone-300 truncate block font-bold">
                    {getRecipeTitle(day.lunch)}
                  </span>
                </div>
                <div className="text-center bg-black/40 p-2.5 rounded-2xl border border-white/[0.04] shadow-inner group-hover:bg-white/[0.02] transition-colors flex flex-col justify-between min-h-[70px]">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[9px] text-stone-500 uppercase font-bold tracking-widest">
                      {language === "es" ? "CEN" : language === "bg" ? "ВЕЧ" : "DIN"}
                    </span>
                    {day.dinner && renderPantryBadge(day.dinner)}
                  </div>
                  <span className="text-[11px] text-stone-300 truncate block font-bold">
                    {getRecipeTitle(day.dinner)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation Modal for Clearing Meal Plan */}
      <ConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => {
          if (onClearMealPlan) {
            onClearMealPlan();
          }
          setShowClearConfirm(false);
        }}
        title={currentText.mealPlanClearAll}
        description={currentText.mealPlanClearConfirm}
        confirmText={currentText.clear}
        cancelText={currentText.cancel}
        danger={true}
      />

      {/* Printable Fridge Magnet Menu Sheet Modal */}
      <PrintMenuModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        mealPlan={mealPlan}
        shoppingList={shoppingList}
        language={language}
        currency={currency}
        userName={userName}
      />
    </div>
  );
};
