import React, { useState, useMemo } from "react";
import {
  Layers,
  Calendar,
  ShoppingCart,
  ChefHat,
  Sparkles,
  Flame,
  Clock,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Mic,
  Plus,
  Utensils,
  Award,
} from "lucide-react";
import {
  PantryItem,
  Recipe,
  ShoppingItem,
  MealPlanDay,
  UserProfile,
  Language,
  Currency,
} from "../types";
import { t } from "../utils/translations";
import { TabType } from "./BottomNav";
import { getRecipeImageUrl } from "../utils/recipeImages";
import { calculateRecipePantryScore } from "../utils/menuAutoPlanner";
import { findPlannedMealForDate } from "../utils/mealPlanLookup";
import type { ProgressionActivitySummaryV1 } from "../utils/progressionLedger";
import type { RecipeCookOutcome } from "../utils/recipeCookFeedback";
import { getRecipeCookFeedback } from "../utils/recipeCookFeedback";

interface HomeViewProps {
  pantry: PantryItem[];
  recipes: Recipe[];
  shoppingList: ShoppingItem[];
  mealPlan: MealPlanDay[];
  profile: UserProfile;
  progressionSummary?: ProgressionActivitySummaryV1;
  onNavigateToTab: (tab: TabType) => void;
  onOpenChefIa: () => void;
  onCookRecipe: (recipe: Recipe) => RecipeCookOutcome;
  onOpenShoppingAdvisor?: () => void;
  language: Language;
  currency: Currency;
  theme?: "dark" | "light";
}

export const HomeView: React.FC<HomeViewProps> = ({
  pantry,
  recipes,
  shoppingList,
  mealPlan,
  profile,
  progressionSummary,
  onNavigateToTab,
  onOpenChefIa,
  onCookRecipe,
  onOpenShoppingAdvisor,
  language,
  currency,
  theme = "dark",
}) => {
  const currentText = t[language];
  const isDark = theme === "dark";
  const [cookFeedback, setCookFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // Time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return currentText.homeGreetingMorning || "Buenos días";
    if (hour < 20) return currentText.homeGreetingAfternoon || "Buenas tardes";
    return currentText.homeGreetingEvening || "Buenas noches";
  }, [currentText]);

  const userName = profile.name?.trim() || (language === "es" ? "Chef" : "Chef");

  // Expiring soon items count (expiry <= 3 days)
  const expiringItems = useMemo(
    () => pantry.filter((item) => item.expiryDaysLeft !== undefined && item.expiryDaysLeft <= 3),
    [pantry]
  );

  // Pending shopping count
  const pendingShoppingItems = useMemo(
    () => shoppingList.filter((item) => !item.checked),
    [shoppingList]
  );

  // Today's meal plan
  const todayIsoDate = useMemo(() => new Date().toISOString().split("T")[0], []);
  const todayPlan = useMemo(() => {
    const matched = findPlannedMealForDate(mealPlan, todayIsoDate);
    if (matched) return matched;
    // Fallback: day of week index or first day if available
    const dayOfWeek = (new Date().getDay() + 6) % 7; // Monday = 0
    return mealPlan[dayOfWeek] || mealPlan[0] || null;
  }, [mealPlan, todayIsoDate]);

  // Top 3 recipes with highest pantry score
  const topRecipes = useMemo(() => {
    if (!recipes || recipes.length === 0) return [];
    return [...recipes]
      .map((r) => {
        const score = calculateRecipePantryScore(r, pantry);
        return { recipe: r, ...score };
      })
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 3);
  }, [recipes, pantry]);

  const getRecipeTitle = (r: Recipe) => {
    if (language === "es" && r.title.es) return r.title.es;
    if (language === "bg" && r.title.bg) return r.title.bg;
    return r.title.en;
  };

  const handleCook = (r: Recipe) => {
    const outcome = onCookRecipe(r);
    setCookFeedback(
      getRecipeCookFeedback(outcome, language, currentText.recipeCookSuccess)
    );
    setTimeout(() => {
      setCookFeedback(null);
    }, 4000);
  };

  return (
    <div className="space-y-5 pb-24 max-w-5xl mx-auto">
      {/* Toast cook feedback */}
      {cookFeedback && (
        <div
          role="status"
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs sm:text-sm font-bold animate-bounce transition-all ${
            cookFeedback.kind === "success"
              ? "bg-emerald-600 text-white border border-emerald-400"
              : "bg-amber-600 text-white border border-amber-400"
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{cookFeedback.text}</span>
        </div>
      )}

      {/* Hero Welcome Banner */}
      <div
        className={`relative overflow-hidden rounded-2xl sm:rounded-3xl p-5 sm:p-7 border transition-all ${
          isDark
            ? "bg-gradient-to-br from-[#121b22] via-[#0f171d] to-[#0c1216] border-white/[0.08] shadow-lg"
            : "bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border-emerald-100 shadow-sm"
        }`}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 sm:space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>BalkanBite Smart Home</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight">
              {greeting}, <span className="text-emerald-500">{userName}</span> 👋
            </h2>
            <p className={`text-xs sm:text-sm max-w-xl ${isDark ? "text-stone-400" : "text-slate-600"}`}>
              {currentText.homeSubtitle ||
                (language === "es"
                  ? "Gestiona tus ingredientes, planifica tus menús y aprovecha cada comida."
                  : language === "bg"
                  ? "Управлявайте продуктите си, планирайте менюто и спестявайте с лекота."
                  : "Track your pantry ingredients, plan balanced meals, and save with ease.")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0 shrink-0">
            <button
              id="home-open-chef-btn"
              type="button"
              onClick={onOpenChefIa}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold text-stone-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-md hover:shadow-lg transition-all cursor-pointer group"
            >
              <Mic className="w-4 h-4 text-stone-950 group-hover:scale-110 transition-transform" />
              <span>{currentText.homeAskChefBtn || "Hablar con Chef IA"}</span>
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Pantry Card */}
        <div
          onClick={() => onNavigateToTab("pantry")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer group hover:scale-[1.01] ${
            isDark
              ? "bg-[#131A1F] border-white/[0.08] hover:border-emerald-500/40 hover:bg-[#172127]"
              : "bg-white border-stone-200/90 shadow-xs hover:border-emerald-400 hover:shadow-md"
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              {currentText.homeGoToPantry || "Ver"} <ArrowRight className="w-3 h-3" />
            </span>
          </div>
          <div className="text-2xl font-extrabold tracking-tight mb-0.5">{pantry.length}</div>
          <div className={`text-xs font-semibold ${isDark ? "text-stone-400" : "text-slate-600"}`}>
            {currentText.homeQuickPantry || "Despensa activa"}
          </div>

          {expiringItems.length > 0 ? (
            <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>
                {expiringItems.length} {currentText.homeExpiringSoon || "caducan pronto"}
              </span>
            </div>
          ) : (
            <div className="mt-3 text-[11px] font-medium text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>{language === "es" ? "Todo al día" : "All fresh"}</span>
            </div>
          )}
        </div>

        {/* Meal Plan Card */}
        <div
          onClick={() => onNavigateToTab("mealPlan")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer group hover:scale-[1.01] ${
            isDark
              ? "bg-[#131A1F] border-white/[0.08] hover:border-emerald-500/40 hover:bg-[#172127]"
              : "bg-white border-stone-200/90 shadow-xs hover:border-emerald-400 hover:shadow-md"
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-teal-500/10 text-teal-500 group-hover:scale-110 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-teal-500 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              {currentText.homeGoToMealPlan || "Menú"} <ArrowRight className="w-3 h-3" />
            </span>
          </div>
          <div className="text-2xl font-extrabold tracking-tight mb-0.5">
            {todayPlan?.lunch || todayPlan?.dinner ? "2+" : todayPlan?.breakfast ? "1" : "0"}
          </div>
          <div className={`text-xs font-semibold ${isDark ? "text-stone-400" : "text-slate-600"}`}>
            {currentText.homeTodayMeals || "Comidas de hoy"}
          </div>
          <div className="mt-3 truncate text-[11px] font-medium text-stone-400">
            {todayPlan?.lunch
              ? getRecipeTitle(todayPlan.lunch)
              : todayPlan?.dinner
              ? getRecipeTitle(todayPlan.dinner)
              : currentText.homeNoMealsPlanned || (language === "es" ? "Sin planificar" : "Not planned")}
          </div>
        </div>

        {/* Shopping Card */}
        <div
          onClick={() => onNavigateToTab("shopping")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer group hover:scale-[1.01] ${
            isDark
              ? "bg-[#131A1F] border-white/[0.08] hover:border-emerald-500/40 hover:bg-[#172127]"
              : "bg-white border-stone-200/90 shadow-xs hover:border-emerald-400 hover:shadow-md"
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-500 group-hover:scale-110 transition-transform">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-amber-500 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              {currentText.homeGoToShopping || "Lista"} <ArrowRight className="w-3 h-3" />
            </span>
          </div>
          <div className="text-2xl font-extrabold tracking-tight mb-0.5">
            {pendingShoppingItems.length}
          </div>
          <div className={`text-xs font-semibold ${isDark ? "text-stone-400" : "text-slate-600"}`}>
            {currentText.homeShoppingList || "Lista de la compra"}
          </div>
          <div className="mt-3 text-[11px] font-medium text-stone-400">
            {pendingShoppingItems.length === 0
              ? currentText.homeAllBought || (language === "es" ? "Todo comprado" : "All bought")
              : `${pendingShoppingItems.length} ${currentText.homePendingItems || "pendientes"}`}
          </div>
        </div>

        {/* Progression Card */}
        <div
          onClick={() => onNavigateToTab("recipes")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer group hover:scale-[1.01] ${
            isDark
              ? "bg-[#131A1F] border-white/[0.08] hover:border-emerald-500/40 hover:bg-[#172127]"
              : "bg-white border-stone-200/90 shadow-xs hover:border-emerald-400 hover:shadow-md"
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-500/10 text-rose-500 group-hover:scale-110 transition-transform">
              <Award className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-rose-500 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              {currentText.homeGoToRecipes || "Recetas"} <ArrowRight className="w-3 h-3" />
            </span>
          </div>
          <div className="text-2xl font-extrabold tracking-tight mb-0.5">
            {progressionSummary?.successfulCookEvents || 0}
          </div>
          <div className={`text-xs font-semibold ${isDark ? "text-stone-400" : "text-slate-600"}`}>
            {currentText.homeCookedMeals || "Platos cocinados"}
          </div>
          <div className="mt-3 text-[11px] font-medium text-stone-400">
            {recipes.length} {language === "es" ? "en tu recetario" : "in catalog"}
          </div>
        </div>
      </div>

      {/* Recommended Recipes Section: "¿Qué cocino hoy?" */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-emerald-500" />
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              {currentText.homeWhatToCook || "¿Qué cocino hoy con mi despensa?"}
            </h3>
          </div>
          <button
            id="home-view-all-recipes-btn"
            type="button"
            onClick={() => onNavigateToTab("recipes")}
            className="text-xs font-bold text-emerald-500 hover:text-emerald-400 flex items-center gap-1 cursor-pointer"
          >
            <span>{language === "es" ? "Ver todas" : language === "bg" ? "Виж всички" : "View all"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {topRecipes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            {topRecipes.map(({ recipe, matchPercentage }) => {
              const imageUrl = getRecipeImageUrl(recipe);
              const isFullMatch = matchPercentage === 100;

              return (
                <div
                  key={recipe.id}
                  className={`rounded-2xl border overflow-hidden flex flex-col transition-all group hover:scale-[1.01] ${
                    isDark
                      ? "bg-[#131A1F] border-white/[0.08] hover:border-emerald-500/40"
                      : "bg-white border-stone-200/90 shadow-xs hover:border-emerald-300 hover:shadow-md"
                  }`}
                >
                  <div className="relative h-36 w-full overflow-hidden bg-stone-900">
                    <img
                      src={imageUrl}
                      alt={getRecipeTitle(recipe)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Match percentage badge */}
                    <div className="absolute top-2.5 right-2.5">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full border shadow-xs ${
                          isFullMatch
                            ? "bg-emerald-500 text-stone-950 border-emerald-400"
                            : matchPercentage >= 50
                            ? "bg-amber-500 text-stone-950 border-amber-400"
                            : "bg-stone-800 text-stone-300 border-white/[0.1]"
                        }`}
                      >
                        {matchPercentage}% {currentText.homeMatch || "disponible"}
                      </span>
                    </div>

                    <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-bold text-white">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {recipe.prepTimeMin + recipe.cookTimeMin} min
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" /> {recipe.caloriesKcal} kcal
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 flex flex-col flex-1 justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-sm tracking-tight line-clamp-1 group-hover:text-emerald-400 transition-colors">
                        {getRecipeTitle(recipe)}
                      </h4>
                      <p className={`text-[11px] mt-1 line-clamp-2 ${isDark ? "text-stone-400" : "text-slate-600"}`}>
                        {language === "es" && recipe.description.es
                          ? recipe.description.es
                          : recipe.description.en}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-white/[0.04]">
                      <button
                        id={`home-cook-btn-${recipe.id}`}
                        type="button"
                        onClick={() => handleCook(recipe)}
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-stone-950 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Utensils className="w-3.5 h-3.5" />
                        <span>{currentText.homeCookNow || "Cocinar"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className={`p-6 rounded-2xl border text-center ${
              isDark ? "bg-[#131A1F] border-white/[0.08]" : "bg-white border-stone-200/90 shadow-xs"
            }`}
          >
            <p className={`text-xs ${isDark ? "text-stone-400" : "text-slate-600"}`}>
              {language === "es"
                ? "Añade ingredientes a tu despensa para descubrir recetas personalizadas."
                : "Add pantry items to discover tailored recipe suggestions."}
            </p>
            <button
              id="home-empty-pantry-btn"
              type="button"
              onClick={() => onNavigateToTab("pantry")}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{language === "es" ? "Añadir a Despensa" : "Add to Pantry"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Quick Access Shortcuts Bar */}
      <div
        className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all ${
          isDark ? "bg-[#131A1F] border-white/[0.08]" : "bg-white border-stone-200/90 shadow-xs"
        }`}
      >
        <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wider mb-3 text-stone-400">
          {currentText.homeQuickActions || "Accesos Rápidos"}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            id="home-shortcut-pantry"
            type="button"
            onClick={() => onNavigateToTab("pantry")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
              isDark
                ? "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-emerald-500/30"
                : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-emerald-300"
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold">{currentText.navPantry}</span>
            <span className={`text-[10px] ${isDark ? "text-stone-400" : "text-slate-500"}`}>
              {pantry.length} {currentText.homeItemsInPantry || "en despensa"}
            </span>
          </button>

          <button
            id="home-shortcut-mealplan"
            type="button"
            onClick={() => onNavigateToTab("mealPlan")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
              isDark
                ? "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-teal-500/30"
                : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-teal-300"
            }`}
          >
            <Calendar className="w-4 h-4 text-teal-500" />
            <span className="text-xs font-bold">{currentText.navMealPlan}</span>
            <span className={`text-[10px] ${isDark ? "text-stone-400" : "text-slate-500"}`}>
              {mealPlan.length} {language === "es" ? "días planificados" : "planned days"}
            </span>
          </button>

          <button
            id="home-shortcut-shopping"
            type="button"
            onClick={() => onNavigateToTab("shopping")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
              isDark
                ? "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-amber-500/30"
                : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-amber-300"
            }`}
          >
            <ShoppingCart className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold">{currentText.navShopping}</span>
            <span className={`text-[10px] ${isDark ? "text-stone-400" : "text-slate-500"}`}>
              {pendingShoppingItems.length} {currentText.homePendingItems || "pendientes"}
            </span>
          </button>

          <button
            id="home-shortcut-recipes"
            type="button"
            onClick={() => onNavigateToTab("recipes")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
              isDark
                ? "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-rose-500/30"
                : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-rose-300"
            }`}
          >
            <ChefHat className="w-4 h-4 text-rose-500" />
            <span className="text-xs font-bold">{currentText.navRecipes}</span>
            <span className={`text-[10px] ${isDark ? "text-stone-400" : "text-slate-500"}`}>
              {recipes.length} {language === "es" ? "recetas listas" : "ready recipes"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
