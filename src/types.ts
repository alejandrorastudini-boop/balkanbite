export type Language = "en" | "bg" | "es";
export type Currency = "EUR" | "USD";

export interface PantryItem {
  id: string;
  name: string;
  nameBg?: string;
  nameEs?: string;
  quantity: number;
  unit: string;
  category: "Produce" | "Dairy" | "Meat/Fish" | "Pantry/Grains" | "Spices" | "Other";
  expiryDaysLeft?: number;
  estimatedCostEUR?: number;
  addedAt: string;
}

export interface RecipeIngredient {
  name: string;
  amount: number;
  unit: string;
  inPantry: boolean;
}

export interface Recipe {
  id: string;
  title: {
    en: string;
    bg: string;
    es: string;
  };
  description: {
    en: string;
    bg: string;
    es: string;
  };
  prepTimeMin: number;
  cookTimeMin: number;
  costPerServingEUR: number;
  difficulty: "easy" | "medium" | "advanced";
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  healthScore: number;
  tags: string[];
  ingredients: RecipeIngredient[];
  instructions: {
    en: string[];
    bg: string[];
    es: string[];
  };
  nutritionHighlights: {
    en: string;
    bg: string;
    es: string;
  };
  imageUrl?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  estimatedPriceEUR: number;
  checked: boolean;
  reason?: string;
}

export interface UserProfile {
  name: string;
  language: Language;
  currency: Currency;
  cookingSpeed: "fast" | "moderate" | "elaborate";
  healthGoal: "balanced" | "muscle" | "fat_loss" | "heart";
  dietStyle: "all" | "mediterranean" | "vegetarian" | "vegan" | "keto" | "gluten_free";
  disliked: string[];
  allergies?: string[];
  householdSize?: number;
  cookingLevel?: "beginner" | "intermediate" | "chef";
  appliances?: string[];
  monthlyBudgetEUR?: number;
  budgetTier: "strict_budget" | "balanced" | "flexible";
  isProSubscriber: boolean;
  onboardingCompleted: boolean;
}

export interface MealPlanDay {
  date: string;
  breakfast?: Recipe;
  lunch?: Recipe;
  dinner?: Recipe;
}

export interface MealLog {
  id: string;
  date: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  recipeId?: string;
  manualName?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  actionType?: "pantry_update" | "shopping_list_add" | "recipe_suggest" | "meal_log";
  itemsAffected?: Array<{ name: string; quantity: number; unit: string }>;
  suggestedRecipe?: Recipe;
  loggedMeal?: MealLog;
}
