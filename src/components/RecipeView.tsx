import React, { useState } from "react";
import {
  Sparkles,
  Clock,
  Flame,
  CheckCircle2,
  ShoppingCart,
  ChefHat,
  HeartPulse,
  TrendingDown,
  ArrowRight,
  RefreshCw,
  Info,
  X,
  Trash2,
  BookOpen,
} from "lucide-react";
import { Recipe, PantryItem, Language, Currency } from "../types";
import { t } from "../utils/translations";
import { getRecipeImageUrl } from "../utils/recipeImages";
import { ConfirmModal } from "./ConfirmModal";

interface RecipeViewProps {
  recipes: Recipe[];
  pantry: PantryItem[];
  onCookRecipe: (recipe: Recipe) => void;
  onAddMissingToShopping: (recipe: Recipe) => void;
  onGenerateAiRecipes: () => Promise<void>;
  onClearRecipes?: () => void;
  onLoadSampleRecipes?: () => void;
  isLoadingAi: boolean;
  language: Language;
  currency: Currency;
}

export const RecipeView: React.FC<RecipeViewProps> = ({
  recipes,
  pantry,
  onCookRecipe,
  onAddMissingToShopping,
  onGenerateAiRecipes,
  onClearRecipes,
  onLoadSampleRecipes,
  isLoadingAi,
  language,
  currency,
}) => {
  const currentText = t[language];
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [cookedSuccessMessage, setCookedSuccessMessage] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  const filters = [
    { id: "all", label: language === "es" ? "Todos" : language === "bg" ? "Всички" : "All" },
    { id: "fast", label: "⚡ <20m" },
    { id: "cheap", label: currency === "EUR" ? "💰 <3€" : "💰 <$3" },
    { id: "protein", label: language === "es" ? "💪 Proteína" : language === "bg" ? "💪 Протеин" : "💪 Protein" },
  ];

  const filteredRecipes = recipes.filter((r) => {
    if (activeFilter === "fast") return r.prepTimeMin + r.cookTimeMin <= 20;
    if (activeFilter === "cheap") return r.costPerServingEUR <= 3.0;
    if (activeFilter === "protein") return r.proteinG >= 18;
    return true;
  });

  const getRecipeTitle = (recipe: Recipe) => {
    if (language === "es" && recipe.title.es) return recipe.title.es;
    if (language === "bg" && recipe.title.bg) return recipe.title.bg;
    return recipe.title.en;
  };

  const getRecipeDesc = (recipe: Recipe) => {
    if (language === "es" && recipe.description.es) return recipe.description.es;
    if (language === "bg" && recipe.description.bg) return recipe.description.bg;
    return recipe.description.en;
  };

  const getRecipeInstructions = (recipe: Recipe) => {
    if (language === "es" && recipe.instructions?.es && recipe.instructions.es.length > 0) {
      return recipe.instructions.es;
    }
    if (language === "bg" && recipe.instructions?.bg && recipe.instructions.bg.length > 0) {
      return recipe.instructions.bg;
    }
    return recipe.instructions.en;
  };

  const getRecipeNutrition = (recipe: Recipe) => {
    if (language === "es" && recipe.nutritionHighlights?.es) return recipe.nutritionHighlights.es;
    if (language === "bg" && recipe.nutritionHighlights?.bg) return recipe.nutritionHighlights.bg;
    return recipe.nutritionHighlights?.en;
  };

  const handleCook = (recipe: Recipe) => {
    onCookRecipe(recipe);
    setCookedSuccessMessage(currentText.recipeCookSuccess);
    setTimeout(() => {
      setCookedSuccessMessage(null);
    }, 4000);
  };

  return (
    <div id="recipes-view" className="space-y-4 pb-36 sm:pb-32">
      {/* Compact & High-Impact AI Recipe Header */}
      <div className="bg-[#131A1F]/90 backdrop-blur-md border border-amber-500/20 rounded-2xl p-3.5 sm:p-4.5 shadow-[0_8px_25px_rgba(245,158,11,0.06)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-extrabold text-white font-['Outfit'] tracking-tight flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                {currentText.recipesTitle}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.04] text-stone-300 border border-white/[0.08] whitespace-nowrap">
                {pantry.length} {language === "es" ? "en despensa" : currentText.recipePantryStock}
              </span>
            </div>
            <p className="text-xs text-stone-400 font-medium line-clamp-1 sm:line-clamp-none">
              {currentText.recipesSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="generate-ai-recipes-btn"
              disabled={isLoadingAi}
              onClick={onGenerateAiRecipes}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] disabled:opacity-50 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAi ? "animate-spin" : ""}`} />
              <span>
                {isLoadingAi ? currentText.aiThinking : currentText.generateAiRecipes}
              </span>
            </button>

            {recipes.length > 0 && onClearRecipes && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all cursor-pointer shrink-0"
                title={currentText.recipesClearAll}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {recipes.length === 0 && onLoadSampleRecipes && (
              <button
                type="button"
                onClick={onLoadSampleRecipes}
                className="px-3 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-stone-200 text-xs font-bold flex items-center gap-1.5 border border-white/[0.08] cursor-pointer transition-all shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>{language === "es" ? "Ejemplo" : language === "bg" ? "Пример" : "Sample"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {cookedSuccessMessage && (
        <div className="p-3 bg-emerald-900/60 border border-emerald-500/50 rounded-xl text-xs text-emerald-200 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{cookedSuccessMessage}</span>
        </div>
      )}

      {/* Filter Chips - Fixed 4-column Compact Grid (No Scrolling) */}
      <div className="grid grid-cols-4 gap-1.5 w-full">
        {filters.map((f) => (
          <button
            key={f.id}
            id={`recipe-filter-${f.id}`}
            onClick={() => setActiveFilter(f.id)}
            className={`text-[11px] sm:text-xs py-1.5 px-1 rounded-xl font-bold transition-all duration-200 cursor-pointer text-center flex items-center justify-center truncate ${
              activeFilter === f.id
                ? "bg-white text-stone-950 shadow-[0_0_12px_rgba(255,255,255,0.2)]"
                : "bg-white/[0.04] text-stone-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]"
            }`}
          >
            <span className="truncate">{f.label}</span>
          </button>
        ))}
      </div>

      {/* Recipe Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRecipes.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3 bg-[#131A1F]/60 backdrop-blur-md border border-white/[0.04] rounded-3xl p-10 text-center space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-stone-900 to-stone-800 flex items-center justify-center text-stone-500 shadow-inner border border-stone-800/50">
              <ChefHat className="w-7 h-7 text-emerald-500/50" />
            </div>
            <p className="text-sm text-stone-400 max-w-sm mx-auto leading-relaxed font-medium">
              {currentText.recipesEmptyState}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={isLoadingAi}
                onClick={onGenerateAiRecipes}
                className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-bold inline-flex items-center gap-2.5 transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingAi ? "animate-spin" : ""}`} />
                <span>{isLoadingAi ? currentText.aiThinking : currentText.generateAiRecipes}</span>
              </button>
              {onLoadSampleRecipes && (
                <button
                  type="button"
                  onClick={onLoadSampleRecipes}
                  className="px-5 py-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-stone-200 border border-white/[0.08] text-sm font-bold inline-flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <span>{language === "es" ? "Cargar Ejemplo" : language === "bg" ? "Пример" : "Load Sample"}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {filteredRecipes.map((recipe) => {
          const title = getRecipeTitle(recipe);
          const desc = getRecipeDesc(recipe);

          const inPantryCount = recipe.ingredients.filter((i) => i.inPantry).length;
          const totalIngCount = recipe.ingredients.length;
          const hasMissing = inPantryCount < totalIngCount;

          const totalMinutes = recipe.prepTimeMin + recipe.cookTimeMin;

          const imgUrl = getRecipeImageUrl(recipe);

          return (
            <div
              key={recipe.id}
              id={`recipe-card-${recipe.id}`}
              className="bg-[#131A1F]/60 backdrop-blur-md border border-white/[0.06] hover:border-emerald-500/40 rounded-3xl p-4.5 space-y-4 transition-all duration-300 shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.08)] hover:-translate-y-1 overflow-hidden group"
            >
              <div className="relative -mx-4.5 -mt-4.5 mb-4 h-48 overflow-hidden bg-stone-900 rounded-t-3xl border-b border-white/[0.04]">
                <img 
                  src={imgUrl} 
                  alt={title}
                  className="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#131A1F] via-[#131A1F]/30 to-transparent" />
                <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-bold text-white border border-white/[0.1] shadow-xl flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  {totalMinutes} min
                </div>
              </div>
              <div className="flex items-start justify-between gap-3 px-1">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {recipe.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-white/[0.04] text-stone-300 border border-white/[0.08]"
                      >
                        {tag}
                      </span>
                    ))}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                      <HeartPulse className="w-2.5 h-2.5" />
                      Score {recipe.healthScore}/100
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-white font-['Outfit'] leading-tight tracking-wide">
                    {title}
                  </h2>
                </div>

                <div className="text-right shrink-0 bg-black/40 rounded-xl p-2 border border-white/[0.04] shadow-inner">
                  <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block mb-0.5">
                    {currentText.costServing}
                  </span>
                  <span className="text-lg font-extrabold text-emerald-400 font-['Outfit'] tracking-tight">
                    {currency === "EUR"
                      ? `€${recipe.costPerServingEUR.toFixed(2)}`
                      : `$${(recipe.costPerServingEUR * 1.1).toFixed(2)}`}
                  </span>
                </div>
              </div>

              <p className="text-sm text-stone-400 line-clamp-2 leading-relaxed px-1 font-medium">
                {desc}
              </p>

              {/* Nutrition & Time Bar */}
              <div className="grid grid-cols-5 gap-1.5 bg-[#0B0F12]/60 p-2.5 rounded-2xl text-center border border-white/[0.04] shadow-inner relative z-10 mx-1">
                <div>
                  <span className="text-stone-500 block text-[9px] font-bold uppercase tracking-widest mb-1">
                    {currentText.calories}
                  </span>
                  <span className="font-extrabold text-white font-['Outfit'] text-sm">{recipe.calories}</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[9px] font-bold uppercase tracking-widest mb-1">
                    {currentText.protein}
                  </span>
                  <span className="font-extrabold text-emerald-400 font-['Outfit'] text-sm">
                    {recipe.proteinG}g
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[9px] font-bold uppercase tracking-widest mb-1">
                    {currentText.carbs}
                  </span>
                  <span className="font-extrabold text-amber-400 font-['Outfit'] text-sm">
                    {recipe.carbsG}g
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[9px] font-bold uppercase tracking-widest mb-1">
                    {currentText.fat}
                  </span>
                  <span className="font-extrabold text-stone-300 font-['Outfit'] text-sm">{recipe.fatG}g</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[9px] font-bold uppercase tracking-widest mb-1">
                    {currentText.prepTime}
                  </span>
                  <span className="font-extrabold text-teal-400 font-['Outfit'] text-sm">{totalMinutes}m</span>
                </div>
              </div>

              {/* Ingredients match summary */}
              <div className="flex items-center justify-between text-xs pt-1 px-1">
                <span className="text-stone-300 text-[11px] font-bold tracking-wide flex items-center gap-2 bg-white/[0.04] py-1 px-2.5 rounded-lg border border-white/[0.04]">
                  <span
                    className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${
                      hasMissing ? "bg-amber-400 text-amber-400" : "bg-emerald-400 text-emerald-400"
                    }`}
                  />
                  {language === "bg"
                    ? `${inPantryCount} от ${totalIngCount} ${currentText.recipeMissingItems}`
                    : language === "es"
                    ? `${inPantryCount} de ${totalIngCount} ${currentText.recipeMissingItems}`
                    : `${inPantryCount} of ${totalIngCount} ${currentText.recipeMissingItems}`}
                </span>

                <button
                  onClick={() => setSelectedRecipe(recipe)}
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 font-bold text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-xl transition-all"
                >
                  <span>{currentText.recipeViewSteps}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-700/50">
                <button
                  id={`cook-btn-${recipe.id}`}
                  onClick={() => handleCook(recipe)}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-950/40"
                >
                  <ChefHat className="w-3.5 h-3.5" />
                  <span>{currentText.cookThisRecipe}</span>
                </button>

                {hasMissing ? (
                  <button
                    id={`add-missing-btn-${recipe.id}`}
                    onClick={() => onAddMissingToShopping(recipe)}
                    className="px-3 py-2 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-stone-600"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
                    <span>{currentText.addMissingToCart}</span>
                  </button>
                ) : (
                  <div className="px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{currentText.recipeAllInStock}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step-by-step Interactive Cooking Drawer / Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B0F12] border border-white/[0.08] rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative">
            {/* Modal Dish Image Banner */}
            <div className="relative h-56 overflow-hidden rounded-t-3xl bg-stone-900 border-b border-white/[0.04]">
              <img
                src={getRecipeImageUrl(selectedRecipe)}
                alt={getRecipeTitle(selectedRecipe)}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F12] via-[#0B0F12]/40 to-black/50" />
              <button
                type="button"
                onClick={() => setSelectedRecipe(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center cursor-pointer transition-colors backdrop-blur-md border border-white/[0.1]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/[0.04]">
                <div>
                  <h2 className="text-2xl font-bold text-white font-['Outfit'] tracking-tight">
                    {getRecipeTitle(selectedRecipe)}
                  </h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-sm text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      {currency === "EUR"
                        ? `€${selectedRecipe.costPerServingEUR.toFixed(2)}`
                        : `$${(selectedRecipe.costPerServingEUR * 1.1).toFixed(2)}`} / {language === "es" ? "ración" : language === "bg" ? "порция" : "serving"}
                    </span>
                    <span className="text-sm text-stone-400 font-medium flex items-center gap-1.5 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.08]">
                      <Clock className="w-3.5 h-3.5" />
                      {selectedRecipe.prepTimeMin + selectedRecipe.cookTimeMin} min
                    </span>
                  </div>
                </div>
              </div>

              {/* Nutrition highlight callout */}
              {getRecipeNutrition(selectedRecipe) && (
                <div className="bg-[#131A1F]/80 border border-emerald-500/20 p-4 rounded-2xl flex items-start gap-3 shadow-inner">
                  <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                    <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                  </div>
                  <p className="text-sm text-stone-300 leading-relaxed font-medium">
                    {getRecipeNutrition(selectedRecipe)}
                  </p>
                </div>
              )}

            {/* Ingredients list */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-stone-500">
                {currentText.ingredients}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedRecipe.ingredients.map((ing, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border text-sm font-medium flex items-center justify-between transition-colors ${
                      ing.inPantry
                        ? "bg-white/[0.02] border-white/[0.04] text-stone-300"
                        : "bg-amber-500/5 border-amber-500/20 text-amber-200"
                    }`}
                  >
                    <span>{ing.name}</span>
                    <span className="font-bold shrink-0 ml-1 opacity-60">
                      {ing.amount} {ing.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step by step instructions */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-stone-500">
                {currentText.instructions}
              </h3>
              <div className="space-y-3">
                {getRecipeInstructions(selectedRecipe).map((step, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-white/[0.02] rounded-2xl border border-white/[0.04] flex items-start gap-3.5 hover:bg-white/[0.04] transition-colors"
                  >
                    <span className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-sm text-stone-300 leading-relaxed font-medium">
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 mt-2 border-t border-white/[0.04] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onAddMissingToShopping(selectedRecipe)}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-sm font-bold text-stone-300 flex items-center gap-2 border border-white/[0.04] hover:border-white/[0.1] transition-all cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">{currentText.addMissingToCart}</span>
                <span className="sm:hidden">{language === "es" ? "Añadir a lista" : language === "bg" ? "В списъка" : "Add to list"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleCook(selectedRecipe);
                  setSelectedRecipe(null);
                }}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-sm font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all cursor-pointer"
              >
                <ChefHat className="w-4 h-4" />
                <span>{currentText.cookThisRecipe}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* Confirmation Modal for Clearing Recipes */}
      <ConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => {
          if (onClearRecipes) {
            onClearRecipes();
          }
          setShowClearConfirm(false);
        }}
        title={currentText.recipesClearAll}
        description={currentText.recipesClearConfirm}
        confirmText={currentText.clear}
        cancelText={currentText.cancel}
        danger={true}
      />
    </div>
  );
};
