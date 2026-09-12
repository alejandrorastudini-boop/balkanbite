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
    { id: "all", label: currentText.filterAll },
    { id: "fast", label: currentText.quick15MinFilter },
    { id: "cheap", label: language === "bg" ? "💰 Под 3€" : language === "es" ? "💰 Menos de 3€" : "💰 Under 3€" },
    { id: "protein", label: currentText.highProteinFilter },
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
    <div id="recipes-view" className="space-y-4 pb-20">
      {/* Header with AI Trigger */}
      <div className="bg-gradient-to-br from-emerald-950/60 via-stone-900 to-stone-900 border border-emerald-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {currentText.recipeEngineTitle}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                {pantry.length} {currentText.recipePantryStock}
              </span>
              {recipes.length > 0 && onClearRecipes && (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="p-1.5 rounded-lg bg-stone-900/80 border border-stone-700/60 text-stone-400 hover:text-rose-400 hover:border-rose-900 transition-colors cursor-pointer"
                  title={currentText.recipesClearAll || "Vaciar Recetas"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <h2 className="text-lg font-bold text-white leading-tight font-['Outfit']">
            {currentText.recipesTitle}
          </h2>
          <p className="text-xs text-stone-300 leading-relaxed max-w-lg">
            {currentText.recipesSubtitle}
          </p>

          <div className="pt-1 flex flex-wrap items-center gap-2">
            <button
              id="generate-ai-recipes-btn"
              disabled={isLoadingAi}
              onClick={onGenerateAiRecipes}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-950/60 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAi ? "animate-spin" : ""}`} />
              <span>
                {isLoadingAi ? currentText.aiThinking : currentText.generateAiRecipes}
              </span>
            </button>
            {recipes.length === 0 && onLoadSampleRecipes && (
              <button
                type="button"
                onClick={onLoadSampleRecipes}
                className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 border border-stone-700 cursor-pointer transition-all shadow-sm"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>{language === "es" ? "Cargar Recetas de Ejemplo" : language === "bg" ? "Зареди примерни рецепти" : "Load Sample Recipes"}</span>
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

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {filters.map((f) => (
          <button
            key={f.id}
            id={`recipe-filter-${f.id}`}
            onClick={() => setActiveFilter(f.id)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              activeFilter === f.id
                ? "bg-stone-200 text-stone-900 font-semibold"
                : "bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Recipe Cards Grid */}
      <div className="space-y-3.5">
        {filteredRecipes.length === 0 && (
          <div className="bg-stone-800/60 border border-stone-700/60 rounded-2xl p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-stone-700/50 flex items-center justify-center mx-auto text-stone-400">
              <ChefHat className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-xs text-stone-300 max-w-sm mx-auto leading-relaxed">
              {currentText.recipesEmptyState}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                disabled={isLoadingAi}
                onClick={onGenerateAiRecipes}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold inline-flex items-center gap-2 transition-all shadow-md disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAi ? "animate-spin" : ""}`} />
                <span>{isLoadingAi ? currentText.aiThinking : currentText.generateAiRecipes}</span>
              </button>
              {onLoadSampleRecipes && (
                <button
                  type="button"
                  onClick={onLoadSampleRecipes}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>{language === "es" ? "Cargar Recetas de Ejemplo" : language === "bg" ? "Зареди примерни рецепти" : "Load Sample Recipes"}</span>
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

          return (
            <div
              key={recipe.id}
              id={`recipe-card-${recipe.id}`}
              className="bg-stone-800/90 border border-stone-700/70 hover:border-emerald-500/40 rounded-2xl p-4 space-y-3 transition-all shadow-sm overflow-hidden"
            >
              {recipe.imageUrl && (
                <div className="relative -mx-4 -mt-4 mb-3 h-32 overflow-hidden">
                  <img 
                    src={recipe.imageUrl} 
                    alt={title}
                    className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-800/90 to-transparent" />
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {recipe.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-stone-700 text-stone-300"
                      >
                        {tag}
                      </span>
                    ))}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <HeartPulse className="w-2.5 h-2.5" />
                      Score {recipe.healthScore}/100
                    </span>
                  </div>

                  <h2 className="text-base font-bold text-white font-['Outfit'] leading-snug">
                    {title}
                  </h2>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs text-stone-400 block">
                    {currentText.costServing}
                  </span>
                  <span className="text-sm font-extrabold text-emerald-400 font-['Outfit']">
                    {currency === "EUR"
                      ? `€${recipe.costPerServingEUR.toFixed(2)}`
                      : `$${(recipe.costPerServingEUR * 1.1).toFixed(2)}`}
                  </span>
                </div>
              </div>

              <p className="text-xs text-stone-300 line-clamp-2 leading-relaxed">
                {desc}
              </p>

              {/* Nutrition & Time Bar */}
              <div className="grid grid-cols-5 gap-1 bg-stone-900/60 p-2 rounded-xl text-center text-[11px] border border-stone-800">
                <div>
                  <span className="text-stone-400 block text-[10px]">
                    {currentText.calories}
                  </span>
                  <span className="font-bold text-white">{recipe.calories}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">
                    {currentText.protein}
                  </span>
                  <span className="font-bold text-emerald-400">
                    {recipe.proteinG}g
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">
                    {currentText.carbs}
                  </span>
                  <span className="font-bold text-amber-300">
                    {recipe.carbsG}g
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">
                    {currentText.fat}
                  </span>
                  <span className="font-bold text-stone-300">{recipe.fatG}g</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">
                    {currentText.prepTime}
                  </span>
                  <span className="font-bold text-teal-400">{totalMinutes}m</span>
                </div>
              </div>

              {/* Ingredients match summary */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-stone-300 text-[11px] flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      hasMissing ? "bg-amber-400" : "bg-emerald-400"
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
                  className="text-emerald-400 hover:text-emerald-300 font-semibold text-xs flex items-center gap-1"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-stone-800 border border-stone-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-700">
              <div>
                <h2 className="text-lg font-bold text-white font-['Outfit']">
                  {getRecipeTitle(selectedRecipe)}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-emerald-400 font-bold">
                    {currency === "EUR"
                      ? `€${selectedRecipe.costPerServingEUR.toFixed(2)} / serving`
                      : `$${(selectedRecipe.costPerServingEUR * 1.1).toFixed(2)} / serving`}
                  </span>
                  <span className="text-xs text-stone-400">•</span>
                  <span className="text-xs text-stone-300">
                    {selectedRecipe.prepTimeMin + selectedRecipe.cookTimeMin} min total
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecipe(null)}
                className="w-8 h-8 rounded-full bg-stone-700 hover:bg-stone-600 text-stone-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Nutrition highlight callout */}
            {getRecipeNutrition(selectedRecipe) && (
              <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl flex items-start gap-2.5">
                <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-200 leading-relaxed">
                  {getRecipeNutrition(selectedRecipe)}
                </p>
              </div>
            )}

            {/* Ingredients list */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                {currentText.ingredients}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedRecipe.ingredients.map((ing, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                      ing.inPantry
                        ? "bg-stone-900/60 border-stone-700/60 text-stone-200"
                        : "bg-amber-950/30 border-amber-500/40 text-amber-200"
                    }`}
                  >
                    <span>{ing.name}</span>
                    <span className="font-bold shrink-0 ml-1 text-stone-300">
                      {ing.amount} {ing.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step by step instructions */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                {currentText.instructions}
              </h3>
              <div className="space-y-2">
                {getRecipeInstructions(selectedRecipe).map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-stone-900/50 rounded-xl border border-stone-750 flex items-start gap-3"
                  >
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-xs text-stone-200 leading-relaxed">
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-stone-700 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onAddMissingToShopping(selectedRecipe)}
                className="px-3 py-2 rounded-xl bg-stone-700 hover:bg-stone-600 text-xs font-semibold text-stone-200 flex items-center gap-1.5 cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>{currentText.addMissingToCart}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleCook(selectedRecipe);
                  setSelectedRecipe(null);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5 shadow-md shadow-emerald-950/50 cursor-pointer"
              >
                <ChefHat className="w-4 h-4" />
                <span>{currentText.cookThisRecipe}</span>
              </button>
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
        title={currentText.recipesClearAll || (language === "es" ? "Vaciar Recetas" : "Clear Recipes")}
        description={currentText.recipesClearConfirm || (language === "es" ? "¿Seguro que quieres vaciar la lista de recetas?" : "Are you sure you want to clear all recipes?")}
        confirmText={currentText.clear}
        cancelText={currentText.cancel}
        danger={true}
      />
    </div>
  );
};
