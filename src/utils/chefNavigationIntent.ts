import type { Language } from "../types";

/**
 * Small, explicit, read-only navigation contract. Do not infer a mutation or
 * silently interpret a multi-action instruction as navigation.
 * Other requests must continue through the existing reviewed Chef IA flow.
 */
export type ChefNavigationTab = "pantry" | "shopping" | "mealPlan" | "recipes" | "home" | "profile";
export interface ChefNavigationAction {
  actionId: "NAVIGATE_TAB";
  tab: ChefNavigationTab;
}

const targets: Record<ChefNavigationTab, readonly string[]> = {
  pantry: [
    "la despensa", "mi despensa", "despensa", "lo que tengo",
    "my pantry", "the pantry", "pantry", "what i have",
    "килера", "моя килер", "наличните продукти",
  ],
  shopping: [
    "la lista de la compra", "mi lista de la compra", "lista de compra",
    "la lista de compras", "compras", "my shopping list",
    "the shopping list", "shopping list", "grocery list",
    "списъка за пазаруване", "списък за пазаруване",
  ],
  mealPlan: [
    "el menu semanal", "mi menu semanal", "el menu de la semana",
    "mi menu", "el plan de comidas", "meal plan", "my meal plan",
    "weekly menu", "the weekly menu", "седмичното меню", "менюто",
  ],
  recipes: [
    "las recetas", "mis recetas", "recetas", "recipes",
    "my recipes", "the recipes", "рецептите", "рецепти",
  ],
  home: [
    "inicio", "la pagina de inicio", "home", "the home screen",
    "начало", "началния екран",
  ],
  profile: [
    "mi perfil", "el perfil", "my profile", "profile",
    "профила", "моят профил",
  ],
};

const verbs = [
  "abre", "abrir", "muestrame", "ensename", "quiero ver",
  "llevame a", "ve a", "ir a", "mostrar", "ver",
  "open", "show me", "take me to", "go to", "view",
  "покажи ми", "отвори", "отиди на", "искам да видя",
];

const normalize = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[¿?¡!.,:;]+/g, " ").trim().replace(/\s+/g, " ");

export function parseChefNavigationIntent(transcript: unknown): ChefNavigationAction | null {
  if (typeof transcript !== "string" || transcript.length > 200) return null;
  const text = normalize(transcript);
  if (!text || text.length > 140) return null;
  // No free-form question answering, recipes, inventory analysis or side effects.
  const directPantry = ["que tengo en casa", "que tengo en la despensa", "what do i have",
    "какво имам в килера"];
  if (directPantry.includes(text))
    return { actionId: "NAVIGATE_TAB", tab: "pantry" };
  for (const verb of verbs) {
    if (!text.startsWith(verb + " ")) continue;
    const object = text.slice(verb.length + 1);
    for (const [tab, variants] of Object.entries(targets) as [ChefNavigationTab, readonly string[]][]) {
      if (variants.includes(object))
        return { actionId: "NAVIGATE_TAB", tab };
    }
  }
  return null;
}

export function chefNavigationFeedback(tab: ChefNavigationTab, language: Language): string {
  const labels: Record<ChefNavigationTab, Record<Language, string>> = {
    pantry: { es: "la despensa", en: "your pantry", bg: "килера" },
    shopping: { es: "la lista de compra", en: "your shopping list", bg: "списъка за пазаруване" },
    mealPlan: { es: "el menú", en: "your meal plan", bg: "менюто" },
    recipes: { es: "las recetas", en: "recipes", bg: "рецептите" },
    home: { es: "el inicio", en: "the home screen", bg: "началния екран" },
    profile: { es: "el perfil", en: "your profile", bg: "профила" },
  };
  return language === "es" ? `Abriendo ${labels[tab].es}.` :
    language === "bg" ? `Отварям ${labels[tab].bg}.` :
    `Opening ${labels[tab].en}.`;
}
