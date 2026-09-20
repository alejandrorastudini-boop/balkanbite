export type LegacyFoodSafetyQuarantineReason =
  | "legacy_allergy_or_intolerance"
  | "legacy_gluten_free_diet"
  | "legacy_keto_diet";

export interface FoodSafetyQuarantine {
  status: "clear" | "review_required";
  reasons: LegacyFoodSafetyQuarantineReason[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasNonEmptyStringArray(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.some((entry) => typeof entry === "string" && entry.trim().length > 0)
  );
}

/**
 * Phase-B quarantine for legacy food-restriction fields.
 *
 * These old values are retained so users can inspect/delete them, but they are
 * not a verified allergen-safety model and must not be treated as one.
 */
export function getFoodSafetyQuarantine(value: unknown): FoodSafetyQuarantine {
  if (!isRecord(value)) {
    return { status: "clear", reasons: [] };
  }

  const reasons: LegacyFoodSafetyQuarantineReason[] = [];

  if (hasNonEmptyStringArray(value.allergies)) {
    reasons.push("legacy_allergy_or_intolerance");
  }
  if (value.dietStyle === "gluten_free") {
    reasons.push("legacy_gluten_free_diet");
  }
  if (value.dietStyle === "keto") {
    reasons.push("legacy_keto_diet");
  }

  return {
    status: reasons.length > 0 ? "review_required" : "clear",
    reasons,
  };
}

export function isFoodSafetyReviewRequired(value: unknown): boolean {
  if (
    isRecord(value) &&
    value.status === "review_required" &&
    Array.isArray(value.reasons)
  ) {
    return true;
  }

  return getFoodSafetyQuarantine(value).status === "review_required";
}

export function getFoodSafetyQuarantineMessage(
  language: "en" | "es" | "bg",
): string {
  if (language === "bg") {
    return "Преди BalkanBite да препоръчва AI рецепти, менюта или покупки, прегледайте старите данни за хранителни ограничения в Профил. Тези стари полета не са проверена система за безопасност при алергени. Ръчните функции за килера и списъка за пазаруване остават достъпни.";
  }
  if (language === "es") {
    return "Antes de que BalkanBite recomiende recetas, menús o compras con IA, revisa en Perfil tus datos antiguos de restricciones alimentarias. Esos campos legacy no son un sistema verificado de seguridad frente a alérgenos. Las funciones manuales de despensa y lista de compra siguen disponibles.";
  }
  return "Before BalkanBite recommends AI recipes, menus, or shopping, review your legacy food-restriction data in Profile. Those legacy fields are not a verified allergen-safety system. Manual pantry and shopping-list functions remain available.";
}
