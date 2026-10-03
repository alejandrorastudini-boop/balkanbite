import React, { useEffect, useRef, useState } from "react";
import type { MealPlanDay, PantryItem, Recipe } from "../types";
import { isExpectedInventoryResultVisible } from "../utils/expectedInventoryResult";
import { syncMealPlanWithPantry, syncRecipesWithPantry } from "../utils/menuAutoPlanner";
import { runtimeQaDeploymentSha } from "./runtimeQaGate";

const initialPantry: PantryItem[] = [{
  id: "qa-rice",
  name: "Rice",
  quantity: 200,
  unit: "g",
  category: "Pantry/Grains",
  addedAt: "2026-09-29",
}];

const recipe: Recipe = {
  id: "qa-derived-rice",
  title: { en: "QA Rice", bg: "QA ориз", es: "QA arroz" },
  description: { en: "QA", bg: "QA", es: "QA" },
  prepTimeMin: 1,
  cookTimeMin: 1,
  costPerServingEUR: 0,
  costDataStatus: "unknown",
  difficulty: "easy",
  servings: 1,
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  nutritionDataStatus: "unknown",
  tags: ["QA"],
  ingredients: [{ name: "Rice", amount: 150, unit: "g", inPantry: true }],
  instructions: { en: ["QA"], bg: ["QA"], es: ["QA"] },
  nutritionHighlights: { en: "Unknown", bg: "Unknown", es: "Unknown" },
};

const initialPlan: MealPlanDay[] = [{
  date: "2026-09-29",
  dinner: recipe,
}];

export const DerivedInventoryPropagationQaHarness: React.FC = () => {
  const [pantry, setPantry] = useState(initialPantry);
  const [recipes, setRecipes] = useState([recipe]);
  const [mealPlan, setMealPlan] = useState(initialPlan);
  const [serverConfirmed, setServerConfirmed] = useState(true);
  const [reconciliations, setReconciliations] = useState(0);
  const pending = useRef<Record<string, number | null> | null>(null);

  useEffect(() => {
    if (!serverConfirmed || !pending.current) return;
    if (!isExpectedInventoryResultVisible(pending.current, pantry)) return;
    pending.current = null;
    setRecipes(current => syncRecipesWithPantry(current, pantry));
    setMealPlan(current => syncMealPlanWithPantry(current, pantry).newPlan);
    setReconciliations(value => value + 1);
  }, [pantry, serverConfirmed]);

  const stage = () => {
    pending.current = { "qa-rice": 100 };
    setServerConfirmed(false);
  };

  const confirm = () => {
    setPantry(current =>
      current.map(item => item.id === "qa-rice" ? { ...item, quantity: 100 } : item),
    );
    setServerConfirmed(true);
  };

  return (
    <main
      data-testid="qa-derived-propagation-root"
      data-deployment-sha={runtimeQaDeploymentSha()}
      className="min-h-screen bg-[#0B0F12] text-stone-100 p-8"
    >
      <span data-testid="qa-derived-recipe-ready">
        {String(recipes[0].ingredients[0].inPantry)}
      </span>
      <span data-testid="qa-derived-plan-ready">
        {String(mealPlan[0].dinner?.ingredients[0].inPantry)}
      </span>
      <span data-testid="qa-derived-reconciliations">{reconciliations}</span>
      <span data-testid="qa-derived-stock">{pantry[0].quantity}</span>
      <button onClick={stage}>Stage provisional deduction</button>
      <button onClick={confirm}>Confirm server snapshot</button>
    </main>
  );
};
