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
  const depletedPantryItems = pantry.filter((p) => p.quantity <= 1);
  const expiringPantryItems = pantry.filter(
    (p) => p.expiryDaysLeft !== undefined && p.expiryDaysLeft <= 3 && p.quantity > 0
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
  // 0 - 100 based on critical triggers
  let score = 0;
  const reasonsEs: string[] = [];
  const reasonsEn: string[] = [];
  const reasonsBg: string[] = [];

  // Missing meal ingredients for today/tomorrow is a high trigger
  const todayMissing = missingMealIngredients.filter((m) => m.dayLabel.includes("Hoy") || m.dayLabel.includes("Today") || m.dayLabel.includes("Днес"));
  if (todayMissing.length > 0) {
    score += 45;
    reasonsEs.push(`Faltan ${todayMissing.length} ingredientes para las comidas de HOY.`);
    reasonsEn.push(`Missing ${todayMissing.length} ingredients for TODAY'S planned meals.`);
    reasonsBg.push(`Липсват ${todayMissing.length} съставки за днешните ястия.`);
  } else if (missingMealIngredients.length > 0) {
    score += 25;
    reasonsEs.push(`Faltan ${missingMealIngredients.length} ingredientes para el menú de los próximos días.`);
    reasonsEn.push(`Missing ${missingMealIngredients.length} ingredients for upcoming planned meals.`);
    reasonsBg.push(`Липсват ${missingMealIngredients.length} съставки за менюто за следващите дни.`);
  }

  // Pending items on shopping list
  if (pendingShoppingItems.length >= 4) {
    score += 35;
    reasonsEs.push(`Tienes ${pendingShoppingItems.length} artículos acumulados en tu lista de la compra.`);
    reasonsEn.push(`You have ${pendingShoppingItems.length} items accumulated on your shopping list.`);
    reasonsBg.push(`Имате ${pendingShoppingItems.length} продукта в списъка за пазаруване.`);
  } else if (pendingShoppingItems.length > 0) {
    score += 15;
    reasonsEs.push(`Tienes ${pendingShoppingItems.length} artículos pendientes en la lista de la compra.`);
    reasonsEn.push(`You have ${pendingShoppingItems.length} pending items on your shopping list.`);
    reasonsBg.push(`Имате ${pendingShoppingItems.length} чакащи продукта за пазаруване.`);
  }

  // Depleted Pantry Essentials
  if (depletedPantryItems.length >= 3) {
    score += 25;
    reasonsEs.push(`${depletedPantryItems.length} productos básicos en despensa están agotados o casi vacíos.`);
    reasonsEn.push(`${depletedPantryItems.length} pantry essentials are depleted or low in stock.`);
    reasonsBg.push(`${depletedPantryItems.length} основни продукта в килера са на привършване или изчерпани.`);
  } else if (depletedPantryItems.length > 0) {
    score += 10;
    reasonsEs.push(`${depletedPantryItems.length} alimento de tu despensa tiene stock bajo.`);
    reasonsEn.push(`${depletedPantryItems.length} pantry item is low in stock.`);
    reasonsBg.push(`${depletedPantryItems.length} продукт в килера е с ниско количество.`);
  }

  // Bound score
  score = Math.min(100, Math.max(0, score));

  let urgencyLevel: "urgent" | "recommended" | "optimal" = "optimal";
  let daysUntilNextTrip = 3;

  if (score >= 60 || todayMissing.length > 0) {
    urgencyLevel = "urgent";
    daysUntilNextTrip = 0; // Today
  } else if (score >= 30 || pendingShoppingItems.length >= 2 || missingMealIngredients.length > 0) {
    urgencyLevel = "recommended";
    daysUntilNextTrip = 1; // Tomorrow
  } else {
    urgencyLevel = "optimal";
    daysUntilNextTrip = 4;
  }

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
      es:
        urgencyLevel === "urgent"
          ? "Se requieren ingredientes para tus próximas comidas"
          : urgencyLevel === "recommended"
          ? "Tienes productos pendientes y stock bajo en despensa"
          : "Tu despensa cubre los menús previstos",
      en:
        urgencyLevel === "urgent"
          ? "Ingredients needed for upcoming planned meals"
          : urgencyLevel === "recommended"
          ? "Pending items and low stock detected in your pantry"
          : "Your pantry is sufficient for scheduled meals",
      bg:
        urgencyLevel === "urgent"
          ? "Нужни са съставки за предстоящите ястия"
          : urgencyLevel === "recommended"
          ? "Имате чакащи продукти и нисък запас в килера"
          : "Килерът е достатъчен за планираните ястия",
    },
    reasons: {
      es: reasonsEs.length > 0 ? reasonsEs : ["Todo tu menú de los próximos 3 días tiene ingredientes en despensa."],
      en: reasonsEn.length > 0 ? reasonsEn : ["All meals for the next 3 days have ingredients in pantry."],
      bg: reasonsBg.length > 0 ? reasonsBg : ["Всички ястия за следващите 3 дни имат налични съставки."],
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
