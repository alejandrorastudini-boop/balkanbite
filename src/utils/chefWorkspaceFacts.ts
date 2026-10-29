import type { Language, MealPlanDay, PantryItem, ShoppingItem } from "../types";
import type { ProgressionEventV1 } from "./progressionLedger";
import { isValidProgressionEvent, summarizeProgressionActivity } from "./progressionLedger";
import { isStoredMealPlanDayStructurallyValid } from "./storedMealPlanValidation";
import { isStoredShoppingItemStructurallyValid } from "./storedShoppingValidation";
import { evaluateShoppingNeeds } from "./shoppingAdvisor";
import { localCalendarDate } from "./effectiveExpiry";

export type ChefWorkspaceQueryAction = "SHOW_MENU" | "SHOW_TODAYS_MENU" | "SHOW_SHORTAGES" | "SHOW_TODAYS_SHORTAGES" | "SHOW_SHOPPING_LIST" | "SHOW_PROGRESS";
export interface ChefWorkspaceSnapshot {
  pantry: readonly PantryItem[];
  mealPlan: readonly MealPlanDay[];
  shopping: readonly ShoppingItem[];
  progression: readonly ProgressionEventV1[];
}
const phrases: Record<ChefWorkspaceQueryAction, readonly string[]> = {
  SHOW_MENU: [
    "que tengo en el menu semanal", "que comidas tengo planeadas", "que hay en mi menu",
    "what is on my meal plan", "what meals are planned", "what is on the weekly menu",
    "какво има в седмичното меню", "какви ястия са планирани",
  ],
  SHOW_TODAYS_MENU: [
    "que comidas tengo planeadas para hoy", "que tengo planificado comer hoy",
    "que hay en el menu de hoy", "que tengo en el menu para hoy",
    "what meals are planned for today", "what is on today's meal plan",
    "what is on the menu today",
    "какви ястия са планирани за днес", "какво има в менюто за днес",
  ],
  SHOW_SHORTAGES: [
    "que me falta para el menu", "que ingredientes faltan para el menu",
    "que alimentos me faltan para cocinar", "que falta para las comidas",
    "what ingredients am i missing for my meals", "what is missing for my meal plan",
    "what groceries am i missing for the menu",
    "какво липсва за менюто", "какви продукти липсват за менюто",
  ],
  SHOW_TODAYS_SHORTAGES: [
    "que me falta para cocinar hoy", "que ingredientes faltan para hoy",
    "que necesito para cocinar lo de hoy", "que me falta para el menu de hoy",
    "what ingredients are missing for today's meals", "what is missing to cook today",
    "what am i missing for today's menu",
    "какво ми липсва за готвене днес", "какви продукти липсват за днешното меню",
  ],
  SHOW_SHOPPING_LIST: [
    "que tengo en la lista de la compra", "que hay en mi lista de compra",
    "que falta comprar de mi lista", "que tengo que comprar segun mi lista",
    "what is on my shopping list", "what do i need to buy from my list",
    "what is on the grocery list",
    "какво има в списъка за пазаруване", "какво имам в списъка за покупки",
  ],
  SHOW_PROGRESS: [
    "cual es mi progreso", "que progreso llevo", "cuantas compras y cocinados he confirmado",
    "what is my progress", "how many purchases and cooks have i confirmed",
    "какъв е напредъкът ми", "колко покупки и готвения имам",
  ],
};
const normalize = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[¿?¡!.,:;]+/g, " ").trim().replace(/\s+/g, " ");

export function parseChefWorkspaceQueryIntent(value: unknown): ChefWorkspaceQueryAction | null {
  if (typeof value !== "string" || value.length > 180) return null;
  const text = normalize(value);
  if (!text) return null;
  for (const [action, accepted] of Object.entries(phrases) as
    [ChefWorkspaceQueryAction, readonly string[]][]) {
    if (accepted.some(phrase => normalize(phrase) === text)) return action;
  }
  return null;
}

const msg = (lang: Language, es: string, en: string, bg: string): string =>
  lang === "es" ? es : lang === "bg" ? bg : en;
const dateOrdinal = (key: string): number => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};
const mealName = (day: MealPlanDay, lang: Language) =>
  (["breakfast", "lunch", "dinner"] as const)
    .flatMap(slot => day[slot] ? [day[slot]!.title[lang] || day[slot]!.title.en] : []);
const listPreview = (values: string[]): string => {
  const shown = values.slice(0, 6).join("; ");
  const extra = values.length - 6;
  return shown + (extra > 0 ? `; +${extra}` : "");
};

function validSnapshot(snapshot: ChefWorkspaceSnapshot): boolean {
  if (!snapshot || !Array.isArray(snapshot.pantry) ||
      !Array.isArray(snapshot.mealPlan) || !Array.isArray(snapshot.shopping) ||
      !Array.isArray(snapshot.progression)) return false;

  // A validated caller must also attest storage/cache freshness and scope.
  const ids = new Set<string>();
  if (!snapshot.pantry.every(row => row && typeof row.id === "string" && !!row.id &&
      typeof row.name === "string" && !!row.name.trim() &&
      typeof row.unit === "string" && !!row.unit.trim() &&
      Number.isFinite(row.quantity) && row.quantity > 0 &&
      !ids.has(row.id) && !!ids.add(row.id))) return false;
  const planDates = new Set<string>();
  if (!snapshot.mealPlan.every(day =>
    isStoredMealPlanDayStructurallyValid(day) &&
    !planDates.has(day.date) && !!planDates.add(day.date))) return false;
  const shoppingIds = new Set<string>();
  if (!snapshot.shopping.every(row =>
    isStoredShoppingItemStructurallyValid(row) &&
    !shoppingIds.has(row.id) && !!shoppingIds.add(row.id))) return false;
  const eventIds = new Set<string>();
  if (!snapshot.progression.every(event =>
    isValidProgressionEvent(event) &&
    !eventIds.has(event.eventId) && !!eventIds.add(event.eventId))) return false;
  return true;
}

/** Independent read from a fully evidenced shopping-list source. Other
 * modules (especially optional progression history) are not needed here. */
export function describeVerifiedChefShoppingList(
  shopping: readonly ShoppingItem[],
  lang: Language,
): string | null {
  if (!Array.isArray(shopping)) return null;
  const ids = new Set<string>();
  for (const item of shopping) {
    if (!isStoredShoppingItemStructurallyValid(item) ||
        ids.has(item.id)) return null;
    ids.add(item.id);
  }
    const pending = shopping.filter(row => !row.checked);
    const marked = shopping.length - pending.length;
    // Only names and checkbox state are reported here. Registered quantities
    // can be estimated, unit-incompatible or not yet purchase-confirmed;
    // 'checked' alone never proves a purchase or pantry application.
    if (!pending.length) return msg(lang,
      `No hay productos pendientes en la lista de compra registrada. Hay ${marked} elementos marcados. Una marca no confirma una compra; esto tampoco demuestra que no falten alimentos.`,
      `There are no pending products on your recorded shopping list. ${marked} items are checked. A check mark does not confirm a purchase or prove you have everything.`,
      `Няма чакащи продукти в записания списък за пазаруване. ${marked} продукта са отметнати. Отметката не доказва покупка или че всичко е налично.`);
    const names = listPreview(pending.map(row => row.name));
    return msg(lang,
      `Tu lista de compra registra ${pending.length} productos pendientes: ${names}. ${marked} marcados. Este resumen no verifica cantidades, precios ni compras realizadas.`,
      `Your recorded shopping list has ${pending.length} pending products: ${names}. ${marked} checked. This summary does not verify quantities, prices or completed purchases.`,
      `В записания списък има ${pending.length} чакащи продукта: ${names}. ${marked} отметнати. Това резюме не потвърждава количества, цени или извършени покупки.`);
}

/** Read-only answers from a validated workspace snapshot. The App-level
 * callback independently gates complete guest persistence or authenticated
 * Firestore server authority for every module and the current session.
 */
export function describeChefWorkspaceQuery(
  action: ChefWorkspaceQueryAction,
  snapshot: ChefWorkspaceSnapshot,
  lang: Language,
  now: Date = new Date(),
): string | null {
  if (!validSnapshot(snapshot) || !Number.isFinite(now.getTime())) return null;
  const today = localCalendarDate(now);
  if (!today) return null;
  const todayOrdinal = dateOrdinal(today);
  if (action === "SHOW_PROGRESS") {
    const p = summarizeProgressionActivity(snapshot.progression);
    return msg(lang,
      `En el historial registrado hay ${p.totalVerifiedEvents} eventos verificados: ${p.confirmedPurchaseEvents} compras aplicadas y ${p.successfulCookEvents} cocinados con descuento de despensa. No es una puntuación nutricional ni un historial completo de hábitos.`,
      `Your recorded history contains ${p.totalVerifiedEvents} verified events: ${p.confirmedPurchaseEvents} applied purchases and ${p.successfulCookEvents} pantry-deducting cooks. This is not a nutrition score or a complete habits history.`,
      `В записаната история има ${p.totalVerifiedEvents} потвърдени събития: ${p.confirmedPurchaseEvents} приложени покупки и ${p.successfulCookEvents} готвения с приспадане от наличностите. Това не е хранителна оценка или пълна история на навиците.`,
    );
  }

  if (action === "SHOW_SHOPPING_LIST") {
    return describeVerifiedChefShoppingList(snapshot.shopping, lang);
  }

  if (action === "SHOW_TODAYS_MENU") {
    const todayPlan = snapshot.mealPlan.find(day => day.date === today);
    const slotLabels = {
      es: { breakfast: "desayuno", lunch: "comida", dinner: "cena" },
      en: { breakfast: "breakfast", lunch: "lunch", dinner: "dinner" },
      bg: { breakfast: "закуска", lunch: "обяд", dinner: "вечеря" },
    }[lang];
    const meals = (["breakfast", "lunch", "dinner"] as const)
      .flatMap(slot => todayPlan?.[slot]
        ? [`${slotLabels[slot]}: ${todayPlan[slot]!.title[lang] || todayPlan[slot]!.title.en}`]
        : []);
    if (meals.length === 0) return msg(lang,
      `No hay comidas registradas en el menú de hoy (${today}). Esto no demuestra que no tengas previsto cocinar ni que hayas dejado de comer.`,
      `No meals are recorded on today's plan (${today}). This does not mean you have no intention to cook or that you have not eaten.`,
      `Няма записани ястия в менюто за днес (${today}). Това не означава, че не планирате да готвите или че не сте яли.`);
    return msg(lang,
      `Para hoy (${today}) tienes ${meals.length} comidas planificadas: ${meals.join("; ")}. Es un plan, no consumo confirmado.`,
      `For today (${today}), ${meals.length} meals are planned: ${meals.join("; ")}. This is a plan, not confirmed consumption.`,
      `За днес (${today}) има ${meals.length} планирани ястия: ${meals.join("; ")}. Това е план, а не потвърдена консумация.`);
  }

  if (action === "SHOW_MENU") {
    const upcoming = snapshot.mealPlan
      .filter(day => { const diff = dateOrdinal(day.date) - todayOrdinal; return diff >= 0 && diff <= 6; })
      .sort((a, b) => a.date.localeCompare(b.date))
      .flatMap(day => mealName(day, lang).map(name => `${day.date}: ${name}`));
    if (!upcoming.length) return msg(lang,
      "No hay comidas registradas para los próximos siete días. Eso no demuestra que no tengas pensado cocinar.",
      "No meals are recorded for the next seven days. This does not mean you have no plans to cook.",
      "Няма записани ястия за следващите седем дни. Това не означава, че не планирате да готвите.");
    return msg(lang,
      `Comidas registradas para los próximos siete días (${upcoming.length}): ${listPreview(upcoming)}. Son planes, no consumos confirmados.`,
      `Recorded meals for the next seven days (${upcoming.length}): ${listPreview(upcoming)}. These are plans, not confirmed consumption.`,
      `Записани ястия за следващите седем дни (${upcoming.length}): ${listPreview(upcoming)}. Това са планове, а не потвърдена консумация.`);
  }

  if (action !== "SHOW_SHORTAGES" && action !== "SHOW_TODAYS_SHORTAGES") return null;
  const todayOnly = action === "SHOW_TODAYS_SHORTAGES";
  const applicablePlan = todayOnly
    ? snapshot.mealPlan.filter(day => day.date === today)
    : snapshot.mealPlan;
  if (todayOnly && !applicablePlan.some(day =>
    Boolean(day.breakfast || day.lunch || day.dinner))) {
    return msg(lang,
      `No hay comidas registradas para hoy (${today}) con las que calcular faltantes. Eso no significa que no vayas a cocinar ni que tengas todos los ingredientes.`,
      `There are no meals recorded for today (${today}) to calculate ingredient shortages. This does not mean you have no plans to cook or that all ingredients are available.`,
      `Няма записани ястия за днес (${today}), за които да се изчислят липсващи продукти. Това не означава, че няма да готвите или че имате всички продукти.`);
  }
  const diagnostic = evaluateShoppingNeeds(
    [...snapshot.pantry], [...applicablePlan], [...snapshot.shopping], lang, now,
  );
  // This deterministic advisor covers meals scheduled today or within 2 days.
  // Unverified units/expiry are not promoted to verified quantitative shortages.
  const deficits = diagnostic.missingMealIngredients.filter(row =>
    row.availabilityStatus === "missing" || row.availabilityStatus === "insufficient");
  const uncertain = diagnostic.missingMealIngredients.length - deficits.length;
  if (!deficits.length) return todayOnly ? msg(lang,
    `No se han calculado faltantes cuantitativos para las comidas registradas de hoy (${today}). ${uncertain} requisitos necesitan revisión (unidades o caducidad); no se garantiza que tengas todo.`,
    `No quantitative shortages were calculated for today's recorded meals (${today}). ${uncertain} requirements need review (units or expiry); this does not guarantee everything is available.`,
    `Няма изчислени количествени недостици за днешните записани ястия (${today}). ${uncertain} изисквания се нуждаят от проверка (мерни единици или срок); това не гарантира наличност.`)
    : msg(lang,
    `No hay faltantes cuantitativos verificados para las comidas registradas de hoy a dos días vista. Hay ${uncertain} requisitos sin verificar; esto no confirma que tengas todo.`,
    `No verified quantitative shortages were found for recorded meals from today through the next two days. ${uncertain} requirements need review; this does not confirm you have everything.`,
    `Няма потвърдени количествени недостици за записаните ястия от днес до следващите два дни. ${uncertain} изисквания остават за проверка; това не доказва, че имате всичко.`);
  const summary = listPreview(deficits.map(row =>
    `${row.ingredientName} (${String(row.amount)} ${row.unit}, ${row.date})`));
  if (todayOnly) return msg(lang,
    `Faltantes calculados para las comidas registradas de hoy (${today}; ${deficits.length}): ${summary}. ${uncertain} requisitos necesitan revisión (unidades o caducidad). No son compras realizadas, precios confirmados ni garantía de seguridad alimentaria.`,
    `Calculated shortages for today's recorded meals (${today}; ${deficits.length}): ${summary}. ${uncertain} requirements need review (units or expiry). These are not completed purchases, verified prices or a food-safety guarantee.`,
    `Изчислени недостици за записаните ястия днес (${today}; ${deficits.length}): ${summary}. ${uncertain} изисквания се нуждаят от проверка (мерни единици или срок). Това не са потвърдени покупки, цени или гаранция за безопасност.`);
  return msg(lang,
    `Faltantes calculados para comidas registradas de hoy a dos días vista (${deficits.length}): ${summary}. ${uncertain} requisitos necesitan revisión. Son cálculos de disponibilidad, no compras realizadas ni precios confirmados.`,
    `Calculated shortages for recorded meals from today through the next two days (${deficits.length}): ${summary}. ${uncertain} requirements need review. These are availability calculations, not purchased items or verified prices.`,
    `Изчислени недостици за записаните ястия от днес до следващите два дни (${deficits.length}): ${summary}. ${uncertain} изисквания остават за проверка. Това са изчисления, не потвърдени покупки или цени.`);
}

/**
 * Menu-only questions depend solely on the confirmed meal-plan collection.
 * Empty companion arrays are deliberately not claimed as facts: menu display
 * never reads pantry, shopping or progression. Reuse the exact existing menu
 * wording and complete structural/duplicate validation.
 */
export function describeVerifiedChefMealPlan(
  action: "SHOW_MENU" | "SHOW_TODAYS_MENU",
  mealPlan: readonly MealPlanDay[],
  lang: Language,
  now: Date = new Date(),
): string | null {
  if ((action !== "SHOW_MENU" && action !== "SHOW_TODAYS_MENU") ||
      !Array.isArray(mealPlan)) return null;
  return describeChefWorkspaceQuery(
    action, { pantry: [], mealPlan, shopping: [], progression: [] }, lang, now,
  );
}

/** Progress-only facts depend on valid, unique event evidence, not other modules. */
export function describeVerifiedChefProgress(
  progression: readonly ProgressionEventV1[],
  lang: Language,
): string | null {
  if (!Array.isArray(progression)) return null;
  const ids = new Set<string>();
  for (const event of progression) {
    if (!isValidProgressionEvent(event) || ids.has(event.eventId)) return null;
    ids.add(event.eventId);
  }
  // Reuse the existing localized read contract without making absent
  // pantry/menu/shopping facts: SHOW_PROGRESS reads only progression.
  return describeChefWorkspaceQuery("SHOW_PROGRESS", {
    pantry: [], mealPlan: [], shopping: [], progression,
  }, lang);
}

/** Only pantry and meal plan are inputs for recorded-meal ingredient
 * availability. The shopping advisor additionally uses shopping for
 * recommendations/urgency, but its missingMealIngredients results never
 * consume shopping rows; this answer asserts neither purchased nor pending
 * shopping items. Unrelated event history is not an input either.
 *
 * Callers must independently attest complete, session-scoped and fresh
 * pantry AND meal-plan snapshots. This function validates both sets and
 * reuses the existing deterministic shortage calculation.
 */
export interface ChefVerifiedShortageSources {
  pantry: readonly PantryItem[];
  mealPlan: readonly MealPlanDay[];
}
export function describeVerifiedChefShortages(
  action: "SHOW_SHORTAGES" | "SHOW_TODAYS_SHORTAGES",
  sources: ChefVerifiedShortageSources,
  lang: Language,
  now: Date = new Date(),
): string | null {
  if ((action !== "SHOW_SHORTAGES" && action !== "SHOW_TODAYS_SHORTAGES") ||
      !sources || !Array.isArray(sources.pantry) ||
      !Array.isArray(sources.mealPlan)) return null;
  return describeChefWorkspaceQuery(action, {
    pantry: sources.pantry, mealPlan: sources.mealPlan,
    // These fields are not used to calculate recorded-meal shortages.
    // They are intentionally NOT assertions that shopping/history are empty.
    shopping: [], progression: [],
  }, lang, now);
}
