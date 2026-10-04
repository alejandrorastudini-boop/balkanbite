import { PantryItem, Recipe, MealPlanDay, ShoppingItem, Language } from "../types";
import { findAuthoritativePantryItems } from "./menuAutoPlanner";
import { normalizeQuantity } from "./quantityUnits";
import { derivePantryItemExpiry, localCalendarDate, pantryItemNeedsExpiryReview } from "./effectiveExpiry";

export type IngredientAvailabilityStatus =
  | "missing"
  | "insufficient"
  | "unverified"
  | "expiry-review";

export interface MissingMealIngredient {
  recipeTitle: string;
  mealType: "breakfast" | "lunch" | "dinner";
  date: string;
  dayLabel: string;
  ingredientName: string;
  // This planner has no verified price source. Keep price unknown rather than
  // encoding an unavailable estimate as a numeric value.
  estimatedPriceEUR?: number;
  unit: string;
  amount: number;
  availabilityStatus: IngredientAvailabilityStatus;
}

export interface ShoppingAlertDiagnostic {
  urgencyLevel: "urgent" | "recommended" | "optimal";
  urgencyScore: number;
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
  estimatedTotalTripEUR?: number;
  itemsToAddToShoppingList: Array<Omit<ShoppingItem, "id" | "checked">>;
  daysUntilNextTripNeeded: number;
}

const normalizedFoodIdentity = (value: string): string =>
  (value || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");

function localDateFromPlanKey(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

function calendarDayOrdinal(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

interface RequirementAssessment {
  status: "covered" | IngredientAvailabilityStatus;
  shortfallAmount: number;
  unit: string;
}

function assessRequirementAgainstRemainingPantry(
  ingredientName: string,
  requiredAmount: number,
  requiredUnit: string,
  pantry: PantryItem[],
  remainingBaseByPantryId: Map<string, number>,
  now: Date,
): RequirementAssessment {
  const required = normalizeQuantity(requiredAmount, requiredUnit);
  if (!required) {
    return {
      status: "unverified",
      shortfallAmount: requiredAmount,
      unit: requiredUnit,
    };
  }

  const allMatchingItems = findAuthoritativePantryItems(ingredientName, pantry);
  if (allMatchingItems.length === 0) {
    return {
      status: "missing",
      shortfallAmount: requiredAmount,
      unit: requiredUnit,
    };
  }

  const compatibleAllItems = allMatchingItems
    .map((item) => ({
      item,
      normalized: normalizeQuantity(item.quantity, item.unit),
    }))
    .filter(
      (entry): entry is { item: PantryItem; normalized: NonNullable<ReturnType<typeof normalizeQuantity>> } =>
        Boolean(
          entry.normalized &&
            entry.normalized.unit.dimension === required.unit.dimension
        )
    );

  if (compatibleAllItems.length === 0) {
    return {
      status: "unverified",
      shortfallAmount: requiredAmount,
      unit: requiredUnit,
    };
  }

  const compatibleItems = compatibleAllItems.filter(
    ({ item }) => !pantryItemNeedsExpiryReview(item, now),
  );
  if (compatibleItems.length === 0) {
    return {
      status: "expiry-review",
      shortfallAmount: requiredAmount,
      unit: requiredUnit,
    };
  }

  let remainingRequiredBase = required.baseQuantity;

  for (const { item, normalized } of compatibleItems) {
    const remainingForItem = remainingBaseByPantryId.has(item.id)
      ? remainingBaseByPantryId.get(item.id) || 0
      : normalized.baseQuantity;

    if (!remainingBaseByPantryId.has(item.id)) {
      remainingBaseByPantryId.set(item.id, normalized.baseQuantity);
    }

    if (remainingForItem <= 0) continue;

    const consumedBase = Math.min(remainingForItem, remainingRequiredBase);
    remainingBaseByPantryId.set(item.id, remainingForItem - consumedBase);
    remainingRequiredBase -= consumedBase;

    if (remainingRequiredBase <= 1e-9) break;
  }

  if (remainingRequiredBase <= 1e-9) {
    return {
      status: "covered",
      shortfallAmount: 0,
      unit: requiredUnit,
    };
  }

  const reviewBase = compatibleAllItems
    .filter(({ item }) => pantryItemNeedsExpiryReview(item, now))
    .reduce((sum, { normalized }) => sum + normalized.baseQuantity, 0);
  return {
    status:
      reviewBase + 1e-9 >= remainingRequiredBase
        ? "expiry-review"
        : "insufficient",
    shortfallAmount: remainingRequiredBase / required.unit.factorToBase,
    unit: requiredUnit,
  };
}

function subtractPendingShoppingAmount(
  ingredientName: string,
  shortfallAmount: number,
  unit: string,
  shoppingList: ShoppingItem[],
  remainingPendingBaseById: Map<string, number>,
): number {
  const required = normalizeQuantity(shortfallAmount, unit);
  if (!required) return shortfallAmount;
  const identity = normalizedFoodIdentity(ingredientName);
  let pendingBase = 0;
  for (const item of shoppingList) {
    if (item.checked || normalizedFoodIdentity(item.name) !== identity) continue;
    const pending = normalizeQuantity(item.quantity, item.unit);
    if (!pending || pending.unit.dimension !== required.unit.dimension) continue;
    const remaining = remainingPendingBaseById.has(item.id)
      ? remainingPendingBaseById.get(item.id) || 0
      : pending.baseQuantity;
    if (!remainingPendingBaseById.has(item.id)) {
      remainingPendingBaseById.set(item.id, pending.baseQuantity);
    }
    const used = Math.min(remaining, Math.max(0, required.baseQuantity - pendingBase));
    pendingBase += used;
    remainingPendingBaseById.set(item.id, remaining - used);
    if (pendingBase + 1e-9 >= required.baseQuantity) break;
  }
  return Math.max(0, required.baseQuantity - pendingBase) / required.unit.factorToBase;
}

function addVerifiedShortfallToCandidateMap(
  candidates: Map<string, Omit<ShoppingItem, "id" | "checked">>,
  ingredientName: string,
  shortfallAmount: number,
  unit: string,
  reason: string
) {
  const normalizedShortfall = normalizeQuantity(shortfallAmount, unit);
  const normalizedName = normalizedFoodIdentity(ingredientName);
  const dimensionKey = normalizedShortfall?.unit.dimension || `raw:${unit.toLowerCase().trim()}`;
  const key = `${normalizedName}::${dimensionKey}`;
  const existing = candidates.get(key);

  if (!existing) {
    candidates.set(key, {
      name: ingredientName,
      quantity: shortfallAmount,
      unit,
      category: "Other",
      // No verified price source is available in this calculation path, so
      // the optional price stays absent rather than using zero as a price.
      reason,
    });
    return;
  }

  const existingNormalized = normalizeQuantity(existing.quantity, existing.unit);
  if (
    normalizedShortfall &&
    existingNormalized &&
    normalizedShortfall.unit.dimension === existingNormalized.unit.dimension
  ) {
    const totalBase = existingNormalized.baseQuantity + normalizedShortfall.baseQuantity;
    candidates.set(key, {
      ...existing,
      quantity: totalBase / existingNormalized.unit.factorToBase,
    });
  }
}

export function evaluateShoppingNeeds(
  pantry: PantryItem[],
  mealPlan: MealPlanDay[],
  shoppingList: ShoppingItem[],
  language: Language = "es",
  now: Date = new Date(),
): ShoppingAlertDiagnostic {
  const depletedPantryItems = pantry.filter((item) => item.quantity <= 0);
  const expiringPantryItems = pantry.filter((item) => {
    if (item.quantity <= 0) return false;
    const expiry = derivePantryItemExpiry(item, now);
    return (
      expiry.status === "known" &&
      !expiry.expired &&
      expiry.daysRemaining <= 2
    );
  });
  const pendingShoppingItems = shoppingList.filter((item) => !item.checked);
  const todayKey = localCalendarDate(now);
  const todayLocal = todayKey ? localDateFromPlanKey(todayKey) : null;
  const upcomingDays = todayLocal
    ? (mealPlan || [])
        .flatMap((day) => {
          const localDate = localDateFromPlanKey(day.date);
          if (!localDate) return [];
          const dayOffset =
            calendarDayOrdinal(localDate) - calendarDayOrdinal(todayLocal);
          return dayOffset >= 0 && dayOffset <= 2
            ? [{ day, dayOffset }]
            : [];
        })
        .sort((a, b) => a.dayOffset - b.dayOffset)
    : [];

  const missingMealIngredients: MissingMealIngredient[] = [];
  const candidateItemsToAdd: Map<
    string,
    Omit<ShoppingItem, "id" | "checked">
  > = new Map();
  const remainingBaseByPantryId = new Map<string, number>();
  const remainingPendingBaseById = new Map<string, number>();

  (upcomingDays || []).forEach(({ day, dayOffset }) => {
    const dayName =
      dayOffset === 0
        ? language === "es"
          ? "Hoy"
          : language === "bg"
          ? "Днес"
          : "Today"
        : dayOffset === 1
        ? language === "es"
          ? "Mañana"
          : language === "bg"
          ? "Утре"
          : "Tomorrow"
        : language === "es"
        ? `En ${dayOffset} días`
        : language === "bg"
        ? `След ${dayOffset} дни`
        : `In ${dayOffset} days`;

    const meals: Array<{
      type: "breakfast" | "lunch" | "dinner";
      recipe?: Recipe;
    }> = [
      { type: "breakfast", recipe: day.breakfast },
      { type: "lunch", recipe: day.lunch },
      { type: "dinner", recipe: day.dinner },
    ];

    meals.forEach((meal) => {
      if (!meal.recipe) return;

      const recipeTitle =
        language === "es"
          ? meal.recipe.title.es || meal.recipe.title.en
          : language === "bg"
          ? meal.recipe.title.bg || meal.recipe.title.en
          : meal.recipe.title.en;

      (meal.recipe.ingredients || []).forEach((ingredient) => {
        const requiredAmount = Number.isFinite(ingredient.amount)
          ? ingredient.amount
          : 0;
        const requiredUnit = ingredient.unit || "";
        const assessment = assessRequirementAgainstRemainingPantry(
          ingredient.name,
          requiredAmount,
          requiredUnit,
          pantry,
          remainingBaseByPantryId,
          now,
        );

        if (assessment.status === "covered") return;

        missingMealIngredients.push({
          recipeTitle,
          mealType: meal.type,
          date: day.date,
          dayLabel: dayName,
          ingredientName: ingredient.name,
          // No verified price source exists here, so leave price absent.
          unit: assessment.unit,
          amount: assessment.shortfallAmount,
          availabilityStatus: assessment.status,
        });

        if (
          assessment.status === "unverified" ||
          assessment.status === "expiry-review"
        ) return;

        const remainingShoppingAmount = subtractPendingShoppingAmount(
          ingredient.name,
          assessment.shortfallAmount,
          assessment.unit,
          shoppingList,
          remainingPendingBaseById,
        );

        if (remainingShoppingAmount > 1e-9) {
          addVerifiedShortfallToCandidateMap(
            candidateItemsToAdd,
            ingredient.name,
            remainingShoppingAmount,
            assessment.unit,
            `Para ${recipeTitle} (${dayName})`
          );
        }
      });
    });
  });

  const verifiedShortfalls = missingMealIngredients.filter(
    (item) =>
      item.availabilityStatus !== "unverified" &&
      item.availabilityStatus !== "expiry-review"
  );
  const unverifiedRequirements = missingMealIngredients.filter(
    (item) => item.availabilityStatus === "unverified"
  );
  const expiryReviewRequirements = missingMealIngredients.filter(
    (item) => item.availabilityStatus === "expiry-review"
  );

  let score = 0;
  const reasonsEs: string[] = [];
  const reasonsEn: string[] = [];
  const reasonsBg: string[] = [];

  const todayMissing = verifiedShortfalls.filter(
    (item) =>
      item.dayLabel.includes("Hoy") ||
      item.dayLabel.includes("Today") ||
      item.dayLabel.includes("Днес")
  );

  if (todayMissing.length > 0) {
    score += Math.min(50, 30 + todayMissing.length * 10);
    reasonsEs.push(
      `Faltan ${todayMissing.length} cantidades verificadas para las comidas de HOY.`
    );
    reasonsEn.push(
      `There are ${todayMissing.length} verified ingredient shortfalls for TODAY'S planned meals.`
    );
    reasonsBg.push(
      `Има ${todayMissing.length} потвърдени недостига за днешните ястия.`
    );
  } else if (verifiedShortfalls.length > 0) {
    score += Math.min(35, 15 + verifiedShortfalls.length * 5);
    reasonsEs.push(
      `Hay ${verifiedShortfalls.length} faltantes cuantitativos verificados para las comidas de los próximos días.`
    );
    reasonsEn.push(
      `There are ${verifiedShortfalls.length} verified quantitative shortfalls for upcoming planned meals.`
    );
    reasonsBg.push(
      `Има ${verifiedShortfalls.length} потвърдени количествени недостига за следващите дни.`
    );
  }

  if (unverifiedRequirements.length > 0) {
    reasonsEs.push(
      `${unverifiedRequirements.length} cantidad(es) no pueden verificarse porque las unidades disponibles no son convertibles de forma segura.`
    );
    reasonsEn.push(
      `${unverifiedRequirements.length} requirement(s) cannot be verified because the available units cannot be safely converted.`
    );
    reasonsBg.push(
      `${unverifiedRequirements.length} количество(а) не могат да бъдат проверени, защото наличните мерни единици не могат да се преобразуват надеждно.`
    );
  }

  if (expiryReviewRequirements.length > 0) {
    reasonsEs.push(
      `${expiryReviewRequirements.length} ingrediente(s) requieren revisar la fecha indicada antes de decidir la compra.`
    );
    reasonsEn.push(
      `${expiryReviewRequirements.length} ingredient(s) require expiry review before deciding whether to buy.`
    );
    reasonsBg.push(
      `${expiryReviewRequirements.length} съставка(и) изискват преглед на срока преди решение за покупка.`
    );
  }

  if (pendingShoppingItems.length >= 6) {
    score += 35;
    reasonsEs.push(
      `Tienes ${pendingShoppingItems.length} artículos acumulados en tu lista de la compra.`
    );
    reasonsEn.push(
      `You have ${pendingShoppingItems.length} items accumulated on your shopping list.`
    );
    reasonsBg.push(
      `Имате ${pendingShoppingItems.length} продукта в списъка за пазаруване.`
    );
  } else if (pendingShoppingItems.length > 0) {
    score += Math.min(25, pendingShoppingItems.length * 5);
    reasonsEs.push(
      `Tienes ${pendingShoppingItems.length} artículos pendientes en la lista de la compra.`
    );
    reasonsEn.push(
      `You have ${pendingShoppingItems.length} pending items on your shopping list.`
    );
    reasonsBg.push(
      `Имате ${pendingShoppingItems.length} чакащи продукта за пазаруване.`
    );
  }

  if (depletedPantryItems.length > 0) {
    score += Math.min(30, depletedPantryItems.length * 10);
    reasonsEs.push(
      `${depletedPantryItems.length} producto(s) en despensa están completamente agotados.`
    );
    reasonsEn.push(
      `${depletedPantryItems.length} item(s) in pantry are completely depleted.`
    );
    reasonsBg.push(
      `${depletedPantryItems.length} продукт(а) в килера са напълно изчерпани.`
    );
  }

  if (expiringPantryItems.length > 0) {
    reasonsEs.push(
      `Tienes ${expiringPantryItems.length} producto(s) próximos a caducar (≤ 2 días).`
    );
    reasonsEn.push(
      `You have ${expiringPantryItems.length} item(s) expiring soon (≤ 2 days).`
    );
    reasonsBg.push(
      `Имате ${expiringPantryItems.length} продукт(а) с изтичащ срок (≤ 2 дни).`
    );
  }

  score = Math.min(100, Math.max(0, score));

  let urgencyLevel: "urgent" | "recommended" | "optimal" = "optimal";
  let daysUntilNextTrip = 3;

  if (score >= 60 || todayMissing.length > 0) {
    urgencyLevel = "urgent";
    daysUntilNextTrip = 0;
  } else if (
    score >= 25 ||
    pendingShoppingItems.length >= 2 ||
    verifiedShortfalls.length > 0
  ) {
    urgencyLevel = "recommended";
    daysUntilNextTrip = 1;
  } else {
    urgencyLevel = "optimal";
    daysUntilNextTrip = 4;
  }

  const headlineEs =
    todayMissing.length > 0
      ? `Hay ${todayMissing.length} faltantes cuantitativos para las comidas de hoy.`
      : verifiedShortfalls.length > 0
      ? `Hay ${verifiedShortfalls.length} faltantes cuantitativos para tus recetas planificadas.`
      : expiryReviewRequirements.length > 0
      ? `Hay ${expiryReviewRequirements.length} ingrediente(s) pendientes de revisar por su fecha indicada.`
      : unverifiedRequirements.length > 0
      ? `Hay ${unverifiedRequirements.length} cantidades que no se pueden verificar con las unidades actuales.`
      : depletedPantryItems.length > 0
      ? `Tienes ${depletedPantryItems.length} productos agotados en despensa.`
      : pendingShoppingItems.length > 0
      ? `Tienes ${pendingShoppingItems.length} artículos en tu lista de la compra.`
      : "Tu despensa cubre los menús y no tienes compras pendientes.";

  const headlineEn =
    todayMissing.length > 0
      ? `There are ${todayMissing.length} quantitative shortfalls for today's meals.`
      : verifiedShortfalls.length > 0
      ? `There are ${verifiedShortfalls.length} quantitative shortfalls for planned recipes.`
      : expiryReviewRequirements.length > 0
      ? `${expiryReviewRequirements.length} ingredient(s) need expiry review.`
      : unverifiedRequirements.length > 0
      ? `${unverifiedRequirements.length} quantities cannot be verified with the current units.`
      : depletedPantryItems.length > 0
      ? `You have ${depletedPantryItems.length} depleted pantry items.`
      : pendingShoppingItems.length > 0
      ? `You have ${pendingShoppingItems.length} items on your shopping list.`
      : "Your pantry covers scheduled meals and no shopping is pending.";

  const headlineBg =
    todayMissing.length > 0
      ? `Има ${todayMissing.length} количествени недостига за днешните ястия.`
      : verifiedShortfalls.length > 0
      ? `Има ${verifiedShortfalls.length} количествени недостига за планираните рецепти.`
      : expiryReviewRequirements.length > 0
      ? `${expiryReviewRequirements.length} съставка(и) изискват преглед на срока.`
      : unverifiedRequirements.length > 0
      ? `${unverifiedRequirements.length} количества не могат да бъдат проверени с текущите мерни единици.`
      : depletedPantryItems.length > 0
      ? `Имате ${depletedPantryItems.length} изчерпани продукта в килера.`
      : pendingShoppingItems.length > 0
      ? `Имате ${pendingShoppingItems.length} продукта в списъка за пазаруване.`
      : "Килерът ви покрива менютата и нямате чакащи покупки.";

  const tripItems = [
    ...pendingShoppingItems,
    ...Array.from(candidateItemsToAdd.values()),
  ];
  const hasUnknownTripPrice = tripItems.some(
    (item) =>
      typeof item.estimatedPriceEUR !== "number" ||
      !Number.isFinite(item.estimatedPriceEUR) ||
      item.estimatedPriceEUR <= 0
  );
  const estimatedTotalTripEUR = hasUnknownTripPrice
    ? undefined
    : Number(
        tripItems
          .reduce((acc, item) => acc + (item.estimatedPriceEUR as number), 0)
          .toFixed(2)
      );

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
          : [
              "Todo tu menú de los próximos días tiene cantidades suficientes en despensa.",
            ],
      en:
        reasonsEn.length > 0
          ? reasonsEn
          : [
              "All meals for the next days have sufficient quantities in pantry.",
            ],
      bg:
        reasonsBg.length > 0
          ? reasonsBg
          : [
              "Всички ястия за следващите дни имат достатъчни количества в килера.",
            ],
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
