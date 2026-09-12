import { Recipe } from "../types";

export const DEFAULT_RECIPE_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80";

export const CURATED_DISH_IMAGES = {
  tarator: "/images/tarator_cold_soup_1789201044887.jpg",
  mishmash: "/images/mishmash_egg_skillet_1789201058875.jpg",
  beanStew: "/images/bean_stew_chorba_1789201071875.jpg",
  shopskaSalad: "/images/shopska_salad_balkan_style_1789192343976.jpg",
  musaka: "/images/musaka_balkan_style_1789192368570.jpg",
  lentilStew: "/images/lentil_soup_balkan_style_1789192381584.jpg",
  banitsa: "/images/banitsa_pastry_balkan_style_1789192356824.jpg",
  pasta: "https://images.unsplash.com/photo-1621996346565-e3d5d6281699?auto=format&fit=crop&w=800&q=80",
  rice: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80",
  chicken: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80",
  fish: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80",
  meatballs: "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=800&q=80",
  vegetables: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
  soup: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80",
  sandwich: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=80",
  eggs: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80",
};

/**
 * Normalizes an image URL so that local `/src/assets/images/` paths
 * are mapped to `/images/` which are served directly from public/.
 */
export function normalizeRecipeImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("/src/assets/images/")) {
    return url.replace("/src/assets/images/", "/images/");
  }
  return url;
}

/**
 * Determines the best culinary image for a recipe based on its
 * titles, ingredients, and tags.
 */
export function getRecipeImageUrl(recipe?: Partial<Recipe> | null): string {
  if (!recipe) return DEFAULT_RECIPE_FALLBACK_IMAGE;

  // If already has an image, normalize and return it
  if (recipe.imageUrl && typeof recipe.imageUrl === "string" && recipe.imageUrl.trim().length > 0) {
    return normalizeRecipeImageUrl(recipe.imageUrl);
  }

  const enTitle = (recipe.title?.en || "").toLowerCase();
  const bgTitle = (recipe.title?.bg || "").toLowerCase();
  const esTitle = (recipe.title?.es || "").toLowerCase();
  const allTitles = `${enTitle} ${bgTitle} ${esTitle}`;

  const tags = (recipe.tags || []).join(" ").toLowerCase();
  const ingredientNames = (recipe.ingredients || []).map((i) => i.name.toLowerCase()).join(" ");
  const textBlob = `${allTitles} ${tags} ${ingredientNames}`;

  // 1. Specific iconic Balkan dishes
  if (textBlob.includes("tarator") || textBlob.includes("таратор") || (textBlob.includes("yogur") && textBlob.includes("pepino"))) {
    return CURATED_DISH_IMAGES.tarator;
  }

  if (textBlob.includes("mish-mash") || textBlob.includes("mishmash") || textBlob.includes("миш-маш") || (textBlob.includes("revuelto") && textBlob.includes("pimiento"))) {
    return CURATED_DISH_IMAGES.mishmash;
  }

  if (textBlob.includes("bob") || textBlob.includes("боб") || textBlob.includes("bean") || textBlob.includes("alubia") || textBlob.includes("fabada")) {
    return CURATED_DISH_IMAGES.beanStew;
  }

  if (textBlob.includes("lentil") || textBlob.includes("леща") || textBlob.includes("lenteja")) {
    return CURATED_DISH_IMAGES.lentilStew;
  }

  if (textBlob.includes("shopska") || textBlob.includes("шопска") || textBlob.includes("salad") || textBlob.includes("салата") || textBlob.includes("ensalada")) {
    return CURATED_DISH_IMAGES.shopskaSalad;
  }

  if (textBlob.includes("musaka") || textBlob.includes("мусака") || textBlob.includes("moussaka")) {
    return CURATED_DISH_IMAGES.musaka;
  }

  if (textBlob.includes("banitsa") || textBlob.includes("баница") || textBlob.includes("pie") || textBlob.includes("hojaldre")) {
    return CURATED_DISH_IMAGES.banitsa;
  }

  // 2. Ingredients / culinary categories
  if (textBlob.includes("pasta") || textBlob.includes("macarron") || textBlob.includes("макарони") || textBlob.includes("spaghetti") || textBlob.includes("noodle")) {
    return CURATED_DISH_IMAGES.pasta;
  }

  if (textBlob.includes("rice") || textBlob.includes("ориз") || textBlob.includes("arroz") || textBlob.includes("risotto")) {
    return CURATED_DISH_IMAGES.rice;
  }

  if (textBlob.includes("egg") || textBlob.includes("яйц") || textBlob.includes("huevo") || textBlob.includes("omelet") || textBlob.includes("tortilla")) {
    return CURATED_DISH_IMAGES.eggs;
  }

  if (textBlob.includes("chicken") || textBlob.includes("пиле") || textBlob.includes("pollo") || textBlob.includes("turkey") || textBlob.includes("pavo")) {
    return CURATED_DISH_IMAGES.chicken;
  }

  if (textBlob.includes("fish") || textBlob.includes("риба") || textBlob.includes("pescado") || textBlob.includes("salmon") || textBlob.includes("tuna") || textBlob.includes("atún")) {
    return CURATED_DISH_IMAGES.fish;
  }

  if (textBlob.includes("meatball") || textBlob.includes("кюфте") || textBlob.includes("albondiga") || textBlob.includes("beef") || textBlob.includes("pork") || textBlob.includes("cerdo")) {
    return CURATED_DISH_IMAGES.meatballs;
  }

  if (textBlob.includes("soup") || textBlob.includes("супа") || textBlob.includes("sopa") || textBlob.includes("crema") || textBlob.includes("caldo")) {
    return CURATED_DISH_IMAGES.soup;
  }

  if (textBlob.includes("sandwich") || textBlob.includes("сандвич") || textBlob.includes("bocadillo") || textBlob.includes("tostada") || textBlob.includes("wrap")) {
    return CURATED_DISH_IMAGES.sandwich;
  }

  if (textBlob.includes("zucchini") || textBlob.includes("calabacín") || textBlob.includes("vegetable") || textBlob.includes("зеленчу") || textBlob.includes("verdura")) {
    return CURATED_DISH_IMAGES.vegetables;
  }

  return DEFAULT_RECIPE_FALLBACK_IMAGE;
}
