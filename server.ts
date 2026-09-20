import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { buildAiCulinaryProfileContext } from "./src/utils/aiCulinaryProfileContext";

dotenv.config();

const app = express();
const PORT = 3000;
const OPENAI_MODEL = "gpt-5.6-luna" as const;
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

app.use(express.json({ limit: "15mb" }));

function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function extractOpenAIOutputText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  const chunks: string[] = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    if (item?.type !== "message" || !Array.isArray(item?.content)) continue;
    for (const content of item.content) {
      if (content?.type === "output_text" && typeof content?.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("").trim();
}

function isOpenAITransientStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

interface OpenAIResponseRequest {
  input: unknown;
  instructions?: string;
  json?: boolean;
}

async function generateWithOpenAI(
  params: OpenAIResponseRequest,
  maxAttempts = 2,
): Promise<{ text: string; model: string; responseId?: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const error: any = new Error("OPENAI_API_KEY is not configured");
    error.status = 503;
    throw error;
  }

  let lastError: unknown;
  let delayMs = 600;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const requestBody: Record<string, unknown> = {
        model: OPENAI_MODEL,
        input: params.input,
        store: false,
      };

      if (params.instructions) {
        requestBody.instructions = params.instructions;
      }
      if (params.json) {
        requestBody.text = { format: { type: "json_object" } };
      }

      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const raw = await response.text();
      let payload: any = null;
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const message =
          payload?.error?.message ||
          `OpenAI Responses API returned HTTP ${response.status}`;
        const error: any = new Error(message);
        error.status = response.status;
        throw error;
      }

      const text = extractOpenAIOutputText(payload);
      if (!text) {
        throw new Error("OpenAI Responses API returned no output text");
      }

      return {
        text,
        model: typeof payload?.model === "string" ? payload.model : OPENAI_MODEL,
        responseId: typeof payload?.id === "string" ? payload.id : undefined,
      };
    } catch (error: any) {
      lastError = error;
      const status = Number(error?.status) || 0;
      const retryable =
        isOpenAITransientStatus(status) ||
        /rate limit|temporar|timeout|overload|unavailable/i.test(
          String(error?.message || ""),
        );

      if (!retryable || attempt >= maxAttempts) {
        break;
      }

      console.warn(
        `OpenAI API notice on ${OPENAI_MODEL} (attempt ${attempt}/${maxAttempts}):`,
        error?.message || error,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 1.5;
    }
  }

  throw lastError;
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    aiConfigured: hasOpenAIKey(),
    aiProvider: "openai",
    aiModel: OPENAI_MODEL,
  });
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
  {
    id: "rec-chicken-tomato",
    title: {
      en: "Juicy Chicken Breast in Savory Garlic Tomato Sauce",
      bg: "Сочни Пилешки Гърди в Доматен Сос с Чесън",
      es: "Pechugas de Pollo Jugosas en Salsa de Tomate y Ajo",
    },
    description: {
      en: "Tender chicken breast sautéed with rich ripe tomatoes, garlic, and fresh oregano.",
      bg: "Нежни пилешки гърди, задушени с узрели домати и ароматен чесън.",
      es: "Pechugas de pollo tiernas cocinadas a fuego lento con tomate natural y toque de ajo.",
    },
    prepTimeMin: 10,
    cookTimeMin: 15,
    costPerServingEUR: 1.85,
    difficulty: "easy",
    servings: 2,
    calories: 420,
    proteinG: 38,
    carbsG: 12,
    fatG: 14,
    fiberG: 3,
    healthScore: 92,
    tags: ["Proteico", "Bajo en Carbos", "Pollo", "Saludable"],
    imageUrl: "https://images.unsplash.com/photo-1604908176997-125f2596f37c?w=800",
    ingredients: [
      { name: "Pechugas de pollo", amount: 350, unit: "g", inPantry: true },
      { name: "Tomate", amount: 2, unit: "uds", inPantry: true },
      { name: "Ajo en polvo", amount: 1, unit: "cdta", inPantry: true },
      { name: "Aceite de oliva virgen", amount: 1, unit: "cda", inPantry: true },
      { name: "Orégano seco", amount: 1, unit: "cdta", inPantry: false },
    ],
    instructions: {
      en: [
        "Slice chicken breasts into fillets and season with salt and garlic powder.",
        "Brown chicken in olive oil for 3-4 minutes per side.",
        "Add diced tomatoes and oregano, simmering for 10 minutes until chicken is tender.",
      ],
      bg: [
        "Нарежете пилешкото на филета и подправете със сол и чесън на прах.",
        "Запържете в зехтин за 3-4 минути от всяка страна.",
        "Добавете нарязаните домати и риган и оставете да покъкри 10 минути.",
      ],
      es: [
        "Corta las pechugas de pollo en filetes y salpimenta con ajo en polvo.",
        "Dora el pollo en una sartén con aceite de oliva durante 3-4 minutos por lado.",
        "Añade los tomates picados y el orégano, dejando reducir a fuego suave 10 minutos.",
      ],
    },
    nutritionHighlights: {
      en: "38g muscle-building lean protein with zero added sugars.",
      bg: "38г чист протеин за мускулно възстановяване без добавена захар.",
      es: "38g de proteína magra pura para la recuperación muscular.",
    },
  },
  {
    id: "rec-creamy-macaroni",
    title: {
      en: "Creamy Garlic Macaroni with Refreshing Cucumber",
      bg: "Кремообразни Макарони с Чесън и Свежа Краставица",
      es: "Macarrones Cremosos al Ajo con Queso Crema y Pepino",
    },
    description: {
      en: "Comforting pasta coated in a velvety cream cheese sauce served with fresh cucumber slices.",
      bg: "Апетитна паста с сос от крем сирене и чесън, гарнирана с пресна краставица.",
      es: "Pasta corta bañada en suave crema de queso y ajo con guarnición de pepino fresco.",
    },
    prepTimeMin: 5,
    cookTimeMin: 10,
    costPerServingEUR: 0.95,
    difficulty: "easy",
    servings: 2,
    calories: 480,
    proteinG: 18,
    carbsG: 60,
    fatG: 18,
    fiberG: 4,
    healthScore: 84,
    tags: ["Rápido 15 min", "Económico", "Pasta"],
    imageUrl: "https://images.unsplash.com/photo-1621996346565-e3d5d6281699?w=800",
    ingredients: [
      { name: "Macarrones", amount: 200, unit: "g", inPantry: true },
      { name: "Queso crema tipo Philadelphia", amount: 80, unit: "g", inPantry: true },
      { name: "Ajo en polvo", amount: 1, unit: "cdta", inPantry: true },
      { name: "Pepino", amount: 1, unit: "ud", inPantry: true },
      { name: "Queso parmesano", amount: 20, unit: "g", inPantry: false },
    ],
    instructions: {
      en: [
        "Boil macaroni in salted water for 8 minutes.",
        "Melt cream cheese with 3 tbsp pasta water and garlic powder.",
        "Toss pasta in sauce and serve with sliced cucumber.",
      ],
      bg: [
        "Сварете макароните в подсолена вода за 8 минути.",
        "Разбъркайте крем сиренето с малко от водата на пастата и чесън.",
        "Объркайте макароните със соса и сервирайте с резени краставица.",
      ],
      es: [
        "Cuece los macarrones en agua con sal durante 8 minutos.",
        "Mezcla el queso crema con 3 cucharadas del agua de cocción y ajo en polvo.",
        "Mezcla la pasta con la crema de queso y sirve junto con el pepino en rodajas.",
      ],
    },
    nutritionHighlights: {
      en: "Rich energy source with digestive comfort.",
      bg: "Богат източник на енергия и калций.",
      es: "Fuente rápida de energía y calcio con equilibrio de carbohidratos.",
    },
  },
  {
    id: "rec-med-lentil-zucchini",
    title: {
      en: "Mediterranean Lentil & Zucchini Stew",
      bg: "Средиземноморска Леща с Тиквички",
      es: "Guiso Mediterráneo de Lentejas y Calabacín",
    },
    description: {
      en: "A fiber-dense stew using simple legumes and fresh zucchini.",
      bg: "Питателна леща с тиквички и чесън.",
      es: "Un guiso rico en fibra y proteína vegetal utilizando lentejas y calabacín.",
    },
    prepTimeMin: 10,
    cookTimeMin: 20,
    costPerServingEUR: 0.85,
    difficulty: "easy",
    servings: 2,
    calories: 420,
    proteinG: 22,
    carbsG: 65,
    fatG: 8,
    fiberG: 16,
    healthScore: 95,
    tags: ["Alto en Fibra", "Vegano", "Económico"],
    imageUrl: "/images/lentil_soup_balkan_style_1789192381584.jpg",
    ingredients: [
      { name: "Lentejas", amount: 200, unit: "g", inPantry: true },
      { name: "Calabacín", amount: 1, unit: "ud", inPantry: true },
      { name: "Ajo en polvo", amount: 1, unit: "cdta", inPantry: true },
      { name: "Aceite de oliva", amount: 1, unit: "cda", inPantry: true },
    ],
    instructions: {
      en: [
        "Boil lentils for 18 mins.",
        "Sauté zucchini with garlic and olive oil.",
        "Combine lentils with zucchini and simmer for 3 mins.",
      ],
      bg: [
        "Сварете лещата за 18 минути.",
        "Задушете тиквичката с чесън.",
        "Смесете с лещата и покъкрете 3 минути.",
      ],
      es: [
        "Cuece las lentejas durante 18 minutos.",
        "Sofríe el calabacín en dados con el ajo en polvo y aceite.",
        "Mezcla las lentejas con el calabacín y cocina 3 minutos juntos.",
      ],
    },
    nutritionHighlights: {
      en: "High prebiotic fiber for gut microbiome health.",
      bg: "Богата на пребиотични фибри за добра микробиома.",
      es: "Excelente aporte de fibra prebiótica para la salud intestinal.",
    },
  },
  {
    id: "rec-balkan-shopska-salad",
    title: {
      en: "Classic Shopska Salad with Fresh Tomato & Feta",
      bg: "Класическа Шопска Салата с Домати и Сирене",
      es: "Ensalada Shopska Balcánica con Pepino, Tomate y Queso",
    },
    description: {
      en: "The iconic Balkan salad: crispy cucumbers, ripe tomatoes, onions, and shredded white feta.",
      bg: "Традиционна шопска салата с пресни домати, краставици и настъргано сирене.",
      es: "La ensalada tradicional de los Balcanes: pepino crujiente, tomate, cebolla y abundante queso rayado.",
    },
    prepTimeMin: 10,
    cookTimeMin: 0,
    costPerServingEUR: 1.10,
    difficulty: "easy",
    servings: 2,
    calories: 230,
    proteinG: 10,
    carbsG: 12,
    fatG: 16,
    fiberG: 4,
    healthScore: 96,
    tags: ["Ensalada", "Sin Fuego", "Fresca", "Vegetariano"],
    imageUrl: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800",
    ingredients: [
      { name: "Pepino", amount: 2, unit: "uds", inPantry: true },
      { name: "Tomate", amount: 2, unit: "uds", inPantry: true },
      { name: "Cebolla", amount: 0.5, unit: "ud", inPantry: true },
      { name: "Queso blanco o Feta", amount: 100, unit: "g", inPantry: true },
      { name: "Aceite de oliva virgen", amount: 1, unit: "cda", inPantry: true },
    ],
    instructions: {
      en: [
        "Chop tomatoes and cucumbers into medium bite-sized pieces.",
        "Thinly slice the onion.",
        "Combine vegetables in a bowl with olive oil and salt.",
        "Grate white cheese generously over the top before serving.",
      ],
      bg: [
        "Нарежете доматите и краставиците на кубчета.",
        "Нарязания лук добавете към зеленчуците.",
        "Подправете със зехтин и сол.",
        "Настържете сирене отгоре.",
      ],
      es: [
        "Corta los tomates y pepinos en dados de tamaño mediano.",
        "Pica la cebolla finamente.",
        "Mezcla las hortalizas en un bol con aceite de oliva virgen y sal.",
        "Ralla abundantemente el queso blanco por encima antes de servir.",
      ],
    },
    nutritionHighlights: {
      en: "Hydrating electrolytes, antioxidants, and calcium.",
      bg: "Богата на електролити, антиоксиданти и калций.",
      es: "Altamente hidratante, rica en antioxidantes y calcio natural.",
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

// Fallback reconciliation parser when the AI API is unavailable
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
      for (const neg of (negations || [])) {
        const negIdx = String(lower || "").indexOf(String(neg || ""));
        const itemIdx = String(lower || "").indexOf(String(itemName || ""));
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
    if (!hasOpenAIKey()) {
      return res.status(503).json({
        success: false,
        error: "Voice interpretation is temporarily unavailable",
        actionType: "ANSWER",
        items: [],
        mealLog: null,
      });
    }

    const systemPrompt = `You are a food-planning assistant and cooking helper for BalkanBite.
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
- IF user reports meals, do not calculate or invent calories, protein, carbs, fat, or other nutrition values. Set "mealLog" to null and explain that nutrition logging needs verified data before it can be saved.
- Never claim that a meal, pantry item, or nutrition value was saved unless the client explicitly confirms that action.

Return strictly JSON format:
{
  "actionType": "MEAL_LOG" | "RECIPE_RECOMMENDATION" | "ADD_ITEMS" | "REMOVE_ITEMS" | "ADD_SHOPPING" | "ANSWER",
  "spokenFeedback": "Complete, friendly nutritionist response addressing all user points in ${language}.",
  "items": [{ "name": "string", "quantity": number, "unit": "string", "category": "Produce"|"Dairy"|"Meat/Fish"|"Pantry/Grains"|"Spices"|"Other" }],
  "mealLog": null
}`;

    const response = await generateWithOpenAI({
      input: transcript,
      instructions: systemPrompt,
      json: true,
    });

    const parsed = JSON.parse(response.text || "{}");
    // Nutrition from free-form voice text is not authoritative. Until BalkanBite
    // has a verified deterministic nutrition path, meal logs cannot be persisted here.
    if (parsed.actionType === "MEAL_LOG") {
      parsed.mealLog = null;
    }
    if (!parsed.spokenFeedback) {
      parsed.spokenFeedback =
        language === "bg"
          ? "Разбрах заявката. Няма да записвам непотвърдени хранителни стойности."
          : language === "es"
          ? "He entendido la solicitud. No guardaré valores nutricionales no verificados."
          : "I understood the request. I will not save unverified nutrition values.";
    }
    return res.json({ success: true, ...parsed });
  } catch (err: any) {
    console.warn("OpenAI API error during voice intent parse:", err.message || err);
    return res.status(503).json({
      success: false,
      error: "Voice interpretation failed",
      actionType: "ANSWER",
      items: [],
      mealLog: null,
    });
  }
});

// Endpoint: Voice Shopping Reconciliation
app.post("/api/ai/reconcile-shopping", async (req, res) => {
  const { transcript, currentShoppingList = [], language = "es" } = req.body || {};
  if (!transcript || typeof transcript !== "string") {
    return res.status(400).json({ error: "Transcript is required" });
  }

  try {
    if (!hasOpenAIKey()) {
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

    const response = await generateWithOpenAI({
      input: transcript,
      instructions: systemPrompt,
      json: true,
    });

    const parsed = JSON.parse(response.text || "{}");
    if (!parsed.spokenFeedback) {
      parsed.spokenFeedback = fallbackReconcileShopping(transcript, currentShoppingList, language).spokenFeedback;
    }
    return res.json(parsed);
  } catch (err: any) {
    console.warn("OpenAI API error in reconcile-shopping, using fallback:", err.message || err);
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

    if (!hasOpenAIKey()) {
      return res.status(503).json({
        error: "Recipe generation is temporarily unavailable",
        recipes: [],
      });
    }

    const culinaryProfile = buildAiCulinaryProfileContext(profile);

    const prompt = `Generate 6 to 8 distinct, delicious, healthy, balanced and inexpensive recipes.
Primary Language: ${language === "bg" ? "Bulgarian (български)" : language === "es" ? "Spanish (Español)" : "English"}.
User Current Pantry Inventory: ${JSON.stringify(pantry)}.
User culinary preferences (non-clinical): ${JSON.stringify(culinaryProfile)}.
Specific user craving / voice query: "${query || "Recipes maximizing my pantry inventory"}".
Do not infer medical conditions, nutrient deficiencies, calorie targets, weight-loss prescriptions or therapeutic diets from this context.
Allergy/dislike entries are avoidance context only; do not claim the generated recipe is medically or allergen safe.

CRITICAL GOALS & RULES:
1. MAXIMIZE PANTRY INVENTORY USAGE: Generate recipes that systematically cover and utilize ALL items present in the User's Current Pantry Inventory. Create a full set of 6 to 8 varied recipes (breakfasts, lunches, dinners, stews, salads, quick pasta/rice dishes, snacks) so that virtually every single ingredient in the user's pantry is used in one or more recipes.
2. MISSING INGREDIENTS DETECTION: For any ingredient not currently in the user's pantry, set "inPantry": false clearly so the user can see what's missing and add them to their shopping list with 1 click.
3. IN-PANTRY INGREDIENTS: For ingredients that ARE in the user's pantry, set "inPantry": true.
4. Balance macros: Ensure good protein, high fiber, healthy fats, reasonable carbs.
5. Estimate cost per serving for planning only. It is NOT live, exact, or verified market pricing.
6. Calories, protein, carbs, fat, fiber and any nutrition highlights are estimates only; do not describe them as measured, verified, medical, or exact.
7. Emphasize wholesome Balkan/Mediterranean simplicity (savory herbs like chubritsa/dill, fresh produce, fermented probiotics like yogurt, legumes).
8. Always provide high-quality localized translations for 'es' (Spanish), 'bg' (Bulgarian), and 'en' (English) in title, description, instructions, and nutrition highlights.

Return strictly a JSON array of 6 to 8 recipe objects conforming to this schema:
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

    const response = await generateWithOpenAI({
      input: prompt,
      json: true,
    });

    const parsed = JSON.parse(response.text || "[]");
    const rawList: any[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.recipes)
      ? parsed.recipes
      : [];
    if (rawList.length === 0) {
      return res.status(502).json({
        error: "Recipe generation returned no usable recipes",
        recipes: [],
      });
    }
    const enrichedRecipes = rawList.map((rec: any, idx: number) => ({
      ...rec,
      // LLM-produced nutrition and price figures are planning estimates, never
      // authoritative calculations. Arbitrary health scores are discarded.
      healthScore: undefined,
      nutritionDataStatus: "estimated",
      costDataStatus: "estimated",
      id: rec.id || `ai-rec-${Date.now()}-${idx}`,
      imageUrl: resolveRecipeImageUrl(rec),
    }));

    return res.json({
      recipes: enrichedRecipes,
      source: "openai_gpt_5_6_luna",
    });
  } catch (err: any) {
    console.error("Error generating recipes:", err);
    return res.status(503).json({
      error: "Recipe generation failed",
      recipes: [],
    });
  }
});

// Endpoint: AI Smart 7-Day Weekly Meal Plan using GPT-5.6 Luna
app.post("/api/ai/generate-weekly-plan", async (req, res) => {
  const { pantry = [], recipes = [], profile = {}, language = "es" } = req.body || {};
  try {
    if (!hasOpenAIKey()) {
      return res.status(400).json({ error: "OpenAI API key not configured" });
    }

    const culinaryProfile = buildAiCulinaryProfileContext(profile);

    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }

    const prompt = `You are a Balkan and Mediterranean culinary meal-planning assistant. 
Think carefully and generate a complete, balanced 7-day weekly meal plan for the dates: ${JSON.stringify(dates)}.
Language: ${language}.
User Pantry Inventory: ${JSON.stringify(pantry)}.
Available Recipes Pool: ${JSON.stringify(recipes.map((r: any) => ({ id: r.id, title: r.title, tags: r.tags, calories: r.calories, ingredients: r.ingredients } )))}.
User culinary preferences (non-clinical): ${JSON.stringify(culinaryProfile)}.
Do not infer disease, nutrient deficiency, calorie targets, weight-loss prescriptions or therapeutic diets from these preferences.

CRITICAL RULES:
1. PANTRY OPTIMIZATION (ZERO WASTE): Strongly prioritize recipes and ingredients that are already present in the User Pantry Inventory to minimize unnecessary shopping and prevent food waste.
2. Breakfast (desayuno) MUST BE STRICTLY LIGHT breakfast foods (e.g. toasts, eggs, yogurt, oatmeal, fruit, smoothie). NEVER assign heavy stews (guisos), chickpea stews, lentil stews, or chicken breast main dishes to breakfast!
3. Lunch and Dinner must be satisfying, balanced recipes from the available recipe pool or logically created matching their pantry.
4. Return strictly a JSON array of 7 objects (one for each date in order) conforming to this schema:
[
  {
    "date": "YYYY-MM-DD",
    "breakfast": { /* recipe object */ },
    "lunch": { /* recipe object */ },
    "dinner": { /* recipe object */ }
  }
]`;

    const response = await generateWithOpenAI({
      input: prompt,
      json: true,
    });

    const parsed = JSON.parse(response.text || "[]");
    const rawPlan = Array.isArray(parsed) ? parsed : [];
    
    // Ensure image URLs are resolved for each meal
    const mealPlan = rawPlan.map((day: any) => ({
      date: day.date,
      breakfast: day.breakfast ? { ...day.breakfast, imageUrl: resolveRecipeImageUrl(day.breakfast) } : undefined,
      lunch: day.lunch ? { ...day.lunch, imageUrl: resolveRecipeImageUrl(day.lunch) } : undefined,
      dinner: day.dinner ? { ...day.dinner, imageUrl: resolveRecipeImageUrl(day.dinner) } : undefined,
    }));

    return res.json({ mealPlan, source: "openai_gpt_5_6_luna" });
  } catch (err: any) {
    console.warn("Error generating weekly meal plan with OpenAI GPT-5.6 Luna:", err?.message || err);
    return res.status(503).json({
      error: "Weekly meal-plan generation failed",
      mealPlan: [],
    });
  }
});

// Endpoint: AI Smart Weekly Shopping List Proposal
app.post("/api/ai/suggest-shopping", async (req, res) => {
  const { pantry = [], profile = {}, language = "es" } = req.body || {};
  try {
    // AI unavailability is not a valid product or price detection. Keep the
    // response explicitly empty so clients cannot save a fabricated basket.
    if (!hasOpenAIKey()) {
      return res.status(503).json({
        error: "Shopping suggestions are temporarily unavailable",
        items: [],
      });
    }

    const culinaryProfile = buildAiCulinaryProfileContext(profile);

    const targetLangName =
      language === "bg"
        ? "Bulgarian"
        : language === "es"
        ? "Spanish (Español)"
        : "English";

    const prompt = `You are BalkanBite AI. The user wants an intelligent, highly balanced, nutritious, and cost-effective weekly grocery shopping list.
Current Pantry contents: ${JSON.stringify(pantry)}.
User culinary preferences (non-clinical): ${JSON.stringify(culinaryProfile)}.
Target Language: ${targetLangName}.

CRITICAL LANGUAGE REQUIREMENT:
All text including "title", every item "name", item "unit", item "reason", and "aiReasoning" MUST BE WRITTEN 100% IN ${targetLangName.toUpperCase()}.
If Target Language is Spanish, write every ingredient name in Spanish (e.g. "Yogur natural", "Tomates maduros", "Huevos camperos", "Pepinos", "Ajo fresco", "Queso Feta"). NEVER return English ingredient names when target language is Spanish.

Suggest 7 to 10 varied, budget-conscious staple items that complement the current pantry and culinary preferences.
Do not infer nutrient deficiencies, disease, health status, calorie targets or therapeutic needs from pantry contents or profile preferences.
If you include estimatedPriceEUR, it is an unverified planning estimate only; never describe it as live, exact, or verified.

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

    const response = await generateWithOpenAI({
      input: prompt,
      json: true,
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (err: any) {
    console.warn("OpenAI API error during shopping suggestion:", err.message || err);
    return res.status(503).json({
      error: "Shopping suggestions are temporarily unavailable",
      items: [],
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
    if (!hasOpenAIKey()) {
      // AI unavailability is not a detection. Preserve the no-result boundary.
      return res.status(503).json({
        success: false,
        error: "AI vision scanner is temporarily unavailable",
        items: [],
      });
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

    const response = await generateWithOpenAI({
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: promptText },
            {
              type: "input_image",
              image_url: `data:${mimeType || "image/jpeg"};base64,${base64Data}`,
            },
          ],
        },
      ],
      json: true,
    });

    let items = [];
    try {
      items = JSON.parse(response.text || "[]");
    } catch {
      items = [];
    }

    return res.json({
      success: true,
      items: Array.isArray(items) ? items : [],
      source: "openai_gpt_5_6_luna_vision",
    });
  } catch (err: any) {
    console.warn("OpenAI GPT-5.6 Luna vision scan failed:", err.message || err);
    return res.status(503).json({
      success: false,
      error: "AI vision scan failed",
      items: [],
    });
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

    // A missing lookup is not a product detection and must not create a pantry candidate.
    return res.json({ found: false });
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
