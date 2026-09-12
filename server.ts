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
 * Robust wrapper for Gemini API calls to handle transient 503/429 errors
 * Includes multi-model fallback (gemini-3.8-flash -> gemini-3.1-flash-lite -> gemini-flash-latest)
 */
async function generateWithRetry(ai: any, params: any, maxRetriesPerModel = 2) {
  const primaryModel = params.model || "gemini-3.8-flash";
  const fallbackModels = [primaryModel, "gemini-3.1-flash-lite", "gemini-flash-latest"];
  const modelsToTry = Array.from(new Set(fallbackModels));

  let lastError;

  for (const modelName of modelsToTry) {
    let delay = 1000;
    const currentParams = { ...params, model: modelName };

    for (let i = 0; i < maxRetriesPerModel; i++) {
      try {
        return await ai.models.generateContent(currentParams);
      } catch (err: any) {
        lastError = err;
        const errorStr = JSON.stringify(err);
        const isRetryable =
          errorStr.includes("503") ||
          errorStr.includes("429") ||
          err.message?.includes("503") ||
          err.message?.includes("429") ||
          err.status === 503 ||
          err.status === 429;

        if (isRetryable) {
          console.warn(`Gemini API transient error on ${modelName} (attempt ${i + 1}):`, err.message || err);
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
      return res.json({
        recipes: FALLBACK_RECIPES,
        source: "curated_fallback",
        note: "Add Gemini API Key in Settings > Secrets for endless dynamic recipes from your specific pantry!",
      });
    }

    const prompt = `Generate 3 distinct, delicious, healthy, balanced and inexpensive recipes.
Language: ${language === "bg" ? "Bulgarian (titles and instructions in Bulgarian)" : "English"}.
User Current Pantry: ${JSON.stringify(pantry)}.
User Taste Profile & Preferences:
- Cooking Level/Speed: ${profile.cookingSpeed || "fast 15-20 min"}
- Health Goal: ${profile.healthGoal || "balanced & gut-health"}
- Diet Style: ${profile.dietStyle || "Mediterranean & Balkan balanced"}
- Disliked/Allergies: ${JSON.stringify(profile.disliked || [])}
- Budget constraint: ${profile.budgetConstraint || "Very budget friendly (< 1.5-2 EUR per serving)"}
- Household size: ${profile.servings || 2} servings
- Specific user craving / voice query: "${query || "Healthy, cheap, balanced dinner using my pantry"}"

User Language: ${language || "es"}

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
    return res.json({
      recipes: Array.isArray(parsed) ? parsed : (parsed.recipes || FALLBACK_RECIPES),
      source: "gemini",
    });
  } catch (err: any) {
    console.error("Error generating recipes:", err);
    return res.json({
      recipes: FALLBACK_RECIPES,
      source: "fallback_error",
      error: err.message,
    });
  }
});

// Endpoint: AI Smart Weekly Shopping List Proposal
app.post("/api/ai/suggest-shopping", async (req, res) => {
  try {
    const { pantry = [], profile = {}, language = "en" } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        title: language === "bg" ? "Седмичен балансиран списък (Икономичен)" : "Weekly Balanced Smart Basket (Budget-Friendly)",
        totalEstimatedEUR: 12.5,
        items: [
          { name: language === "bg" ? "Българско кисело мляко 3.6%" : "Bulgarian Yogurt 3.6%", quantity: 2, unit: "pack", category: "Dairy", estimatedPriceEUR: 1.6 },
          { name: language === "bg" ? "Пресни краставици" : "Fresh Cucumbers", quantity: 1, unit: "kg", category: "Produce", estimatedPriceEUR: 1.4 },
          { name: language === "bg" ? "Розови домати" : "Bulgarian Pink Tomatoes", quantity: 1.5, unit: "kg", category: "Produce", estimatedPriceEUR: 2.3 },
          { name: language === "bg" ? "Бяло сирене (краве или смес)" : "Sirene Cheese (Cow or Mixed)", quantity: 400, unit: "g", category: "Dairy", estimatedPriceEUR: 3.0 },
          { name: language === "bg" ? "Яйца (размер L)" : "Free-range Eggs L", quantity: 10, unit: "pcs", category: "Dairy/Protein", estimatedPriceEUR: 2.1 },
          { name: language === "bg" ? "Пресен копър и магданоз" : "Fresh Dill & Parsley", quantity: 2, unit: "bunch", category: "Produce", estimatedPriceEUR: 0.9 },
          { name: language === "bg" ? "Орехови ядки" : "Walnut Halves", quantity: 100, unit: "g", category: "Pantry", estimatedPriceEUR: 1.0 },
        ],
        aiReasoning: language === "bg"
          ? "Този базов списък струва под 12.5€ и ви позволява да приготвите поне 6 питателни, богати на протеин и пробиотици хранения (Таратор, Миш-маш, Шопска салата)."
          : "This core basket costs under 12.5€ and enables at least 6 balanced, probiotic and protein-rich meals (Tarator, Mish-Mash, Fresh Salads).",
      });
    }

    const prompt = `You are BalkanBite AI. The user wants an intelligent, highly balanced, nutritious, and cost-effective weekly grocery shopping list.
Current Pantry contents: ${JSON.stringify(pantry)}.
User preferences: ${JSON.stringify(profile)}.
Target Language: ${language === "bg" ? "Bulgarian" : "English"}.

Identify the critical missing nutritional gaps (e.g. need lean protein, fermented dairy, fresh vitamin C vegetables, fiber legumes).
Suggest 7 to 10 high-value staple items that keep the total weekly basket under 20€ / $22.
Include accurate prices in EUR/USD.

Return strictly JSON with this schema:
{
  "title": "string",
  "totalEstimatedEUR": number,
  "aiReasoning": "string (explaining why these items create cheap, varied, and balanced meals)",
  "items": [
    {
      "name": "string",
      "quantity": number,
      "unit": "string",
      "category": "Produce" | "Dairy" | "Meat/Fish" | "Pantry/Grains" | "Spices" | "Other",
      "estimatedPriceEUR": number,
      "reason": "string (short health/balance reason)"
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
    console.error("Error suggesting shopping list:", err);
    return res.status(500).json({ error: "Failed to generate shopping list" });
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
    console.error("Error in AI visual scan:", err);
    return res.status(500).json({ error: "Failed to scan image", details: err.message });
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
