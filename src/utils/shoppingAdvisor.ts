import { PantryItem, Recipe, MealPlanDay, ShoppingItem, Language } from "../types";
import { isIngredientInPantry } from "./menuAutoPlanner";

export interface MissingMealIngredient {
  recipeTitle: string;
  mealType: "breakfast" | "lunch" | "dinner";
  date: string;
  dayLabel: string;
  ingredientName: string;
  estimatedPriceEUR: number;
  unit: string;
  amount: number;
}

export interface ShoppingAlertDiagnostic {
  urgencyLevel: "urgent" | "recommended" | "optimal";
  urgencyScore: number; // 0 - 100
  urgencyLabel: {
    es: string;
    en: string;
    bg: string;
  };
  headline: {
    es: string;
    en: string;
    bg: string;
  };
  reasons: {
    es: string[];
    en: string[];
    bg: string[];
  };
  missingMealIngredients: MissingMealIngredient[];
  depletedPantryItems: PantryItem[];
  expiringPantryItems: PantryItem[];
  pendingShoppingItemsCount: number;
  estimatedTotalTripEUR: number;
  itemsToAddToShoppingList: Array<Omit<ShoppingItem, "id" | "checked">>;
  daysUntilNextTripNeeded: number; // 0 = today, 1 = tomorrow, etc.
}

export function evaluateShoppingNeeds(
  pantry: PantryItem[],
  mealPlan: MealPlanDay[],
  shoppingList: ShoppingItem[],
  language: Language = "es"
): ShoppingAlertDiagnostic {
  // Only items with quantity <= 0 are depleted
  const depletedPantryItems = pantry.filter((p) => p.quantity <= 0);
  const expiringPantryItems = pantry.filter(
    (p) => p.expiryDaysLeft !== undefined && p.expiryDaysLeft <= 2 && p.quantity > 0
  );
  const pendingShoppingItems = shoppingList.filter((s) => !s.checked);

  // Analyze upcoming 3 days of meal plan
  const todayStr = new Date().toISOString().split("T")[0];
  const upcomingDays = mealPlan.slice(0, 3); // next 3 days

  const missingMealIngredients: MissingMealIngredient[] = [];
  const candidateItemsToAdd: Map<string, Omit<ShoppingItem, "id" | "checked">> = new Map();

  upcomingDays.forEach((day, index) => {
    const dayName =
      index === 0
        ? language === "es"
          ? "Hoy"
          : language === "bg"
          ? "Днес"
          : "Today"
        : index === 1
        ? language === "es"
          ? "Mañana"
          : language === "bg"
          ? "Утре"
          : "Tomorrow"
        : language === "es"
        ? `En ${index} días`
        : language === "bg"
        ? `След ${index} дни`
        : `In ${index} days`;

    const meals: Array<{ type: "breakfast" | "lunch" | "dinner"; recipe?: Recipe }> = [
      { type: "breakfast", recipe: day.breakfast },
      { type: "lunch", recipe: day.lunch },
      { type: "dinner", recipe: day.dinner },
    ];

    meals.forEach((m) => {
      if (!m.recipe) return;
      const rTitle =
        language === "es"
          ? m.recipe.title.es || m.recipe.title.en
          : language === "bg"
          ? m.recipe.title.bg || m.recipe.title.en
          : m.recipe.title.en;

      m.recipe.ingredients.forEach((ing) => {
        const inStock = isIngredientInPantry(ing.name, pantry);
        if (!inStock) {
          const itemKey = ing.name.toLowerCase().trim();
          missingMealIngredients.push({
            recipeTitle: rTitle,
            mealType: m.type,
            date: day.date,
            dayLabel: dayName,
            ingredientName: ing.name,
            estimatedPriceEUR: 1.8,
            unit: ing.unit || "uds",
            amount: ing.amount || 1,
          });

          // Check if already in shopping list
          const alreadyInShoppingList = shoppingList.some((s) =>
            s.name.toLowerCase().includes(itemKey) || itemKey.includes(s.name.toLowerCase())
          );

          if (!alreadyInShoppingList && !candidateItemsToAdd.has(itemKey)) {
            candidateItemsToAdd.set(itemKey, {
              name: ing.name,
              quantity: ing.amount || 1,
              unit: ing.unit || "uds",
              category: "Produce",
              estimatedPriceEUR: 1.8,
              reason: `Para ${rTitle} (${dayName})`,
            });
          }
        }
      });
    });
  });

  // Calculate Urgency Score
  let score = 0;
  const reasonsEs: string[] = [];
  const reasonsEn: string[] = [];
  const reasonsBg: string[] = [];

  // Missing meal ingredients for today
  const todayMissing = missingMealIngredients.filter(
    (m) =>
      m.dayLabel.includes("Hoy") ||
      m.dayLabel.includes("Today") ||
      m.dayLabel.includes("Днес")
  );

  if (todayMissing.length > 0) {
    score += Math.min(50, 30 + todayMissing.length * 10);
    reasonsEs.push(`Faltan ${todayMissing.length} ingredientes para las comidas de HOY.`);
    reasonsEn.push(`Missing ${todayMissing.length} ingredients for TODAY'S planned meals.`);
    reasonsBg.push(`Липсват ${todayMissing.length} съставки за днешните ястия.`);
  } else if (missingMealIngredients.length > 0) {
    score += Math.min(35, 15 + missingMealIngredients.length * 5);
    reasonsEs.push(
      `Faltan ${missingMealIngredients.length} ingredientes para las comidas de los próximos días.`
    );
    reasonsEn.push(
      `Missing ${missingMealIngredients.length} ingredients for upcoming planned meals.`
    );
    reasonsBg.push(
      `Липсват ${missingMealIngredients.length} съставки за менюто за следващите дни.`
    );
  }

  // Pending items on shopping list
  if (pendingShoppingItems.length >= 6) {
    score += 35;
    reasonsEs.push(`Tienes ${pendingShoppingItems.length} artículos acumulados en tu lista de la compra.`);
    reasonsEn.push(`You have ${pendingShoppingItems.length} items accumulated on your shopping list.`);
    reasonsBg.push(`Имате ${pendingShoppingItems.length} продукта в списъка за пазаруване.`);
  } else if (pendingShoppingItems.length > 0) {
    score += Math.min(25, pendingShoppingItems.length * 5);
    reasonsEs.push(`Tienes ${pendingShoppingItems.length} artículos pendientes en la lista de la compra.`);
    reasonsEn.push(`You have ${pendingShoppingItems.length} pending items on your shopping list.`);
    reasonsBg.push(`Имате ${pendingShoppingItems.length} чакащи продукта за пазаруване.`);
  }

  // Truly depleted pantry items (quantity 0)
  if (depletedPantryItems.length > 0) {
    score += Math.min(30, depletedPantryItems.length * 10);
    reasonsEs.push(`${depletedPantryItems.length} producto(s) en despensa están completamente agotados (0 uds).`);
    reasonsEn.push(`${depletedPantryItems.length} item(s) in pantry are completely depleted (0 in stock).`);
    reasonsBg.push(`${depletedPantryItems.length} продукт(а) в килера са напълно изчерпани.`);
  }

  // Expiring items
  if (expiringPantryItems.length > 0) {
    reasonsEs.push(`Tienes ${expiringPantryItems.length} producto(s) próximos a caducar (≤ 2 días).`);
    reasonsEn.push(`You have ${expiringPantryItems.length} item(s) expiring soon (≤ 2 days).`);
    reasonsBg.push(`Имате ${expiringPantryItems.length} продукт(а) с изтичащ срок (≤ 2 дни).`);
  }

  // Bound score
  score = Math.min(100, Math.max(0, score));

  let urgencyLevel: "urgent" | "recommended" | "optimal" = "optimal";
  let daysUntilNextTrip = 3;

  if (score >= 60 || todayMissing.length > 0) {
    urgencyLevel = "urgent";
    daysUntilNextTrip = 0; // Today
  } else if (score >= 25 || pendingShoppingItems.length >= 2 || missingMealIngredients.length > 0) {
    urgencyLevel = "recommended";
    daysUntilNextTrip = 1; // Tomorrow
  } else {
    urgencyLevel = "optimal";
    daysUntilNextTrip = 4;
  }

  // Accurate headlines
  const headlineEs =
    todayMissing.length > 0
      ? `Faltan ${todayMissing.length} ingredientes para las comidas de hoy.`
      : missingMealIngredients.length > 0
      ? `Faltan ${missingMealIngredients.length} ingredientes para tus recetas planificadas.`
      : depletedPantryItems.length > 0
      ? `Tienes ${depletedPantryItems.length} productos agotados en despensa.`
      : pendingShoppingItems.length > 0
      ? `Tienes ${pendingShoppingItems.length} artículos en tu lista de la compra.`
      : "Tu despensa cubre los menús y no tienes compras pendientes.";

  const headlineEn =
    todayMissing.length > 0
      ? `Missing ${todayMissing.length} ingredients for today's meals.`
      : missingMealIngredients.length > 0
      ? `Missing ${missingMealIngredients.length} ingredients for planned recipes.`
      : depletedPantryItems.length > 0
      ? `You have ${depletedPantryItems.length} depleted pantry items.`
      : pendingShoppingItems.length > 0
      ? `You have ${pendingShoppingItems.length} items on your shopping list.`
      : "Your pantry covers scheduled meals and no shopping is pending.";

  const headlineBg =
    todayMissing.length > 0
      ? `Липсват ${todayMissing.length} съставки за днешните ястия.`
      : missingMealIngredients.length > 0
      ? `Липсват ${missingMealIngredients.length} съставки за планираните рецепти.`
      : depletedPantryItems.length > 0
      ? `Имате ${depletedPantryItems.length} изчерпани продукта в килера.`
      : pendingShoppingItems.length > 0
      ? `Имате ${pendingShoppingItems.length} продукта в списъка за пазаруване.`
      : "Килерът ви покрива менютата и нямате чакащи покупки.";

  // Calculate estimated trip total
  const listCost = pendingShoppingItems.reduce((acc, curr) => acc + (curr.estimatedPriceEUR || 0), 0);
  const missingCost = Array.from(candidateItemsToAdd.values()).reduce((acc, curr) => acc + (curr.estimatedPriceEUR || 0), 0);
  const estimatedTotalTripEUR = Number((listCost + missingCost).toFixed(2));

  return {
    urgencyLevel,
    urgencyScore: score,
    urgencyLabel: {
      es:
        urgencyLevel === "urgent"
          ? "¡Hora de comprar hoy!"
          : urgencyLevel === "recommended"
          ? "Compra recomendada pronto"
          : "Despensa abastecida",
      en:
        urgencyLevel === "urgent"
          ? "Shopping Needed Today!"
          : urgencyLevel === "recommended"
          ? "Shopping Recommended Soon"
          : "Pantry Well Stocked",
      bg:
        urgencyLevel === "urgent"
          ? "Време е за пазаруване днес!"
          : urgencyLevel === "recommended"
          ? "Препоръчва се пазаруване скоро"
          : "Килерът е зареден",
    },
    headline: {
      es: headlineEs,
      en: headlineEn,
      bg: headlineBg,
    },
    reasons: {
      es:
        reasonsEs.length > 0
          ? reasonsEs
          : ["Todo tu menú de los próximos días tiene ingredientes suficientes en despensa."],
      en:
        reasonsEn.length > 0
          ? reasonsEn
          : ["All meals for the next days have sufficient ingredients in pantry."],
      bg:
        reasonsBg.length > 0
          ? reasonsBg
          : ["Всички ястия за следващите дни имат достатъчно налични съставки."],
    },
    missingMealIngredients,
    depletedPantryItems,
    expiringPantryItems,
    pendingShoppingItemsCount: pendingShoppingItems.length,
    estimatedTotalTripEUR,
    itemsToAddToShoppingList: Array.from(candidateItemsToAdd.values()),
    daysUntilNextTripNeeded: daysUntilNextTrip,
  };
}
