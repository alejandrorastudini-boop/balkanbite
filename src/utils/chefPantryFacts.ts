import type { Language, PantryItem } from "../types";
import { derivePantryItemExpiry } from "./effectiveExpiry";

/**
 * A closed list of read-only domain questions; no LLM is allowed to fabricate
 * inventory facts, and a compound instruction cannot be treated as a query.
 */
export type ChefPantryQueryAction = "SHOW_PANTRY_ITEMS" | "SHOW_EXPIRING";
export interface ChefPantryQueryIntent {
  actionId: ChefPantryQueryAction;
}

function normalized(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[¿?¡!.,:;]+/g, " ")
    .replace(/\s+/g, " ").trim();
}

const questions: Record<ChefPantryQueryAction, readonly string[]> = {
  SHOW_PANTRY_ITEMS: [
    "que tengo en la despensa", "que tengo en casa",
    "que alimentos tengo", "que hay en mi despensa",
    "que tengo disponible para cocinar",
    "what do i have in my pantry", "what do i have",
    "what is in my pantry", "what's in my pantry",
    "what food do i have", "what ingredients do i have",
    "какво имам в килера", "какви продукти имам",
    "какво има в килера",
  ],
  SHOW_EXPIRING: [
    "que va a caducar", "que esta por caducar",
    "que alimentos caducan pronto", "que caduca pronto",
    "que productos van a caducar",
    "what expires soon", "what is expiring soon",
    "what food expires soon", "what has expired",
    "кое изтича скоро", "кои продукти изтичат скоро",
    "кои храни изтичат скоро",
  ],
};

export function parseChefPantryQueryIntent(value: unknown): ChefPantryQueryIntent | null {
  if (typeof value !== "string" || value.length > 180) return null;
  const input = normalized(value);
  if (!input) return null;
  for (const [actionId, phrases] of Object.entries(questions) as
    [ChefPantryQueryAction, readonly string[]][]) {
    if (phrases.some(phrase => normalized(phrase) === input))
      return { actionId };
  }
  return null;
}

const locales: Record<Language, string> = { en: "en-US", es: "es-ES", bg: "bg-BG" };
function amount(item: PantryItem, language: Language): string {
  const value = new Intl.NumberFormat(locales[language], {
    useGrouping: false, maximumFractionDigits: 15,
  }).format(item.quantity);
  return `${item.name} (${value} ${item.unit})`;
}

function isCompletePantry(items: readonly PantryItem[]): boolean {
  const ids = new Set<string>();
  return items.every(item => {
    if (!item || typeof item.id !== "string" || !item.id ||
        ids.has(item.id) || typeof item.name !== "string" ||
        !item.name.trim() || typeof item.unit !== "string" ||
        !item.unit.trim() || typeof item.quantity !== "number" ||
        !Number.isFinite(item.quantity) || item.quantity <= 0) return false;
    ids.add(item.id);
    return true;
  });
}

/**
 * Returns null if the supplied snapshot is invalid. Callers must separately
 * prove it is authoritative and fresh (including journal/session gates).
 * The text lists only explicitly recorded quantities; it never sums unlike units.
 */
export function describeChefPantryQuery(
  action: ChefPantryQueryAction,
  items: readonly PantryItem[],
  language: Language,
  now: Date = new Date(),
): string | null {
  if (!isCompletePantry(items) || !Number.isFinite(now.getTime())) return null;

  if (action === "SHOW_PANTRY_ITEMS") {
    if (items.length === 0) return {
      es: "No hay productos registrados en tu despensa. Eso no significa que no tengas alimentos en casa.",
      en: "No products are recorded in your pantry. This does not mean you have no food at home.",
      bg: "Няма записани продукти в килера. Това не означава, че нямате храна у дома.",
    }[language];
    const shown = items.slice(0, 6).map(item => amount(item, language)).join("; ");
    const extra = items.length - 6;
    const suffix = extra <= 0 ? "" : language === "es"
      ? `; y ${extra} productos registrados más`
      : language === "bg" ? `; и още ${extra} записани продукта`
      : `; and ${extra} more recorded products`;
    return language === "es" ? `En tu despensa hay ${items.length} productos registrados: ${shown}${suffix}.`
      : language === "bg" ? `В килера са записани ${items.length} продукта: ${shown}${suffix}.`
      : `Your pantry has ${items.length} recorded products: ${shown}${suffix}.`;
  }

  if (action !== "SHOW_EXPIRING") return null;

  const expiring: { item: PantryItem; days: number; expired: boolean }[] = [];
  let unknown = 0;
  for (const item of items) {
    const state = derivePantryItemExpiry(item, now);
    if (state.status === "unknown") {
      unknown += 1;
    } else if (state.expired || state.daysRemaining <= 3) {
      expiring.push({ item, days: state.daysRemaining, expired: state.expired });
    }
  }
  expiring.sort((a, b) => Number(b.expired) - Number(a.expired) ||
    a.days - b.days || a.item.name.localeCompare(b.item.name));
  const shown = expiring.slice(0, 6).map(({ item, expired, days }) => {
    const label = expired
      ? { es: "fecha registrada pasada", en: "recorded date passed", bg: "записаната дата е минала" }[language]
      : days === 0
      ? { es: "fecha registrada hoy", en: "recorded date today", bg: "записаната дата е днес" }[language]
      : { es: `en ${days} días`, en: `in ${days} days`, bg: `след ${days} дни` }[language];
    return `${item.name} (${label})`;
  }).join("; ");
  const extra = expiring.length - 6;
  const unknownText = language === "es"
    ? `${unknown} productos sin caducidad fiable`
    : language === "bg" ? `${unknown} продукта без надеждна дата на годност`
    : `${unknown} products without reliable expiry data`;
  const countText = expiring.length === 0
    ? {
      es: "No hay caducidades próximas confirmadas en los datos registrados",
      en: "No upcoming expiry dates are confirmed in the recorded data",
      bg: "Няма потвърдени близки срокове на годност в записаните данни",
    }[language]
    : language === "es"
    ? `Hay ${expiring.length} productos con fecha registrada vencida o en los próximos 3 días: ${shown}${extra ? `; y ${extra} más` : ""}`
    : language === "bg"
    ? `Има ${expiring.length} продукта със записана изтекла дата или в следващите 3 дни: ${shown}${extra ? `; и още ${extra}` : ""}`
    : `${expiring.length} products have a recorded date in the past or within 3 days: ${shown}${extra ? `; and ${extra} more` : ""}`;
  return `${countText}. ${unknownText}. ${language === "es"
    ? "Comprueba las fechas reales en los envases: la información registrada no garantiza seguridad alimentaria."
    : language === "bg"
    ? "Проверете действителните срокове върху опаковките: записите не гарантират безопасност на храните."
    : "Check the actual dates on packaging: recorded data does not guarantee food safety."}`;
}
