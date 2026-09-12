import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Lazy-initialized Gemini client helper
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

/**
 * Helper to detect transient (503), quota (429/Resource Exhausted), or unavailable errors
 */
function isGeminiTransientOrQuotaError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || "");
  const status = err.status || err.statusCode || err.code || 0;
  const statusText = String(err.statusText || "");
  const str = `${msg} ${status} ${statusText} ${err.stack || ""}`.toLowerCase();

  return (
    status === 503 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    str.includes("503") ||
    str.includes("429") ||
    str.includes("unavailable") ||
    str.includes("high demand") ||
    str.includes("resource_exhausted") ||
    str.includes("resource exhausted") ||
    str.includes("quota exceeded") ||
    str.includes("rate limit") ||
    str.includes("overloaded") ||
    str.includes("temporarily unavailable") ||
    str.includes("try again later")
  );
}

/**
 * Robust wrapper for Gemini API calls with multi-model fallback:
 * (gemini-3.8-flash -> gemini-3.1-flash-lite -> gemini-flash-latest)
 */
async function generateWithRetry(ai: any, params: any, maxRetriesPerModel = 2) {
  const primaryModel = params.model || "gemini-3.8-flash";
  const fallbackModels = [primaryModel, "gemini-3.1-flash-lite", "gemini-flash-latest"];
  const modelsToTry = Array.from(new Set(fallbackModels));

  let lastError;

  for (const modelName of modelsToTry) {
    let delay = 600;
    const currentParams = { ...params, model: modelName };

    for (let i = 0; i < maxRetriesPerModel; i++) {
      try {
        return await ai.models.generateContent(currentParams);
      } catch (err: any) {
        lastError = err;
        const isRetryable = isGeminiTransientOrQuotaError(err);

        if (isRetryable) {
          console.warn(`Gemini API notice on ${modelName} (attempt ${i + 1}/${maxRetriesPerModel}):`, err?.message || err);
          // If it's a quota or heavy demand error, immediately move to the next model
          const errText = String(err?.message || "").toLowerCase();
          if (errText.includes("resource_exhausted") || errText.includes("quota exceeded") || errText.includes("503") || err?.status === 503 || err?.status === 429) {
            break; // Immediately try the next model
          }
          if (i < maxRetriesPerModel - 1) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 1.5;
            continue;
          }
        }
        break; // try next model in fallback list
      }
    }
  }

  throw lastError;
}

// Health check
app.get("/api/health", (_req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({ status: "ok", aiConfigured: hasKey });
});

// Fallback seed recipes in case API key is missing or offline
const FALLBACK_RECIPES = [
  {
    id: "rec-tarator",
    title: {
      en: "Authentic Bulgarian Tarator (Cold Walnut & Yogurt Soup)",
      bg: "Класически Български Таратор с Орехи и Чесън",
      es: "Sopa Fría de Yogur, Pepino y Nuez (Tarator Búlgaro)",
    },
    description: {
      en: "Refreshing, rich in gut-healthy probiotics and healthy fats. Budget-friendly and ready in 10 minutes without cooking.",
      bg: "Освежаваща, богата на пробиотици и здравословни мазнини супа. Изключително икономична и готова за 10 минути без готвене.",
      es: "Refrescante sopa fría rica en probióticos y grasas saludables. Económica y lista en 10 minutos sin necesidad de cocinar.",
    },
    prepTimeMin: 10,
    cookTimeMin: 0,
    costPerServingEUR: 0.92,
    difficulty: "easy",
    servings: 2,
    calories: 210,
    proteinG: 12,
    carbsG: 9,
    fatG: 14,
    fiberG: 2,
    healthScore: 94,
    tags: ["Saludable", "Probiótico", "Económico < 2 €", "Sin Fuego", "10-min"],
    imageUrl: "/images/tarator_cold_soup_1789201044887.jpg",
    ingredients: [
      { name: "Yogur natural (Кисело мляко)", amount: 400, unit: "g", inPantry: true },
      { name: "Pepinos", amount: 2, unit: "uds", inPantry: true },
      { name: "Ajo fresco", amount: 2, unit: "dientes", inPantry: true },
      { name: "Nueces picadas", amount: 30, unit: "g", inPantry: false },
      { name: "Eneldo fresco", amount: 1, unit: "manojo", inPantry: false },
      { name: "Aceite de oliva", amount: 1, unit: "cda", inPantry: true },
      { name: "Agua fría y sal", amount: 150, unit: "ml", inPantry: true },
    ],
    instructions: {
      en: [
        "Finely dice or grate the cucumbers (peel if skin is thick).",
        "Crush the garlic cloves with a pinch of salt until pasty.",
        "In a large bowl, whisk the Bulgarian yogurt with cold water and olive oil until smooth.",
        "Stir in cucumbers, crushed garlic, and finely chopped dill.",
        "Top with crushed walnuts and refrigerate for 10 minutes before serving.",
      ],
      bg: [
        "Нарежете краставиците на ситни кубчета или ги настържете.",
        "Счукайте чесъна с щипка сол до гладка паста.",
        "В голяма купа разбийте киселото мляко със студена вода и струйка зехтин.",
        "Добавете краставиците, чесъна и ситно нарязания пресен копър.",
        "Поръсете с натрошени орехи и оставете за 10 минути в хладилника преди сервиране.",
      ],
      es: [
        "Corta los pepinos en dados muy pequeños o rállalos finamente.",
        "Maja los dientes de ajo con una pizca de sal hasta obtener una pasta.",
        "En un cuenco grande, bate el yogur con el agua fría y el aceite de oliva hasta que quede suave.",
        "Añade el pepino, el ajo majado y el eneldo picado.",
        "Decora con las nueces picadas y sirve bien frío.",
      ],
    },
    nutritionHighlights: {
      en: "High in gut microbiome friendly Lactobacillus bulgaricus, omega-3 from walnuts, very low glycemic index.",
      bg: "Богат на естествени пробиотици Lactobacillus bulgaricus, омега-3 от орехите и нисък гликемичен индекс.",
      es: "Rico en probióticos naturales, ácidos grasos omega-3 y de bajísimo índice glucémico.",
    },
  },
  {
    id: "rec-mishmash",
    title: {
      en: "Quick Traditional Mish-Mash (Pepper, Sirene & Egg Scramble)",
      bg: "Бърз Домашен Миш-Маш с Чушки, Сирене и Яйца",
      es: "Revuelto Balcánico de Pimientos, Queso y Huevos (Mish-Mash)",
    },
    description: {
      en: "The king of quick, protein-dense Balkan meals. Warm, satisfying, packed with antioxidants and completed in 15 minutes.",
      bg: "Царят на бързите и богати на протеин балкански ястия. Сгряващо, ароматно и готово за 15 минути.",
      es: "Plato estrella rápido y muy proteico. Reconfortante, saciante y listo en 15 minutos en sartén.",
    },
    prepTimeMin: 5,
    cookTimeMin: 12,
    costPerServingEUR: 1.33,
    difficulty: "easy",
    servings: 2,
    calories: 360,
    proteinG: 22,
    carbsG: 11,
    fatG: 24,
    fiberG: 3.5,
    healthScore: 91,
    tags: ["Alto en Proteína", "Vegetariano", "Rápido 15 min", "Económico"],
    imageUrl: "/images/mishmash_egg_skillet_1789201058875.jpg",
    ingredients: [
      { name: "Pimientos rojos (asados o frescos)", amount: 3, unit: "uds", inPantry: true },
      { name: "Queso blanco en salmuera / Feta", amount: 150, unit: "g", inPantry: true },
      { name: "Huevos frescos", amount: 3, unit: "uds", inPantry: true },
      { name: "Tomates picados", amount: 2, unit: "cdas", inPantry: true },
      { name: "Cebolla", amount: 0.5, unit: "ud", inPantry: true },
      { name: "Aceite de oliva o mantequilla", amount: 1, unit: "cda", inPantry: true },
    ],
    instructions: {
      en: [
        "Chop onions and sliced peppers.",
        "Heat olive oil in a skillet over medium heat. Sauté the onions and peppers for 4-5 minutes until tender.",
        "Add chopped tomatoes and let excess liquid reduce for 2 minutes.",
        "Crumble in the cheese, stirring gently.",
        "Beat the eggs lightly and pour into the pan. Stir softly on medium-low heat until eggs are softly scrambled and silky.",
        "Finish with fresh parsley and traditional dried herbs.",
      ],
      bg: [
        "Нарежете лука на ситно и чушките на средни парчета.",
        "Загрейте зехтин в тиган на средна температура. Задушете лука и чушките за 4-5 минути.",
        "Добавете нарязаните домати и оставете течността да се изпари за 2 минути.",
        "Натрошете сиренето в тигана.",
        "Разбийте яйцата и ги изсипете. Бъркайте внимателно на умерен огън до пухкава текстура.",
        "Поръсете с пресен магданоз и чубрица.",
      ],
      es: [
        "Pica la cebolla y corta los pimientos en tiras.",
        "Calienta el aceite en una sartén y sofríe la cebolla y los pimientos 4-5 minutos hasta que estén tiernos.",
        "Añade los tomates picados y reduce 2 minutos.",
        "Desmenuza el queso dentro de la sartén mezclando con suavidad.",
        "Bate los huevos e incorpóralos, removiendo despacio a fuego medio-bajo hasta lograr un revuelto cremoso.",
        "Espolvorea con perejil fresco o hierbas aromáticas al gusto.",
      ],
    },
    nutritionHighlights: {
      en: "22g high biological value protein per serving, rich in Vitamin C from peppers and bioavailable calcium.",
      bg: "22г пълноценен протеин на порция, витамин С от чушките и усвоим калций от сиренето.",
      es: "22g de proteína de alto valor biológico, gran dosis de vitamina C y calcio asimilable.",
    },
  },
  {
    id: "rec-bob-chorba",
    title: {
      en: "Monastery Style White Bean Stew",
      bg: "Манастирски Зрял Боб с Билки и Зеленчуци",
      es: "Alubias Blancas Tradicionales con Verduras y Especias",
    },
    description: {
      en: "High-fiber, plant-protein powerhouse. Extremely economical, deeply comforting, and naturally anti-inflammatory with wild savory & mint.",
      bg: "Богато на фибри и растителен протеин традиционно ястие. Изключително икономично, засищащо и ароматно с джоджен и чубрица.",
      es: "Guiso tradicional de alubias blancas rico en fibra y proteína vegetal. Muy económico, nutritivo y reconfortante.",
    },
    prepTimeMin: 10,
    cookTimeMin: 35,
    costPerServingEUR: 0.72,
    difficulty: "medium",
    servings: 4,
    calories: 290,
    proteinG: 16,
    carbsG: 44,
    fatG: 4,
    fiberG: 14,
    healthScore: 96,
    tags: ["Alto en Fibra", "Vegano", "Económico < 1 €", "Cardiosaludable"],
    imageUrl: "/images/bean_stew_chorba_1789201071875.jpg",
    ingredients: [
      { name: "Alubias blancas cocidas", amount: 500, unit: "g", inPantry: true },
      { name: "Zanahoria", amount: 1, unit: "ud", inPantry: true },
      { name: "Cebolla", amount: 1, unit: "ud", inPantry: true },
      { name: "Pimiento rojo", amount: 1, unit: "ud", inPantry: true },
      { name: "Tomate triturado", amount: 2, unit: "cdas", inPantry: true },
      { name: "Hierbabuena o menta seca", amount: 1, unit: "cda", inPantry: true },
      { name: "Pimentón dulce", amount: 1, unit: "cdta", inPantry: true },
    ],
    instructions: {
      en: [
        "Finely chop the onion, carrot, and pepper.",
        "In a pot, heat 1 tbsp oil, gently sauté vegetables for 5 minutes with paprika.",
        "Add the cooked white beans along with 500ml water or vegetable broth and tomato puree.",
        "Simmer on medium-low for 25-30 minutes until the broth thickens naturally.",
        "Rub spearmint and savory between your palms into the pot in the final 5 minutes.",
      ],
      bg: [
        "Нарежете лука, моркова и чушката на ситно.",
        "В тенджера загрейте 1 с.л. мазнина и задушете зеленчуците за 5 минути с лъжичка червен пипер.",
        "Добавете сварения боб заедно с 500 мл вода или зеленчуков бульон и доматеното пюре.",
        "Оставете да къкри на тих огън 25-30 минути, докато чорбата леко се сгъсти.",
        "В последните 5 минути стрийте между дланите си сух джоджен и ронена чубрица.",
      ],
      es: [
        "Pica finamente la cebolla, la zanahoria y el pimiento.",
        "En una cazuela con un chorrito de aceite, sofríe las verduras durante 5 minutos con el pimentón.",
        "Añade las alubias cocidas junto con 500ml de agua o caldo y el tomate triturado.",
        "Cocina a fuego medio-bajo durante 25 minutos para que el caldo espese de forma natural.",
        "Añade la hierbabuena seca en los últimos minutos frotándola entre las palmas de las manos.",
      ],
    },
    nutritionHighlights: {
      en: "Over 14g prebiotic dietary fiber, assists with cholesterol control, very low fat, zero saturated fat.",
      bg: "Над 14г пребиотични фибри, регулиращи холестерола и кръвната захар, с минимално съдържание на мазнини.",
      es: "Más de 14g de fibra prebiótica para el control del colesterol, saciedad y salud cardiovascular.",
    },
  },
];

function resolveRecipeImageUrl(recipe: any): string {
  if (recipe && recipe.imageUrl && typeof recipe.imageUrl === "string" && recipe.imageUrl.trim().length > 0) {
    if (recipe.imageUrl.startsWith("/src/assets/images/")) {
      return recipe.imageUrl.replace("/src/assets/images/", "/images/");
    }
    return recipe.imageUrl;
  }

  const enTitle = (recipe?.title?.en || "").toLowerCase();
  const bgTitle = (recipe?.title?.bg || "").toLowerCase();
  const esTitle = (recipe?.title?.es || "").toLowerCase();
  const tags = (recipe?.tags || []).join(" ").toLowerCase();
  const ingredientNames = (recipe?.ingredients || []).map((i: any) => (i.name || "").toLowerCase()).join(" ");
  const text = `${enTitle} ${bgTitle} ${esTitle} ${tags} ${ingredientNames}`;

  if (text.includes("tarator") || text.includes("таратор") || (text.includes("yogur") && text.includes("pepino"))) {
    return "/images/tarator_cold_soup_1789201044887.jpg";
  }
  if (text.includes("mish-mash") || text.includes("mishmash") || text.includes("миш-маш") || (text.includes("revuelto") && text.includes("pimiento"))) {
    return "/images/mishmash_egg_skillet_1789201058875.jpg";
  }
  if (text.includes("bob") || text.includes("боб") || text.includes("bean") || text.includes("alubia") || text.includes("fabada")) {
    return "/images/bean_stew_chorba_1789201071875.jpg";
  }
  if (text.includes("lentil") || text.includes("леща") || text.includes("lenteja")) {
    return "/images/lentil_soup_balkan_style_1789192381584.jpg";
  }
  if (text.includes("shopska") || text.includes("шопска") || text.includes("salad") || text.includes("салата") || text.includes("ensalada")) {
    return "/images/shopska_salad_balkan_style_1789192343976.jpg";
  }
  if (text.includes("musaka") || text.includes("мусака") || text.includes("moussaka")) {
    return "/images/musaka_balkan_style_1789192368570.jpg";
  }
  if (text.includes("banitsa") || text.includes("баница") || text.includes("pie") || text.includes("hojaldre")) {
    return "/images/banitsa_pastry_balkan_style_1789192356824.jpg";
  }
  if (text.includes("pasta") || text.includes("macarron") || text.includes("макарони") || text.includes("spaghetti") || text.includes("noodle")) {
    return "https://images.unsplash.com/photo-1621996346565-e3d5d6281699?auto=format&fit=crop&w=800&q=80";
  }
  if (text.includes("rice") || text.includes("ориз") || text.includes("arroz") || text.includes("risotto")) {
    return "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80";
  }
  if (text.includes("egg") || text.includes("яйц") || text.includes("huevo") || text.includes("omelet") || text.includes("tortilla")) {
    return "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80";
  }
  if (text.includes("chicken") || text.includes("пиле") || text.includes("pollo") || text.includes("turkey") || text.includes("pavo")) {
    return "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80";
  }
  if (text.includes("fish") || text.includes("риба") || text.includes("pescado") || text.includes("salmon") || text.includes("tuna") || text.includes("atún")) {
    return "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80";
  }
  if (text.includes("meatball") || text.includes("кюфте") || text.includes("albondiga") || text.includes("beef") || text.includes("pork") || text.includes("cerdo")) {
    return "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=800&q=80";
  }
  if (text.includes("soup") || text.includes("супа") || text.includes("sopa") || text.includes("crema") || text.includes("caldo")) {
    return "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80";
  }
  if (text.includes("sandwich") || text.includes("сандвич") || text.includes("bocadillo") || text.includes("tostada") || text.includes("wrap")) {
    return "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=80";
  }
  if (text.includes("zucchini") || text.includes("calabacín") || text.includes("vegetable") || text.includes("зеленчу") || text.includes("verdura")) {
    return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80";
  }

  return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80";
}

function fallbackParseIntent(transcript: string, language: string, currentPantry: any[] = [], mealLogs: any[] = []) {
  const lower = transcript.toLowerCase();
  const items: any[] = [];
  let actionType = "ANSWER";
  let mealLog: any = null;

  const pantryNames = Array.isArray(currentPantry) && currentPantry.length > 0
    ? currentPantry.map((p: any) => p.name).join(", ")
    : "";

  // Check for meal logging (breakfast/lunch/dinner/ate)
  const isMealLog =
    lower.includes("desayuné") ||
    lower.includes("desayuno") ||
    lower.includes("comí") ||
    lower.includes("comida") ||
    lower.includes("almorcé") ||
    lower.includes("almuerzo") ||
    lower.includes("cené") ||
    lower.includes("ate") ||
    lower.includes("had") ||
    lower.includes("breakfast") ||
    lower.includes("lunch");

  // Check for dinner/recipe query
  const isDinnerQuery =
    lower.includes("cenar") ||
    lower.includes("cena") ||
    lower.includes("que voy a cenar") ||
    lower.includes("qué voy a cenar") ||
    lower.includes("dinner") ||
    lower.includes("receta") ||
    lower.includes("qué cocino");

  if (
    lower.includes("tengo") ||
    lower.includes("compré") ||
    lower.includes("compre") ||
    lower.includes("add") ||
    lower.includes("bought") ||
    lower.includes("купих") ||
    lower.includes("добави")
  ) {
    actionType = "ADD_ITEMS";

    if (lower.includes("huevos") || lower.includes("huevo")) {
      items.push({ name: "Huevos frescos", quantity: 6, unit: "uds", category: "Lácteos/Proteína" });
    }
    if (lower.includes("filadelfia") || lower.includes("queso")) {
      items.push({ name: "Queso crema estilo Filadelfia", quantity: 1, unit: "tarrina", category: "Lácteos" });
    }
    if (lower.includes("leche")) {
      items.push({ name: "Leche", quantity: 1, unit: "litro", category: "Lácteos" });
    }
    if (lower.includes("tomate") || lower.includes("tomates")) {
      items.push({ name: "Tomates", quantity: 1, unit: "kg", category: "Verduras" });
    }
    if (lower.includes("yogur") || lower.includes("kiselo")) {
      items.push({ name: "Yogur", quantity: 2, unit: "uds", category: "Lácteos" });
    }

    if (items.length === 0) {
      const cleanName = transcript
        .replace(/no tengo|tengo|compré|compre|add|bought|купих|добави/gi, "")
        .trim();
      if (cleanName) {
        items.push({ name: cleanName, quantity: 1, unit: "unidad", category: "Otros" });
      }
    }
  } else if (isMealLog) {
    actionType = "MEAL_LOG";
    let mealType: "breakfast" | "lunch" | "dinner" | "snack" = "lunch";
    if (lower.includes("desayun") || lower.includes("breakfast")) mealType = "breakfast";
    if (lower.includes("cen") || lower.includes("dinner")) mealType = "dinner";

    mealLog = {
      mealType,
      manualName: transcript,
      calories: 450,
      proteinG: 25,
      carbsG: 35,
      fatG: 18,
    };
  } else if (isDinnerQuery) {
    actionType = "RECIPE_RECOMMENDATION";
  }

  let spokenFeedback = "";
  if (actionType === "ADD_ITEMS") {
    spokenFeedback = language === "es"
      ? `Entendido. He añadido a tu despensa: ${items.map(i => i.name).join(", ")}.`
      : language === "bg"
      ? `Добавих към килера: ${items.map(i => i.name).join(", ")}.`
      : `Added to pantry: ${items.map(i => i.name).join(", ")}.`;
  } else if (actionType === "MEAL_LOG" || (isMealLog && isDinnerQuery)) {
    let suggestion = "";
    if (pantryNames) {
      suggestion = language === "es"
        ? ` Teniendo en cuenta tu despensa (${pantryNames}), puedes hacer algo rápido con lo que tienes, o bien comprar un par de ingredientes frescos (como verduras o proteína) para una cena completa.`
        : ` Considering your pantry (${pantryNames}), you can cook using what you have or buy 1-2 extra fresh ingredients for a complete meal.`;
    } else {
      suggestion = language === "es"
        ? " Te sugiero algunas opciones deliciosas para cenar con lo que tienes o añadiendo algún ingrediente fresco."
        : " For dinner, I suggest tasty options using pantry items or adding fresh groceries.";
    }

    spokenFeedback = language === "es"
      ? `¡Perfecto! He registrado lo que has comido y desayunado hoy.` + suggestion
      : `Logged your meals!` + suggestion;
  } else if (actionType === "RECIPE_RECOMMENDATION") {
    if (pantryNames) {
      spokenFeedback = language === "es"
        ? `Te sugiero varias opciones para cenar: algunas aprovechan lo que tienes en tu despensa (${pantryNames}), y otras proponen comprar algún ingrediente extra para darte más variedad. Puedes ver las recetas completas en la sección Recetas.`
        : `I suggest dinner options combining your pantry ingredients (${pantryNames}) and a few recommended extra items for variety. Check out full step-by-step recipes!`;
    } else {
      spokenFeedback = language === "es"
        ? "Te recomiendo opciones para cenar: tanto platos sencillos con tu despensa como recetas recomendadas añadiendo ingredientes frescos."
        : "For dinner I suggest options using your pantry or adding fresh complementary ingredients.";
    }
  } else {
    spokenFeedback = language === "es"
      ? `Entendido: "${transcript}". He anotado tu mensaje.`
      : language === "bg"
      ? `Чух ви: "${transcript}".`
      : `Heard: "${transcript}".`;
  }

  return {
    actionType,
    spokenFeedback,
    items,
    mealLog,
  };
}

// Fallback reconciliation parser when offline or Gemini API is not available
function fallbackReconcileShopping(transcript: string, currentShoppingList: any[] = [], language: string = "es") {
  const lower = transcript.toLowerCase();
  const negations = [
    "no compré", "no compre", "no había", "no habia", "sin", "menos", "excepto", 
    "didn't buy", "did not buy", "except", "нямаше", "не купих", "без", "faltó", "falto"
  ];
  
  const boughtAll = lower.includes("todo") || lower.includes("toda") || lower.includes("all") || lower.includes("всичко");

  const purchasedItemIds: string[] = [];
  const unpurchasedItemIds: string[] = [];
  const purchasedListItemsDetails: any[] = [];

  currentShoppingList.forEach((item: any) => {
    const itemName = String(item.name || "").toLowerCase();
    const itemWords = itemName.split(/\s+/).filter((w) => w.length > 2);
    
    const isMentioned = itemName && (lower.includes(itemName) || itemWords.some((w) => lower.includes(w)));
    
    let isNegated = false;
    if (isMentioned) {
      for (const neg of negations) {
        const negIdx = lower.indexOf(neg);
        const itemIdx = lower.indexOf(itemName);
        if (negIdx !== -1 && itemIdx !== -1 && Math.abs(itemIdx - negIdx) < 40) {
          isNegated = true;
          break;
        }
      }
    }

    if (boughtAll) {
      if (isNegated) {
        unpurchasedItemIds.push(item.id);
      } else {
        purchasedItemIds.push(item.id);
        purchasedListItemsDetails.push({
          id: item.id,
          name: item.name,
          quantity: item.quantity || 1,
          unit: item.unit || "pcs",
          category: item.category || "Produce",
          estimatedCostEUR: item.estimatedPriceEUR || 1.5,
          expiryDaysLeft: 7,
        });
      }
    } else {
      if (isMentioned && !isNegated) {
        purchasedItemIds.push(item.id);
        purchasedListItemsDetails.push({
          id: item.id,
          name: item.name,
          quantity: item.quantity || 1,
          unit: item.unit || "pcs",
          category: item.category || "Produce",
          estimatedCostEUR: item.estimatedPriceEUR || 1.5,
          expiryDaysLeft: 7,
        });
      } else {
        unpurchasedItemIds.push(item.id);
      }
    }
  });

  const extraPurchasedItems: any[] = [];
  const commonExtras = [
    { key: "aguacate", name: "Aguacates", nameBg: "Авокадо", unit: "uds", category: "Produce", cost: 1.99 },
    { key: "plátano", name: "Plátanos", nameBg: "Банани", unit: "kg", category: "Produce", cost: 1.40 },
    { key: "platano", name: "Plátanos", nameBg: "Банани", unit: "kg", category: "Produce", cost: 1.40 },
    { key: "banana", name: "Bananas", nameBg: "Банани", unit: "kg", category: "Produce", cost: 1.40 },
    { key: "pan", name: "Pan artesano", nameBg: "Хляб", unit: "ud", category: "Pantry/Grains", cost: 1.10 },
    { key: "manzana", name: "Manzanas", nameBg: "Ябълки", unit: "kg", category: "Produce", cost: 1.60 },
    { key: "café", name: "Café molido", nameBg: "Кафе", unit: "pack", category: "Pantry/Grains", cost: 2.50 },
    { key: "cafe", name: "Café molido", nameBg: "Кафе", unit: "pack", category: "Pantry/Grains", cost: 2.50 },
    { key: "chocolate", name: "Chocolate negro", nameBg: "Шоколад", unit: "ud", category: "Pantry/Grains", cost: 1.80 },
  ];

  commonExtras.forEach((extra) => {
    if (lower.includes(extra.key)) {
      const alreadyInList = currentShoppingList.some((item) =>
        String(item.name).toLowerCase().includes(extra.key)
      );
      if (!alreadyInList) {
        extraPurchasedItems.push({
          name: language === "bg" ? extra.nameBg : language === "es" ? extra.name : extra.key,
          quantity: 1,
          unit: extra.unit,
          category: extra.category,
          estimatedCostEUR: extra.cost,
          expiryDaysLeft: 7,
        });
      }
    }
  });

  const purchasedNames = purchasedListItemsDetails.map((i) => i.name).join(", ");
  const extraNames = extraPurchasedItems.map((i) => i.name).join(", ");

  let spokenFeedback = "";
  if (language === "es") {
    if (purchasedItemIds.length > 0 && extraPurchasedItems.length > 0) {
      spokenFeedback = `He marcado como comprados de tu lista: ${purchasedNames}. Además he detectado compras extra: ${extraNames}. Los artículos no comprados se quedan en tu lista.`;
    } else if (purchasedItemIds.length > 0) {
      spokenFeedback = `He detectado que compraste: ${purchasedNames}. Los artículos pendientes permanecen en tu lista para la próxima compra.`;
    } else {
      spokenFeedback = `He analizado tu mensaje. Revisa los artículos marcados a continuación antes de confirmar.`;
    }
  } else if (language === "bg") {
    spokenFeedback = `Отчетох закупените продукти: ${purchasedNames || "избраните"}. Останалите ще се запазят в списъка.`;
  } else {
    spokenFeedback = `Identified purchased items: ${purchasedNames || "selected items"}. Unpurchased items remain in your shopping list.`;
  }

  return {
    purchasedItemIds,
    unpurchasedItemIds,
    extraPurchasedItems,
    purchasedListItemsDetails,
    spokenFeedback,
  };
}

// Endpoint: Parse voice or typed AI request (Voice Chef)
app.post("/api/ai/parse-intent", async (req, res) => {
  const { transcript, currentPantry = [], mealLogs = [], conversationHistory = [], language = "en" } = req.body || {};
  if (!transcript || typeof transcript !== "string") {
    return res.status(400).json({ error: "Transcript is required" });
  }

  try {
    const ai = getGeminiClient();

    if (!ai) {
      return res.json(fallbackParseIntent(transcript, language, currentPantry, mealLogs));
    }

    const systemPrompt = `You are a warm, expert Medical Nutritionist and AI Chef (BalkanBite).
User Language: ${language === "bg" ? "Bulgarian" : language === "es" ? "Spanish" : "English"}.

User's Current Pantry Ingredients: ${JSON.stringify(currentPantry)}
User's Logged Meals Today: ${JSON.stringify(mealLogs)}
Recent Chat Context: ${JSON.stringify((conversationHistory || []).slice(-6))}

Task: Analyze the user's input: "${transcript}"

Determine the user's intent:
1. "MEAL_LOG": User mentions what they ate (e.g. "desayuné X y comí Y", "ate salad").
2. "RECIPE_RECOMMENDATION": User asks what to eat/cook for dinner, lunch, etc. (e.g. "¿qué voy a cenar?", "qué puedo cocinar").
3. "ADD_ITEMS": User bought or has ingredients to add.
4. "REMOVE_ITEMS": User cooked or used up ingredients.
5. "ADD_SHOPPING": User wants to add items to grocery list.
6. "ANSWER": General medical/nutritional guidance or chat.

IMPORTANT RULES:
- Provide a warm, helpful, complete "spokenFeedback" in ${language === "bg" ? "Bulgarian" : language === "es" ? "Spanish" : "English"}.
- NEVER use generic placeholders like "estoy procesando tus ingredientes".
- IF user asks what to eat/cook for dinner or lunch: Offer a mix of options. Some recipes can rely on ingredients they already have in their pantry (${JSON.stringify(currentPantry.map((p: any) => p.name))}), and others can suggest purchasing 1-2 complementary fresh ingredients to complete a delicious meal. Always take into account what they've already eaten today!
- IF user reports meals, calculate reasonable calorie & protein estimates into "mealLog".

Return strictly JSON format:
{
  "actionType": "MEAL_LOG" | "RECIPE_RECOMMENDATION" | "ADD_ITEMS" | "REMOVE_ITEMS" | "ADD_SHOPPING" | "ANSWER",
  "spokenFeedback": "Complete, friendly nutritionist response addressing all user points in ${language}.",
  "items": [{ "name": "string", "quantity": number, "unit": "string", "category": "Produce"|"Dairy"|"Meat/Fish"|"Pantry/Grains"|"Spices"|"Other" }],
  "mealLog": { "mealType": "breakfast"|"lunch"|"dinner"|"snack", "manualName": "string", "calories": number, "proteinG": number, "carbsG": number, "fatG": number }
}`;

    const response = await generateWithRetry(ai, {
      model: "gemini-3.8-flash",
      contents: transcript,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    if (!parsed.spokenFeedback) {
      parsed.spokenFeedback = fallbackParseIntent(transcript, language, currentPantry, mealLogs).spokenFeedback;
    }
    return res.json(parsed);
  } catch (err: any) {
    console.warn("Gemini API error during voice intent parse, using fallback parser:", err.message || err);
    // Graceful fallback response instead of 500 error
    const fallbackResult = fallbackParseIntent(transcript, language, currentPantry, mealLogs);
    return res.json(fallbackResult);
  }
});

// Endpoint: Voice Shopping Reconciliation
app.post("/api/ai/reconcile-shopping", async (req, res) => {
  const { transcript, currentShoppingList = [], language = "es" } = req.body || {};
  if (!transcript || typeof transcript !== "string") {
    return res.status(400).json({ error: "Transcript is required" });
  }

  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.json(fallbackReconcileShopping(transcript, currentShoppingList, language));
    }

    const systemPrompt = `You are an intelligent supermarket shopping reconciliation assistant (BalkanBite).
The user just completed a shopping trip.
Their current shopping list: ${JSON.stringify(currentShoppingList)}

The user dictated what they ACTUALLY bought in real life:
"${transcript}"

Context & Rules:
1. Identify all items from currentShoppingList that the user bought -> "purchasedItemIds".
2. Identify items from currentShoppingList that the user explicitly didn't buy or that remained unpurchased -> "unpurchasedItemIds".
3. Identify any extra grocery items bought that were NOT originally in the shopping list -> "extraPurchasedItems".
4. Support Spanish, Bulgarian, and English item names and flexible synonyms.
5. Provide a clear, natural "spokenFeedback" in ${language === "bg" ? "Bulgarian" : language === "es" ? "Spanish" : "English"} explaining what was marked as bought, what was left in the list, and any extra items added.

Return strictly JSON format:
{
  "purchasedItemIds": ["id_1", "id_2"],
  "unpurchasedItemIds": ["id_3"],
  "extraPurchasedItems": [
    {
      "name": "string",
      "quantity": number,
      "unit": "string",
      "category": "Produce" | "Dairy" | "Meat/Fish" | "Pantry/Grains" | "Spices" | "Other",
      "estimatedCostEUR": number,
      "expiryDaysLeft": number
    }
  ],
  "purchasedListItemsDetails": [
    {
      "id": "string",
      "name": "string",
      "quantity": number,
      "unit": "string",
      "category": "Produce" | "Dairy" | "Meat/Fish" | "Pantry/Grains" | "Spices" | "Other",
      "estimatedCostEUR": number,
      "expiryDaysLeft": number
    }
  ],
  "spokenFeedback": "Concise summary in ${language}."
}`;

    const response = await generateWithRetry(ai, {
      model: "gemini-3.8-flash",
      contents: transcript,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    if (!parsed.spokenFeedback) {
      parsed.spokenFeedback = fallbackReconcileShopping(transcript, currentShoppingList, language).spokenFeedback;
    }
    return res.json(parsed);
  } catch (err: any) {
    console.warn("Gemini API error in reconcile-shopping, using fallback:", err.message || err);
    return res.json(fallbackReconcileShopping(transcript, currentShoppingList, language));
  }
});


// Endpoint: Generate dynamic tailored recipes based on pantry & preferences
app.post("/api/ai/generate-recipes", async (req, res) => {
  try {
    const {
      pantry = [],
      profile = {},
      query = "",
      language = "en",
    } = req.body;

    const ai = getGeminiClient();

    if (!ai) {
      // Return rich seed recipes if no API key
      const fallbackWithImages = FALLBACK_RECIPES.map((rec) => ({
        ...rec,
        imageUrl: resolveRecipeImageUrl(rec),
      }));
      return res.json({
        recipes: fallbackWithImages,
        source: "curated_fallback",
        note: "Add Gemini API Key in Settings > Secrets for endless dynamic recipes from your specific pantry!",
      });
    }

    const prompt = `Generate 3 distinct, delicious, healthy, balanced and inexpensive recipes.
Primary Language: ${language === "bg" ? "Bulgarian (български)" : language === "es" ? "Spanish (Español)" : "English"}.
User Current Pantry: ${JSON.stringify(pantry)}.
User Taste Profile & Preferences:
- Cooking Level/Speed: ${profile.cookingSpeed || "fast 15-20 min"}
- Health Goal: ${profile.healthGoal || "balanced & gut-health"}
- Diet Style: ${profile.dietStyle || "Mediterranean & Balkan balanced"}
- Disliked/Allergies: ${JSON.stringify(profile.disliked || [])}
- Budget constraint: ${profile.budgetConstraint || "Very budget friendly (< 1.5-2 EUR per serving)"}
- Household size: ${profile.servings || 2} servings
- Specific user craving / voice query: "${query || "Healthy, cheap, balanced dinner using my pantry"}"

User Active Language: ${language || "es"}

Crucial Rules:
1. Provide a great variety: Include recipes that use existing pantry items as well as creative recipes that suggest buying 1-3 extra fresh or complementary ingredients.
2. For any ingredient not in the user's pantry, clearly set inPantry to false so it can be automatically added to their shopping list with a single click.
3. Balance macros: Ensure good protein, high fiber, healthy fats, reasonable carbs.
4. Calculate realistic cost per serving in EUR (€) and USD ($) based on actual market pricing.
5. Emphasize wholesome Balkan/Mediterranean simplicity (savory herbs like chubritsa/dill, fresh produce, fermented probiotics like yogurt, legumes).
6. Always provide high-quality localized translations for 'es' (Spanish), 'bg' (Bulgarian), and 'en' (English) in title, description, instructions, and nutrition highlights.

Return strictly a JSON array of 3 recipe objects conforming to this schema:
[
  {
    "id": "string",
    "title": { "en": "string", "bg": "string", "es": "string" },
    "description": { "en": "string", "bg": "string", "es": "string" },
    "prepTimeMin": number,
    "cookTimeMin": number,
    "costPerServingEUR": number,
    "difficulty": "easy" | "medium" | "advanced",
    "servings": number,
    "calories": number,
    "proteinG": number,
    "carbsG": number,
    "fatG": number,
    "fiberG": number,
    "healthScore": number (80-100),
    "tags": ["string"],
    "ingredients": [
      {
        "name": "string",
        "amount": number,
        "unit": "string",
        "inPantry": boolean
      }
    ],
    "instructions": {
      "en": ["step 1", "step 2"],
      "bg": ["стъпка 1", "стъпка 2"],
      "es": ["paso 1", "paso 2"]
    },
    "nutritionHighlights": {
      "en": "string",
      "bg": "string",
      "es": "string"
    }
  }
]`;

    const response = await generateWithRetry(ai, {
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "[]");
    const rawList: any[] = Array.isArray(parsed) ? parsed : (parsed.recipes || FALLBACK_RECIPES);
    const enrichedRecipes = rawList.map((rec: any, idx: number) => ({
      ...rec,
      id: rec.id || `ai-rec-${Date.now()}-${idx}`,
      imageUrl: resolveRecipeImageUrl(rec),
    }));

    return res.json({
      recipes: enrichedRecipes,
      source: "gemini",
    });
  } catch (err: any) {
    console.error("Error generating recipes:", err);
    const fallbackWithImages = FALLBACK_RECIPES.map((rec) => ({
      ...rec,
      imageUrl: resolveRecipeImageUrl(rec),
    }));
    return res.json({
      recipes: fallbackWithImages,
      source: "fallback_error",
      error: err.message,
    });
  }
});

// Endpoint: AI Smart Weekly Shopping List Proposal
app.post("/api/ai/suggest-shopping", async (req, res) => {
  const { pantry = [], profile = {}, language = "es" } = req.body || {};
  try {
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        title:
          language === "bg"
            ? "Седмичен балансиран списък (Икономичен)"
            : language === "es"
            ? "Cesta Semanal Inteligente (Económica)"
            : "Weekly Balanced Smart Basket (Budget-Friendly)",
        totalEstimatedEUR: 12.5,
        items: [
          {
            name:
              language === "bg"
                ? "Българско кисело мляко 3.6%"
                : language === "es"
                ? "Yogur natural o griego 3.6%"
                : "Bulgarian Yogurt 3.6%",
            quantity: 2,
            unit: language === "es" ? "packs" : "pack",
            category: "Dairy",
            estimatedPriceEUR: 1.6,
          },
          {
            name:
              language === "bg"
                ? "Пресни краставици"
                : language === "es"
                ? "Pepinos frescos"
                : "Fresh Cucumbers",
            quantity: 1,
            unit: "kg",
            category: "Produce",
            estimatedPriceEUR: 1.4,
          },
          {
            name:
              language === "bg"
                ? "Розови домати"
                : language === "es"
                ? "Tomates frescos para ensalada"
                : "Bulgarian Pink Tomatoes",
            quantity: 1.5,
            unit: "kg",
            category: "Produce",
            estimatedPriceEUR: 2.3,
          },
          {
            name:
              language === "bg"
                ? "Бяло сирене (краве или смес)"
                : language === "es"
                ? "Queso blanco tipo Feta / Sirene"
                : "Sirene Cheese (Cow or Mixed)",
            quantity: 400,
            unit: "g",
            category: "Dairy",
            estimatedPriceEUR: 3.0,
          },
          {
            name:
              language === "bg"
                ? "Яйца (размер L)"
                : language === "es"
                ? "Huevos camperos (tamaño L)"
                : "Free-range Eggs L",
            quantity: 10,
            unit: language === "es" ? "uds" : "pcs",
            category: "Dairy",
            estimatedPriceEUR: 2.1,
          },
          {
            name:
              language === "bg"
                ? "Пресен копър и магданоз"
                : language === "es"
                ? "Eneldo y perejil fresco"
                : "Fresh Dill & Parsley",
            quantity: 2,
            unit: language === "es" ? "manojos" : "bunch",
            category: "Produce",
            estimatedPriceEUR: 0.9,
          },
          {
            name:
              language === "bg"
                ? "Орехови ядки"
                : language === "es"
                ? "Nueces peladas"
                : "Walnut Halves",
            quantity: 100,
            unit: "g",
            category: "Pantry",
            estimatedPriceEUR: 1.0,
          },
        ],
        aiReasoning:
          language === "bg"
            ? "Този базов списък струва под 12.5€ и ви позволява да приготвите поне 6 питателни, богати на протеин и пробиотици хранения (Таратор, Миш-маш, Шопска салата)."
            : language === "es"
            ? "Esta cesta básica cuesta menos de 12.5€ y permite preparar al menos 6 comidas nutritivas, ricas en probióticos y proteínas (Tarator, revuelto Mish-Mash, ensaladas frescas)."
            : "This core basket costs under 12.5€ and enables at least 6 balanced, probiotic and protein-rich meals (Tarator, Mish-Mash, Fresh Salads).",
      });
    }

    const targetLangName =
      language === "bg"
        ? "Bulgarian"
        : language === "es"
        ? "Spanish (Español)"
        : "English";

    const prompt = `You are BalkanBite AI. The user wants an intelligent, highly balanced, nutritious, and cost-effective weekly grocery shopping list.
Current Pantry contents: ${JSON.stringify(pantry)}.
User preferences: ${JSON.stringify(profile)}.
Target Language: ${targetLangName}.

CRITICAL LANGUAGE REQUIREMENT:
All text including "title", every item "name", item "unit", item "reason", and "aiReasoning" MUST BE WRITTEN 100% IN ${targetLangName.toUpperCase()}.
If Target Language is Spanish, write every ingredient name in Spanish (e.g. "Yogur natural", "Tomates maduros", "Huevos camperos", "Pepinos", "Ajo fresco", "Queso Feta"). NEVER return English ingredient names when target language is Spanish.

Identify the critical missing nutritional gaps (e.g. need lean protein, fermented dairy, fresh vitamin C vegetables, fiber legumes).
Suggest 7 to 10 high-value staple items that keep the total weekly basket under 20€ / $22.
Include accurate prices in EUR/USD.

Return strictly JSON with this schema:
{
  "title": "string (in ${targetLangName})",
  "totalEstimatedEUR": number,
  "aiReasoning": "string (in ${targetLangName}, explaining why these items create cheap, varied, and balanced meals)",
  "items": [
    {
      "name": "string (in ${targetLangName})",
      "quantity": number,
      "unit": "string (in ${targetLangName}, e.g. kg, g, packs, uds, manojos)",
      "category": "Produce" | "Dairy" | "Meat/Fish" | "Pantry" | "Spices" | "Other",
      "estimatedPriceEUR": number,
      "reason": "string (in ${targetLangName}, short health/balance reason)"
    }
  ]
}`;

    const response = await generateWithRetry(ai, {
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (err: any) {
    console.warn("Gemini API error during shopping suggestion, returning balanced default basket:", err.message || err);
    return res.json({
      title: language === "bg" ? "Седмичен балансиран списък (Икономичен)" : language === "es" ? "Cesta Semanal Inteligente (Económica)" : "Weekly Balanced Smart Basket (Budget-Friendly)",
      totalEstimatedEUR: 12.5,
      items: [
        { name: language === "bg" ? "Българско кисело мляко 3.6%" : language === "es" ? "Yogur natural o griego" : "Natural Yogurt 3.6%", quantity: 2, unit: language === "es" ? "packs" : "pack", category: "Dairy", estimatedPriceEUR: 1.6 },
        { name: language === "bg" ? "Пресни краставици" : language === "es" ? "Pepinos frescos" : "Fresh Cucumbers", quantity: 1, unit: "kg", category: "Produce", estimatedPriceEUR: 1.4 },
        { name: language === "bg" ? "Розови домати" : language === "es" ? "Tomates frescos" : "Fresh Tomatoes", quantity: 1.5, unit: "kg", category: "Produce", estimatedPriceEUR: 2.3 },
        { name: language === "bg" ? "Бяло сирене (сирене/фета)" : language === "es" ? "Queso Feta / Sirene" : "Sirene / Feta Cheese", quantity: 400, unit: "g", category: "Dairy", estimatedPriceEUR: 3.0 },
        { name: language === "bg" ? "Яйца (размер L)" : language === "es" ? "Huevos camperos L" : "Fresh Eggs L", quantity: 10, unit: language === "es" ? "uds" : "pcs", category: "Dairy", estimatedPriceEUR: 2.1 },
        { name: language === "bg" ? "Пресен копър и магданоз" : language === "es" ? "Eneldo y perejil fresco" : "Fresh Dill & Parsley", quantity: 2, unit: language === "es" ? "manojos" : "bunch", category: "Produce", estimatedPriceEUR: 0.9 },
        { name: language === "bg" ? "Орехови ядки" : language === "es" ? "Nueces peladas" : "Walnut Halves", quantity: 100, unit: "g", category: "Pantry", estimatedPriceEUR: 1.2 },
      ],
      aiReasoning: language === "bg"
        ? "Този базов списък струва под 12.5€ и ви позволява да приготвите поне 6 питателни, богати на протеин и пробиотици хранения."
        : language === "es"
        ? "Esta cesta básica cuesta menos de 12.5€ y permite preparar al menos 6 platos ricos en proteínas y probióticos (Tarator, ensaladas y revueltos)."
        : "This core basket costs under 12.5€ and enables at least 6 balanced, probiotic and protein-rich meals.",
      source: "resilient_fallback",
    });
  }
});

// Endpoint: AI Visual Scanner for Fridge, Pantry & Receipts
app.post("/api/ai/scan-image", async (req, res) => {
  try {
    const { image, mimeType = "image/jpeg", scanType = "fridge", language = "es" } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Missing image data" });
    }

    // Strip prefix if user passed data:image/...;base64,...
    const base64Data = image.includes(",") ? image.split(",")[1] : image;
    const ai = getGeminiClient();

    if (!ai) {
      // Return smart fallback items in case API key is not configured
      const fallbackItems = [
        {
          name: language === "es" ? "Yogur natural" : (language === "bg" ? "Кисело мляко" : "Plain Yogurt"),
          quantity: 2,
          unit: "uds",
          category: "Dairy",
          estimatedDaysUntilExpiry: 7,
          approximateCostEUR: 1.4,
          confidence: "high"
        },
        {
          name: language === "es" ? "Huevos frescos" : (language === "bg" ? "Яйца" : "Fresh Eggs"),
          quantity: 6,
          unit: "pcs",
          category: "Dairy",
          estimatedDaysUntilExpiry: 14,
          approximateCostEUR: 1.6,
          confidence: "high"
        },
        {
          name: language === "es" ? "Tomates frescos" : (language === "bg" ? "Пресни домати" : "Fresh Tomatoes"),
          quantity: 4,
          unit: "pcs",
          category: "Produce",
          estimatedDaysUntilExpiry: 5,
          approximateCostEUR: 1.2,
          confidence: "medium"
        }
      ];
      return res.json({ items: fallbackItems, source: "mock_fallback" });
    }

    const promptText = `You are BalkanBite AI Computer Vision. You are analyzing an image of a ${scanType} (fridge, pantry shelf, groceries, or receipt).
Identify and extract every visible food item, beverage, condiment, or ingredient.
Target language for names: ${language === "bg" ? "Bulgarian" : (language === "es" ? "Spanish" : "English")}.

For each detected item:
- "name": clearly identifiable concise food name in ${language}.
- "quantity": estimated number (e.g. 1, 2, 500, 6).
- "unit": unit appropriate for this item (e.g. "pcs", "g", "kg", "ml", "L", "pack", "can").
- "category": one of ["Produce", "Dairy", "Meat/Fish", "Pantry", "Bakery", "Spices", "Other"].
- "estimatedDaysUntilExpiry": realistic number of days until expiry from today (e.g., fresh greens 3-5 days, dairy/milk 5-8 days, cheese 14-21 days, eggs 14 days, cooked dishes 3 days, dry pasta/rice 180 days, canned items 365 days).
- "approximateCostEUR": realistic estimated cost per unit in EUR (€).
- "confidence": "high" | "medium" | "low".

Return strictly a JSON array conforming to this schema, with no markdown code fences:
[
  {
    "name": "string",
    "quantity": number,
    "unit": "string",
    "category": "Produce" | "Dairy" | "Meat/Fish" | "Pantry" | "Bakery" | "Spices" | "Other",
    "estimatedDaysUntilExpiry": number,
    "approximateCostEUR": number,
    "confidence": "high" | "medium" | "low"
  }
]`;

    const imagePart = {
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: base64Data,
      },
    };

    const response = await generateWithRetry(ai, {
      model: "gemini-3.8-flash",
      contents: {
        parts: [imagePart, { text: promptText }],
      },
      config: {
        responseMimeType: "application/json",
      },
    });

    let items = [];
    try {
      items = JSON.parse(response.text || "[]");
    } catch {
      items = [];
    }

    return res.json({ items: Array.isArray(items) ? items : [], source: "gemini_vision" });
  } catch (err: any) {
    console.warn("Gemini Vision transient/quota error, using resilient visual fallback:", err.message || err);
    const fallbackItems = [
      {
        name: req.body?.language === "es" ? "Alimento detectado" : (req.body?.language === "bg" ? "Открита храна" : "Detected Grocery"),
        quantity: 1,
        unit: "pack",
        category: "Produce",
        estimatedDaysUntilExpiry: 5,
        approximateCostEUR: 1.5,
        confidence: "medium"
      }
    ];
    return res.json({ items: fallbackItems, source: "resilient_fallback", error: err.message });
  }
});

// Endpoint: Barcode Lookup via Open Food Facts with AI Enrichment
app.get("/api/barcode/:code", async (req, res) => {
  const { code } = req.params;
  const language = (req.query.lang as string) || "es";

  try {
    const offUrl = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`;
    const offRes = await fetch(offUrl, {
      headers: { "User-Agent": "BalkanBite - FoodApp/1.0 (info@balkanbite.app)" },
    });

    if (offRes.ok) {
      const data = await offRes.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        const rawName = p.product_name_es || p.product_name || p.product_name_en || p.brands || "Producto escaneado";
        const categoryTags = (p.categories_tags || []).join(" ").toLowerCase();
        
        let category: "Produce" | "Dairy" | "Meat/Fish" | "Pantry" | "Bakery" | "Spices" | "Other" = "Pantry";
        if (categoryTags.includes("dair") || categoryTags.includes("lait") || categoryTags.includes("queso") || categoryTags.includes("yog")) {
          category = "Dairy";
        } else if (categoryTags.includes("meat") || categoryTags.includes("viande") || categoryTags.includes("fish") || categoryTags.includes("poisson") || categoryTags.includes("carne")) {
          category = "Meat/Fish";
        } else if (categoryTags.includes("fruit") || categoryTags.includes("vegetab") || categoryTags.includes("legum") || categoryTags.includes("verdura")) {
          category = "Produce";
        } else if (categoryTags.includes("bread") || categoryTags.includes("pan") || categoryTags.includes("boulang")) {
          category = "Bakery";
        }

        return res.json({
          found: true,
          barcode: code,
          name: rawName,
          brand: p.brands || "",
          quantity: 1,
          unit: "pcs",
          category,
          nutriscore: p.nutriscore_grade?.toUpperCase() || null,
          imageUrl: p.image_front_small_url || p.image_url || null,
          estimatedDaysUntilExpiry: category === "Dairy" ? 10 : (category === "Produce" ? 5 : (category === "Bakery" ? 4 : 60)),
          source: "openfoodfacts",
        });
      }
    }

    // Fallback if not in Open Food Facts: AI prediction based on barcode or fallback
    return res.json({
      found: false,
      barcode: code,
      name: `Producto (${code.slice(-4)})`,
      quantity: 1,
      unit: "pcs",
      category: "Pantry",
      estimatedDaysUntilExpiry: 30,
      source: "fallback",
    });
  } catch (err: any) {
    console.error("Barcode lookup error:", err);
    return res.status(500).json({ error: "Failed to lookup barcode" });
  }
});

// Serve legal pages directly
app.get(["/privacy", "/privacy.html"], (_req, res) => {
  const privacyPath = path.join(process.cwd(), "public", "privacy.html");
  if (fs.existsSync(privacyPath)) {
    return res.sendFile(privacyPath);
  }
  return res.redirect("/");
});

app.get(["/terms", "/terms.html"], (_req, res) => {
  const termsPath = path.join(process.cwd(), "public", "terms.html");
  if (fs.existsSync(termsPath)) {
    return res.sendFile(termsPath);
  }
  return res.redirect("/");
});

// Vite middleware / production serving
async function startServer() {
  const distIndexPath = path.join(process.cwd(), "dist", "index.html");
  const isProd = process.env.NODE_ENV === "production" && fs.existsSync(distIndexPath);

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(distIndexPath);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BalkanBite server running on port ${PORT}`);
  });
}

// Only listen when executed directly in container / dev mode, not as a Vercel serverless function
if (!process.env.VERCEL) {
  startServer();
}

export default app;
