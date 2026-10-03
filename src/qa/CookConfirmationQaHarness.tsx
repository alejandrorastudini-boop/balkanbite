import React, { useRef, useState } from "react";
import { RecipeView } from "../components/RecipeView";
import type { PantryItem, Recipe } from "../types";
import { deductRecipeIngredientsFromPantry } from "../utils/pantryConsumption";
import {
  runtimeQaDeploymentId,
  runtimeQaDeploymentSha,
  runtimeQaSourceFingerprint,
} from "./runtimeQaGate";

const initialPantry: PantryItem[] = [{
  id: "qa-rice-lot",
  name: "Rice",
  quantity: 250,
  unit: "g",
  category: "Pantry/Grains",
  addedAt: "2026-09-29",
}];

function qaRecipe(id: string, amount: number): Recipe {
  return {
    id,
    title: {
      en: id === "qa-rice-available"
        ? "QA Rice Available"
        : "QA Rice Insufficient",
      bg: "QA ориз",
      es: "QA arroz",
    },
    description: {
      en: "Synthetic async cooking confirmation test.",
      bg: "Синтетичен тест.",
      es: "Prueba sintética.",
    },
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
    ingredients: [{ name: "Rice", amount, unit: "g", inPantry: false }],
    instructions: {
      en: ["Synthetic QA step."],
      bg: ["QA стъпка."],
      es: ["Paso de QA."],
    },
    nutritionHighlights: {
      en: "Not verified",
      bg: "Непотвърдено",
      es: "No verificado",
    },
  };
}

const recipes = [
  qaRecipe("qa-rice-available", 100),
  qaRecipe("qa-rice-insufficient", 400),
];

export const CookConfirmationQaHarness: React.FC = () => {
  const [pantry, setPantry] = useState<PantryItem[]>(initialPantry);
  const [attempts, setAttempts] = useState(0);
  const [successfulCooks, setSuccessfulCooks] = useState(0);
  const [lastOutcome, setLastOutcome] = useState("none");
  const [lastConfirmationId, setLastConfirmationId] = useState("");
  const [sameIdRetries, setSameIdRetries] = useState(0);
  const previousConfirmationId = useRef<string | null>(null);

  const onCookRecipe = async (
    recipe: Recipe,
    cookConfirmationId: string,
  ) => {
    if (previousConfirmationId.current === cookConfirmationId) {
      setSameIdRetries(count => count + 1);
    }
    previousConfirmationId.current = cookConfirmationId;
    setLastConfirmationId(cookConfirmationId);
    setAttempts(count => count + 1);
    setLastOutcome("pending");

    // Leave enough time for Playwright to prove controls are locked.
    await new Promise(resolve => setTimeout(resolve, 180));

    const result = deductRecipeIngredientsFromPantry(
      pantry,
      recipe.ingredients,
    );
    if (result.issues.length > 0) {
      setLastOutcome("rejected");
      return {
        success: false as const,
        issueCount: result.issues.length,
      };
    }

    setPantry(result.pantry);
    setSuccessfulCooks(count => count + 1);
    setLastOutcome("recorded");
    return { success: true as const };
  };

  return (
    <main
      data-testid="qa-cook-confirmation-root"
      data-deployment-sha={runtimeQaDeploymentSha()}
      data-deployment-id={runtimeQaDeploymentId()}
      data-source-fingerprint={runtimeQaSourceFingerprint()}
      className="min-h-screen bg-[#0B0F12] text-stone-100 p-4"
    >
      <span data-testid="qa-cook-stock" className="sr-only">
        {String(pantry.find(item => item.id === "qa-rice-lot")?.quantity ?? 0)}
      </span>
      <span data-testid="qa-cook-attempts" className="sr-only">
        {attempts}
      </span>
      <span data-testid="qa-cook-successes" className="sr-only">
        {successfulCooks}
      </span>
      <span data-testid="qa-cook-outcome" className="sr-only">
        {lastOutcome}
      </span>
      <span data-testid="qa-cook-last-id" className="sr-only">
        {lastConfirmationId}
      </span>
      <span data-testid="qa-cook-same-id-retries" className="sr-only">
        {sameIdRetries}
      </span>

      <RecipeView
        recipes={recipes}
        pantry={pantry}
        onCookRecipe={onCookRecipe}
        onAddMissingToShopping={() => {}}
        onGenerateAiRecipes={async () => {}}
        isLoadingAi={false}
        language="en"
        currency="EUR"
      />
    </main>
  );
};
