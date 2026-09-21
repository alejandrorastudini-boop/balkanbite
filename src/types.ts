export type Language = "en" | "bg" | "es";
export type Currency = "EUR" | "USD";

export interface PantryPurchaseRecord {
  sourceId: string;
  source: "pantry_legacy" | "shopping_list" | "confirmed_reconciliation";
  name: string;
  quantity: number;
  unit: string;
  acquiredAt: string;
  estimatedCostEUR?: number;
  expiryDaysLeft?: number;
}

export interface PantryItem {
  id: string;
  name: string;
  nameBg?: string;
  nameEs?: string;
  quantity: number;
  unit: string;
  category: "Produce" | "Dairy" | "Meat/Fish" | "Pantry/Grains" | "Spices" | "Other";
  expiryDaysLeft?: number;
  estimatedCostEUR?: number | null;
  addedAt: string;
  purchaseHistory?: PantryPurchaseRecord[];
  expiryIsPartial?: boolean;
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
  healthScore?: number;
  /** Numeric recipe nutrition is provisional unless a deterministic verified source is attached. */
  nutritionDataStatus?: "verified" | "estimated" | "unknown";
  /** Recipe cost is provisional unless backed by verified price inputs. */
  costDataStatus?: "verified" | "estimated" | "unknown";
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
  estimatedPriceEUR?: number;
  checked: boolean;
  /**
   * Provenance of the planned list amount. This never makes the amount an
   * authoritative purchase quantity by itself.
   */
  amountOrigin?: "user_entered" | "ai_estimated" | "deterministic_shortfall";
  /** Explicit confirmation that the displayed quantity/unit was actually purchased. */
  purchaseAmountConfirmed?: boolean;
  reason?: string;
}

export type HealthDataStatus =
  | "known"
  | "unknown"
  | "not_applicable"
  | "prefer_not_to_say";

export type HealthDataSource =
  | "self_reported"
  | "measured"
  | "imported"
  | "estimated";

export interface HealthDatum<T> {
  status: HealthDataStatus;
  value?: T;
  source?: HealthDataSource;
  /** ISO-8601 timestamp for when this datum was reported, measured or imported. */
  recordedAt?: string;
}

/**
 * Versioned health domain boundary.
 * Keep derived metrics (for example BMI) out of persisted state when they can
 * be recalculated deterministically from authoritative inputs.
 */
export type PhysiologicalSexForEnergy = "female" | "male";

export type AdultPhysicalActivityCategory =
  | "low_active"
  | "moderately_active"
  | "active"
  | "very_active";

export type PregnancyLactationStatus =
  | "not_pregnant_or_lactating"
  | "pregnant_or_lactating";

export interface HealthProfile {
  version: 1;
  ageYears?: HealthDatum<number>;
  heightCm?: HealthDatum<number>;
  weightKg?: HealthDatum<number>;
  /**
   * Optional physiological input for source-backed energy equations.
   * This is not a gender-identity field and must never receive a default.
   */
  physiologicalSex?: HealthDatum<PhysiologicalSexForEnergy>;
  /**
   * Whole-day activity category selected explicitly by the user.
   * The corresponding PAL remains a derived, approximate value.
   */
  activityCategory?: HealthDatum<AdultPhysicalActivityCategory>;
  /**
   * Collected only when needed by a calculation path.
   * Absence never means "not pregnant or lactating".
   */
  pregnancyLactationStatus?: HealthDatum<PregnancyLactationStatus>;
}

export interface UserProfile {
  name: string;
  language: Language;
  currency: Currency;
  cookingSpeed?: "fast" | "moderate" | "elaborate";
  /** Deprecated until a purpose-specific user choice exists. Never default this field. */
  healthGoal?: "balanced" | "muscle" | "fat_loss" | "heart";
  dietStyle?: "all" | "mediterranean" | "vegetarian" | "vegan" | "keto" | "gluten_free";
  disliked: string[];
  allergies?: string[];
  householdSize?: number;
  cookingLevel?: "beginner" | "intermediate" | "chef";
  appliances?: string[];
  monthlyBudgetEUR?: number;
  healthProfile?: HealthProfile;
  /** Deprecated until the user explicitly chooses a budget style. Never default this field. */
  budgetTier?: "strict_budget" | "balanced" | "flexible";
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
  /** Nutrition from voice or other unverified input must not be treated as an authoritative daily total. */
  nutritionDataStatus?: "verified" | "estimated" | "unknown";
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
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
