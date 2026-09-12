import React, { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock, Activity, Target, Trash2, CheckCircle2, Sparkles, Printer, Globe } from "lucide-react";
import { Recipe, MealPlanDay, Language, MealLog, ShoppingItem, Currency } from "../types";
import { t } from "../utils/translations";
import { ConfirmModal } from "./ConfirmModal";
import { PrintMenuModal } from "./PrintMenuModal";
import { useGoogleCalendarSync } from "../hooks/useGoogleCalendarSync";

interface MealPlanViewProps {
  mealPlan: MealPlanDay[];
  mealLogs: MealLog[];
  recipes: Recipe[];
  language: Language;
  currency?: Currency;
  shoppingList?: ShoppingItem[];
  userName?: string;
  onClearMealPlan?: () => void;
  onNavigateToVoice?: () => void;
  isPro?: boolean;
  onOpenProModal?: () => void;
  onGenerateAiWeekPlan?: () => void;
  isGeneratingPlan?: boolean;
}

export const MealPlanView: React.FC<MealPlanViewProps> = ({
  mealPlan,
  mealLogs,
  recipes,
  language,
  currency = "EUR",
  shoppingList = [],
  userName,
  onClearMealPlan,
  onNavigateToVoice,
  isPro = false,
  onOpenProModal,
  onGenerateAiWeekPlan,
  isGeneratingPlan = false,
}) => {
  const currentText = t[language];
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [logTipVisible, setLogTipVisible] = useState(false);
  const { sync: syncToCalendar, isSyncing: isCalendarSyncing } = useGoogleCalendarSync();

  const selectedDateStr = selectedDate.toISOString().split("T")[0];
  const dailyLogs = mealLogs.filter((log) => log.date === selectedDateStr);

  const totalNutrition = dailyLogs.reduce(
    (acc, curr) => ({
      calories: acc.calories + curr.calories,
      protein: acc.protein + curr.proteinG,
      carbs: acc.carbs + curr.carbsG,
      fat: acc.fat + curr.fatG,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

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

  const getMealForDay = (date: Date): MealPlanDay | null => {
    const dateStr = date.toISOString().split("T")[0];
    const fixedPlan = mealPlan.find((d) => d.date === dateStr);
    if (fixedPlan) return fixedPlan;

    if (!recipes || recipes.length === 0) {
      return null;
    }

    // Generative fallback: Use date as seed for variety
    const seed = date.getDate() + date.getMonth() * 31;
    const breakfast = recipes[seed % recipes.length];
    const lunch = recipes[(seed + 1) % recipes.length];
    const dinner = recipes[(seed + 2) % recipes.length];

    return {
      date: dateStr,
      breakfast,
      lunch,
      dinner,
    };
  };

  const selectedMeal = getMealForDay(selectedDate);

  // Generate Next 7 days list
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return getMealForDay(d);
  }).filter((d): d is MealPlanDay => d !== null);

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

  return (
    <div id="meal-plan-view" className="space-y-4 pb-20">
      {/* AI Meal Plan PRO Feature Banner */}
      <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-r from-emerald-950/70 via-stone-900 to-amber-950/60 border border-emerald-500/40 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1 max-w-lg">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Sparkles className="w-3 h-3 text-amber-400" />
                {currentText.mealPlanProBadge || "PRO"}
              </span>
              <h3 className="text-sm sm:text-base font-bold text-white font-['Outfit']">
                {currentText.mealPlanAutoGeneratePro || "Auto-Generar Menú Semanal con IA"}
              </h3>
            </div>
            <p className="text-xs text-stone-300/90 leading-relaxed">
              {currentText.mealPlanAutoGenerateDesc || "La IA analiza tu despensa y tus objetivos para planificar 7 días equilibrados y recortar tu gasto de súper."}
            </p>
          </div>

          <button
            id="btn-auto-plan-week"
            type="button"
            onClick={() => {
              if (!isPro) {
                onOpenProModal?.();
              } else {
                onGenerateAiWeekPlan?.();
              }
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>
              {isPro
                ? (isGeneratingPlan ? (currentText.generatingWeekPlan || "Diseñando...") : (language === "es" ? "Planificar con IA" : "Generate with AI"))
                : (currentText.tryProFree || "Probar 7 Días Gratis")}
            </span>
          </button>
        </div>
      </div>

      {/* Calendar Header */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 border border-stone-700/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white font-['Outfit']">
              {currentText.mealPlanTitle}
            </h2>
          </div>
          <p className="text-xs text-stone-400 mt-0.5 uppercase tracking-widest font-semibold capitalize">
            {monthLabel}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => syncToCalendar(next7Days, language)}
            disabled={isCalendarSyncing}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-stone-900 border border-stone-750 text-stone-300 hover:text-blue-400 hover:border-blue-500/50 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
            title="Sincronizar con Google Calendar"
          >
            <Globe className={`w-4 h-4 text-blue-400 ${isCalendarSyncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">
              {isCalendarSyncing ? "Sincronizando..." : "Google Calendar"}
            </span>
          </button>

          <button
            id="btn-print-fridge-sheet"
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-stone-900 border border-stone-750 text-stone-300 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
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
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-stone-900 border border-stone-700/70 text-stone-400 hover:text-rose-400 hover:border-rose-900 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title={currentText.mealPlanClearAll || (language === "es" ? "Vaciar Menú" : "Clear Meal Plan")}
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">
                {currentText.mealPlanClearAll || (language === "es" ? "Vaciar Menú" : "Clear Meal Plan")}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Monthly Grid */}
      <div className="bg-stone-850/80 border border-stone-750 rounded-2xl p-3 shadow-inner">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-stone-400 mb-2 font-bold uppercase">
          {dayHeaders.map((d, i) => (
            <div key={`${d}-${i}`} className="py-0.5">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {calendarDays.map((day, idx) => {
            if (!day) return <div key={idx} className="h-11" />;
            const isToday = day.toDateString() === new Date().toDateString();
            const isSelected = day.toDateString() === selectedDate.toDateString();
            const meal = getMealForDay(day);
            const hasLog = mealLogs.some((l) => l.date === day.toISOString().split("T")[0]);

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedDate(day)}
                className={`rounded-xl p-1 h-12 border transition-all flex flex-col items-center justify-between cursor-pointer ${
                  isSelected
                    ? "bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-950/50 scale-[1.03]"
                    : isToday
                    ? "bg-stone-800 border-emerald-500/80 text-emerald-400 font-bold"
                    : "bg-stone-900/90 border-stone-800 text-stone-300 hover:border-stone-700"
                }`}
              >
                <span className="text-[11px] font-bold">{day.getDate()}</span>
                <div className="flex gap-0.5 items-center">
                  {meal && (
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? "bg-white" : "bg-emerald-400"
                      }`}
                    />
                  )}
                  {hasLog && (
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? "bg-amber-300" : "bg-amber-400"
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
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <Activity className="w-4 h-4" />
            <span>
              {language === "es"
                ? "Estado Nutricional Diario"
                : language === "bg"
                ? "Дневен Нутри статус"
                : "Daily Nutrition Status"}
            </span>
          </div>
          <span className="text-[11px] font-bold text-stone-400">
            {selectedDate.toLocaleDateString(
              language === "es" ? "es-ES" : language === "bg" ? "bg-BG" : "en-US",
              { day: "numeric", month: "short" }
            )}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            {
              label: language === "es" ? "Cal" : "Cal",
              value: totalNutrition.calories,
              target: 2000,
              unit: "kcal",
              color: "text-white",
            },
            {
              label: language === "es" ? "Prot" : "Prot",
              value: totalNutrition.protein,
              target: 120,
              unit: "g",
              color: "text-emerald-400",
            },
            {
              label: language === "es" ? "Carb" : "Carb",
              value: totalNutrition.carbs,
              target: 250,
              unit: "g",
              color: "text-blue-400",
            },
            {
              label: language === "es" ? "Grasa" : "Fat",
              value: totalNutrition.fat,
              target: 60,
              unit: "g",
              color: "text-amber-400",
            },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="bg-stone-800/90 rounded-xl p-2.5 text-center border border-stone-700/60"
            >
              <span className="text-[9px] font-bold text-stone-400 uppercase block mb-1">
                {stat.label}
              </span>
              <span className={`text-sm font-bold ${stat.color}`}>
                {Math.round(stat.value)}
              </span>
              <div className="w-full bg-stone-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all rounded-full"
                  style={{
                    width: `${Math.min(100, (stat.value / stat.target) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

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
                <span className="text-stone-400 font-bold">{log.calories} kcal</span>
              </div>
            ))}
          </div>
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

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setLogTipVisible((prev) => !prev)}
            className="w-full bg-stone-800 hover:bg-stone-750 border border-stone-700/80 rounded-xl py-2.5 text-xs font-bold text-stone-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <Target className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {language === "es"
                ? "REGISTRAR EN VOICECHEF"
                : language === "bg"
                ? "ЗАПИШИ В VOICECHEF"
                : "LOG WITH VOICECHEF"}
            </span>
          </button>

          {logTipVisible && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-200 flex items-start gap-2 animate-in fade-in">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {language === "es"
                  ? 'Abre la pestaña VoiceChef y di o escribe lo que has comido (ejemplo: "Registra almuerzo: ensalada y pollo asado"). ¡La IA calculará automáticamente las calorías y macros!'
                  : language === "bg"
                  ? 'Отворете VoiceChef и кажете какво сте яли (например "Запиши обяд: салата и печено пиле"). AI автоматично ще изчисли калориите!'
                  : 'Open VoiceChef tab and speak or type what you ate (e.g. "Log lunch: grilled chicken with salad"). AI will calculate calories automatically!'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Selected Day Detail */}
      {selectedMeal ? (
        <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <Calendar className="w-4 h-4" />
              <span className="capitalize">
                {selectedDate.toLocaleDateString(
                  language === "es" ? "es-ES" : language === "bg" ? "bg-BG" : "en-US",
                  { weekday: "long", day: "numeric", month: "short" }
                )}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {[
              { title: currentText.breakfast, recipe: selectedMeal.breakfast, icon: "🍳" },
              { title: currentText.lunch, recipe: selectedMeal.lunch, icon: "🥗" },
              { title: currentText.dinner, recipe: selectedMeal.dinner, icon: "🍲" },
            ].map((meal, idx) => (
              <div
                key={idx}
                className="bg-stone-900/85 rounded-xl p-3 border border-stone-800 flex items-center gap-3 shadow-sm"
              >
                <div className="w-10 h-10 rounded-lg bg-stone-800 flex items-center justify-center text-xl shrink-0">
                  {meal.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase text-stone-400 block">
                    {meal.title}
                  </span>
                  <p className="text-sm font-semibold text-white truncate">
                    {getRecipeTitle(meal.recipe)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-stone-800/60 border border-stone-700/60 rounded-2xl p-6 text-center space-y-2">
          <Calendar className="w-8 h-8 text-stone-500 mx-auto" />
          <p className="text-xs text-stone-300 max-w-sm mx-auto leading-relaxed">
            {currentText.mealPlanEmptyState}
          </p>
        </div>
      )}

      {/* Weekly Menu List (Next 7 Days) */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">
          {language === "es"
            ? "Resumen Semanal"
            : language === "bg"
            ? "Предстоящо за седмицата"
            : "Weekly Overview"}
        </h3>
        <div className="space-y-2.5">
          {next7Days.map((day, idx) => (
            <div
              key={idx}
              className="bg-stone-900 border border-stone-800 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                <span className="text-[11px] font-bold text-emerald-400 capitalize">
                  {new Date(day.date).toLocaleDateString(
                    language === "es" ? "es-ES" : language === "bg" ? "bg-BG" : "en-US",
                    { weekday: "short", day: "numeric", month: "short" }
                  )}
                </span>
                <span className="text-[10px] text-stone-400 font-medium">
                  {day.breakfast ? getRecipeTitle(day.breakfast).slice(0, 18) + "..." : "..."}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center bg-stone-850/60 p-1.5 rounded-lg border border-stone-800/60">
                  <span className="text-[9px] text-stone-500 block uppercase font-bold">
                    {language === "es" ? "DES" : "B"}
                  </span>
                  <span className="text-[10px] text-stone-200 truncate block font-medium">
                    {getRecipeTitle(day.breakfast)}
                  </span>
                </div>
                <div className="text-center bg-stone-850/60 p-1.5 rounded-lg border border-stone-800/60">
                  <span className="text-[9px] text-stone-500 block uppercase font-bold">
                    {language === "es" ? "ALM" : "L"}
                  </span>
                  <span className="text-[10px] text-stone-200 truncate block font-medium">
                    {getRecipeTitle(day.lunch)}
                  </span>
                </div>
                <div className="text-center bg-stone-850/60 p-1.5 rounded-lg border border-stone-800/60">
                  <span className="text-[9px] text-stone-500 block uppercase font-bold">
                    {language === "es" ? "CEN" : "D"}
                  </span>
                  <span className="text-[10px] text-stone-200 truncate block font-medium">
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
        title={currentText.mealPlanClearAll || (language === "es" ? "Vaciar Menú Semanal" : "Clear Meal Plan")}
        description={currentText.mealPlanClearConfirm || (language === "es" ? "¿Estás seguro de que deseas vaciar el menú semanal y el registro?" : "Are you sure you want to clear your meal plan and logs?")}
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
