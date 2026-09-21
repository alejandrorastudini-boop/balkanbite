import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { buildAiCulinaryProfileContext } from "./src/utils/aiCulinaryProfileContext.js";
import { withOpenAIJsonModeInstruction } from "./src/utils/openAIJsonMode.js";
import { applyAiRecipeEstimateProvenance } from "./src/utils/aiRecipeProvenance.js";
import { validateAiRecipeStructure } from "./src/utils/aiRecipeValidation.js";
import { syncRecipesWithPantry } from "./src/utils/menuAutoPlanner.js";
import {
  buildWeeklyPlanAvailabilityPantry,
  buildWeeklyPlanRecipePromptContext,
} from "./src/utils/aiWeeklyPlanPantryAuthority.js";
import {
  getFoodSafetyQuarantineMessage,
  isFoodSafetyReviewRequired,
} from "./src/utils/foodSafetyQuarantine.js";

dotenv.config();

const app = express();
const PORT = 3000;
const OPENAI_MODEL = "gpt-5.6-luna" as const;
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

app.use(express.json({ limit: "15mb" }));

function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function foodRecommendationRequiresReview(
  profile: unknown,
  foodSafety: unknown,
): boolean {
  return (
    isFoodSafetyReviewRequired(profile) ||
    isFoodSafetyReviewRequired(foodSafety)
  );
}

function foodSafetyBlockedPayload(
  language: "en" | "es" | "bg",
  extra: Record<string, unknown>,
): Record<string, unknown> {
  return {
    code: "FOOD_SAFETY_REVIEW_REQUIRED",
    error: getFoodSafetyQuarantineMessage(language),
    ...extra,
  };
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
        input: params.json
          ? withOpenAIJsonModeInstruction(params.input)
          : params.input,
        store: false,
        reasoning: { effort: "low" },
        max_output_tokens: 16_000,
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

// A provider/configuration failure is never converted into purchase detections.
function shoppingReconciliationUnavailablePayload(language: string = "es") {
  const spokenFeedback =
    language === "bg"
      ? "Покупката не можа да бъде анализирана. Не са открити или записани покупки. Опитайте отново по-късно."
      : language === "es"
      ? "No se pudo analizar la compra. No se ha detectado ni guardado ninguna compra. Inténtalo de nuevo más tarde."
      : "The shopping trip could not be analyzed. No purchases were detected or saved. Please try again later.";

  return {
    success: false,
    error: "SHOPPING_RECONCILIATION_UNAVAILABLE",
    purchasedItemIds: [] as string[],
    unpurchasedItemIds: [] as string[],
    extraPurchasedItems: [] as any[],
    purchasedListItemsDetails: [] as any[],
    spokenFeedback,
  };
}

function shoppingReconciliationReviewMessage(language: string = "es") {
  return language === "bg"
    ? "Прегледайте предложеното съпоставяне преди да потвърдите промени в килера."
    : language === "es"
    ? "Revisa la propuesta antes de confirmar cambios en la despensa."
    : "Review the proposed reconciliation before confirming pantry changes.";
}

// Endpoint: Parse voice or typed AI request (Voice Chef)
app.post("/api/ai/parse-intent", async (req, res) => {
  const {
    transcript,
    currentPantry = [],
    mealLogs = [],
    conversationHistory = [],
    foodSafety = { status: "clear", reasons: [] },
    language = "en",
  } = req.body || {};
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
  "spokenFeedback": "Complete, friendly food-planning response addressing all user points in ${language}.",
  "items": [{ "name": "string", "quantity": number, "unit": "string", "category": "Produce"|"Dairy"|"Meat/Fish"|"Pantry/Grains"|"Spices"|"Other" }],
  "mealLog": null
}`;

    const response = await generateWithOpenAI({
      input: transcript,
      instructions: systemPrompt,
      json: true,
    });

    const parsed = JSON.parse(response.text || "{}");

    if (
      parsed.actionType === "RECIPE_RECOMMENDATION" &&
      isFoodSafetyReviewRequired(foodSafety)
    ) {
      return res.json({
        success: true,
        actionType: "ANSWER",
        spokenFeedback: getFoodSafetyQuarantineMessage(
          language === "bg" ? "bg" : language === "es" ? "es" : "en",
        ),
        items: [],
        mealLog: null,
        foodSafetyBlocked: true,
      });
    }

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
      return res
        .status(503)
        .json(shoppingReconciliationUnavailablePayload(language));
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
      parsed.spokenFeedback = shoppingReconciliationReviewMessage(language);
    }
    return res.json(parsed);
  } catch (err: any) {
    console.warn("OpenAI API error in reconcile-shopping:", err.message || err);
    return res
      .status(503)
      .json(shoppingReconciliationUnavailablePayload(language));
  }
});


// Endpoint: Generate dynamic tailored recipes based on pantry & preferences
app.post("/api/ai/generate-recipes", async (req, res) => {
  try {
    const {
      pantry = [],
      profile = {},
      foodSafety = { status: "clear", reasons: [] },
      query = "",
      language = "en",
    } = req.body;

    if (foodRecommendationRequiresReview(profile, foodSafety)) {
      return res.status(409).json(
        foodSafetyBlockedPayload(
          language === "bg" ? "bg" : language === "es" ? "es" : "en",
          { recipes: [] },
        ),
      );
    }

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
Disliked ingredients are ordinary culinary avoidance preferences only. Do not infer or claim allergen safety from this non-clinical context.

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
    const enrichedRecipes = rawList.flatMap((rec: any, idx: number) => {
      const withProvenance = applyAiRecipeEstimateProvenance(rec);
      const validated = validateAiRecipeStructure(
        withProvenance,
        `ai-rec-${Date.now()}-${idx}`,
      );
      if (!validated) return [];

      return [{
        ...validated,
        imageUrl: resolveRecipeImageUrl(validated),
      }];
    });

    if (enrichedRecipes.length === 0) {
      return res.status(502).json({
        error: "Recipe generation returned no structurally valid recipes",
        recipes: [],
      });
    }

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
  const {
    pantry = [],
    recipes = [],
    profile = {},
    foodSafety = { status: "clear", reasons: [] },
    language = "es",
  } = req.body || {};
  try {
    if (foodRecommendationRequiresReview(profile, foodSafety)) {
      return res.status(409).json(
        foodSafetyBlockedPayload(
          language === "bg" ? "bg" : language === "es" ? "es" : "en",
          { mealPlan: [] },
        ),
      );
    }

    if (!hasOpenAIKey()) {
      return res.status(400).json({ error: "OpenAI API key not configured" });
    }

    const culinaryProfile = buildAiCulinaryProfileContext(profile);
    const recipePromptContext = buildWeeklyPlanRecipePromptContext(recipes);
    const availabilityPantry = buildWeeklyPlanAvailabilityPantry(pantry);

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
Available Recipes Pool: ${JSON.stringify(recipePromptContext)}.
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

    const normalizePlannedMeal = (meal: unknown, fallbackId: string) => {
      const withProvenance = applyAiRecipeEstimateProvenance(meal);
      const validated = validateAiRecipeStructure(withProvenance, fallbackId);
      if (!validated) return null;

      const [syncedRecipe] = syncRecipesWithPantry(
        [validated],
        availabilityPantry as any,
      );
      const authoritativeRecipe = syncedRecipe || validated;

      return {
        ...authoritativeRecipe,
        imageUrl: resolveRecipeImageUrl(authoritativeRecipe),
      };
    };

    const mealPlan = rawPlan.flatMap((day: unknown, index: number) => {
      if (!day || typeof day !== "object" || Array.isArray(day)) return [];
      const record = day as Record<string, unknown>;
      const expectedDate = dates[index];
      if (!expectedDate || record.date !== expectedDate) return [];

      const breakfast = normalizePlannedMeal(
        record.breakfast,
        `ai-plan-${expectedDate}-breakfast`,
      );
      const lunch = normalizePlannedMeal(
        record.lunch,
        `ai-plan-${expectedDate}-lunch`,
      );
      const dinner = normalizePlannedMeal(
        record.dinner,
        `ai-plan-${expectedDate}-dinner`,
      );

      if (!breakfast || !lunch || !dinner) return [];
      return [{ date: expectedDate, breakfast, lunch, dinner }];
    });

    if (rawPlan.length !== dates.length || mealPlan.length !== dates.length) {
      return res.status(502).json({
        error: "Weekly meal-plan generation returned an incomplete or invalid plan",
        mealPlan: [],
      });
    }

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
  const {
    pantry = [],
    profile = {},
    foodSafety = { status: "clear", reasons: [] },
    language = "es",
  } = req.body || {};
  try {
    if (foodRecommendationRequiresReview(profile, foodSafety)) {
      return res.status(409).json(
        foodSafetyBlockedPayload(
          language === "bg" ? "bg" : language === "es" ? "es" : "en",
          { items: [] },
        ),
      );
    }

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
        const languageSpecificName =
          language === "bg"
            ? p.product_name_bg
            : language === "es"
              ? p.product_name_es
              : p.product_name_en;
        const rawName =
          languageSpecificName ||
          p.product_name ||
          p.product_name_en ||
          p.product_name_es ||
          p.product_name_bg;
        if (typeof rawName !== "string" || !rawName.trim()) {
          // Open Food Facts may know the barcode while lacking a usable product
          // name. Do not invent one or expose a saveable pantry candidate.
          return res.json({ found: false, reason: "missing_product_name" });
        }

        const categoryTags = Array.isArray(p.categories_tags)
          ? p.categories_tags.join(" ").toLowerCase()
          : "";

        let category:
          | "Produce"
          | "Dairy"
          | "Meat/Fish"
          | "Pantry"
          | "Bakery"
          | "Spices"
          | "Other"
          | undefined;
        if (categoryTags.includes("dair") || categoryTags.includes("lait") || categoryTags.includes("queso") || categoryTags.includes("yog")) {
          category = "Dairy";
        } else if (categoryTags.includes("meat") || categoryTags.includes("viande") || categoryTags.includes("fish") || categoryTags.includes("poisson") || categoryTags.includes("carne")) {
          category = "Meat/Fish";
        } else if (categoryTags.includes("fruit") || categoryTags.includes("vegetab") || categoryTags.includes("legum") || categoryTags.includes("verdura")) {
          category = "Produce";
        } else if (categoryTags.includes("bread") || categoryTags.includes("pan") || categoryTags.includes("boulang")) {
          category = "Bakery";
        } else if (categoryTags) {
          // The source has category evidence but it does not map to one of the
          // narrower BalkanBite groups.
          category = "Other";
        }

        return res.json({
          found: true,
          barcode: code,
          name: rawName.trim(),
          brand: typeof p.brands === "string" ? p.brands : "",
          ...(category ? { category } : {}),
          nutriscore: p.nutriscore_grade?.toUpperCase() || null,
          imageUrl: p.image_front_small_url || p.image_url || null,
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
