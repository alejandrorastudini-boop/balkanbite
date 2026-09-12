import { PantryItem, Recipe, ShoppingItem, UserProfile, MealPlanDay } from "../types";

export const INITIAL_PANTRY: PantryItem[] = [];

export const SAMPLE_PANTRY: PantryItem[] = [
  { id: "sp-1", name: "Huevos frescos", quantity: 6, unit: "uds", category: "Dairy", expiryDaysLeft: 10, estimatedCostEUR: 1.80, addedAt: new Date().toISOString().split("T")[0] },
  { id: "sp-2", name: "Queso crema tipo Philadelphia", quantity: 1, unit: "tarrina", category: "Dairy", expiryDaysLeft: 14, estimatedCostEUR: 1.65, addedAt: new Date().toISOString().split("T")[0] },
  { id: "sp-3", name: "Queso parmesano", quantity: 1, unit: "porción", category: "Dairy", expiryDaysLeft: 20, estimatedCostEUR: 2.10, addedAt: new Date().toISOString().split("T")[0] },
  { id: "sp-4", name: "Arroz", quantity: 1, unit: "paquete", category: "Pantry/Grains", expiryDaysLeft: 90, estimatedCostEUR: 1.20, addedAt: new Date().toISOString().split("T")[0] },
  { id: "sp-5", name: "Lentejas", quantity: 1, unit: "paquete", category: "Pantry/Grains", expiryDaysLeft: 90, estimatedCostEUR: 1.15, addedAt: new Date().toISOString().split("T")[0] },
  { id: "sp-6", name: "Macarrones", quantity: 1, unit: "paquete", category: "Pantry/Grains", expiryDaysLeft: 90, estimatedCostEUR: 0.95, addedAt: new Date().toISOString().split("T")[0] },
  { id: "sp-7", name: "Calabacín", quantity: 2, unit: "uds", category: "Produce", expiryDaysLeft: 5, estimatedCostEUR: 1.10, addedAt: new Date().toISOString().split("T")[0] },
  { id: "sp-8", name: "Pepino", quantity: 2, unit: "uds", category: "Produce", expiryDaysLeft: 6, estimatedCostEUR: 0.85, addedAt: new Date().toISOString().split("T")[0] },
  { id: "sp-9", name: "Bacon ahumado", quantity: 1, unit: "paquete", category: "Meat/Fish", expiryDaysLeft: 8, estimatedCostEUR: 1.75, addedAt: new Date().toISOString().split("T")[0] },
  { id: "sp-10", name: "Ajo en polvo", quantity: 1, unit: "bote", category: "Spices", expiryDaysLeft: 120, estimatedCostEUR: 0.90, addedAt: new Date().toISOString().split("T")[0] },
  { id: "sp-11", name: "Aceite de oliva virgen", quantity: 1, unit: "botella", category: "Pantry/Grains", expiryDaysLeft: 180, estimatedCostEUR: 4.50, addedAt: new Date().toISOString().split("T")[0] },
];

export const SAMPLE_RECIPES: Recipe[] = [
  {
    id: "rec-med-lentil",
    title: {
      en: "Mediterranean Lentil & Zucchini Stew",
      bg: "Средиземноморска Леща с Тиквички и Чесън",
      es: "Guiso Mediterráneo de Lentejas y Calabacín",
    },
    description: {
      en: "A hearty, fiber-rich stew using simple pantry staples with a savory garlic finish.",
      bg: "Питателна, богата на фибри яхния с основни продукти от килера и деликатен чеснов аромат.",
      es: "Un guiso reconfortante y rico en fibra utilizando ingredientes básicos con toque de ajo y especias.",
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
    tags: ["Mediterráneo", "Alto en Fibra", "Económico", "Vegetariano"],
    ingredients: [
      { name: "Lentejas", amount: 200, unit: "g", inPantry: true },
      { name: "Calabacín", amount: 1, unit: "ud", inPantry: true },
      { name: "Ajo en polvo", amount: 1, unit: "cdta", inPantry: true },
      { name: "Aceite de oliva", amount: 1, unit: "cda", inPantry: true },
      { name: "Sal y pimentón", amount: 1, unit: "pizca", inPantry: true },
    ],
    instructions: {
      en: [
        "Rinse lentils and boil in lightly salted water for 15-18 minutes until tender.",
        "Dice the zucchini into small bite-sized cubes.",
        "In a skillet, heat olive oil and sauté the zucchini with garlic powder and paprika for 4 minutes.",
        "Stir the tender lentils into the skillet with a splash of cooking water and simmer for 3 minutes.",
      ],
      bg: [
        "Изплакнете лещата и я сварете в подсолена вода за 15-18 минути.",
        "Нарежете тиквичката на малки кубчета.",
        "В тиган загрейте зехтина и задушете тиквичката с чесън на прах и червен пипер за 4 минути.",
        "Добавете сварената леща с малко от бульона и оставете да покъкри за 3 минути.",
      ],
      es: [
        "Lava las lentejas y cuécelas en agua con sal durante 15-18 minutos hasta que estén tiernas.",
        "Corta el calabacín en dados pequeños.",
        "En una sartén con aceite de oliva, saltea el calabacín con ajo en polvo y pimentón durante 4 minutos.",
        "Incorpora las lentejas con un poco de caldo y cocina a fuego suave 3 minutos para integrar los sabores.",
      ],
    },
    nutritionHighlights: {
      en: "Rich in plant protein and prebiotic fiber to support healthy digestion.",
      bg: "Богата на растителен протеин и пребиотични фибри за перфектно храносмилане.",
      es: "Rica en proteína vegetal y fibra prebiótica para una digestión óptima y saciedad duradera.",
    },
    imageUrl: "/images/lentil_soup_balkan_style_1789192381584.jpg",
  },
  {
    id: "rec-bacon-rice",
    title: {
      en: "Savory Bacon & Parmesan Rice Bowl",
      bg: "Задушен Ориз с Хрупкав Бекон и Пармезан",
      es: "Arroz Salteado con Bacon Crujiente y Parmesano",
    },
    description: {
      en: "A quick, satisfying fusion rice bowl with crispy bacon and fried eggs.",
      bg: "Бързо и засищащо ястие с хрупкав бекон, яйце и ароматен пармезан.",
      es: "Plato rápido, crujiente y reconfortante con bacon dorado, huevo y parmesano rallado.",
    },
    prepTimeMin: 5,
    cookTimeMin: 15,
    costPerServingEUR: 1.10,
    difficulty: "easy",
    servings: 2,
    calories: 550,
    proteinG: 25,
    carbsG: 50,
    fatG: 28,
    fiberG: 2,
    healthScore: 82,
    tags: ["Rápido 15 min", "Proteico", "Casero"],
    ingredients: [
      { name: "Arroz cocido", amount: 250, unit: "g", inPantry: true },
      { name: "Bacon", amount: 80, unit: "g", inPantry: true },
      { name: "Huevos frescos", amount: 2, unit: "uds", inPantry: true },
      { name: "Queso parmesano", amount: 30, unit: "g", inPantry: true },
    ],
    instructions: {
      en: [
        "Crisp bacon strips in a dry non-stick skillet over medium-high heat until golden (3-4 mins).",
        "Add cooked rice into the bacon fat and toss vigorously for 2 minutes.",
        "Fry eggs in the same pan sunny-side up.",
        "Serve rice topped with fried eggs and generous freshly grated parmesan.",
      ],
      bg: [
        "Запечете бекона в сух тиган до златиста хрупкавост (3-4 минути).",
        "Добавете сварения ориз и разбъркайте енергично за 2 минути.",
        "Изпържете яйцата на очи в същия тиган.",
        "Сервирайте ориза, гарниран с яйцата и настърган пармезан.",
      ],
      es: [
        "Dora las tiras de bacon en una sartén antiadherente a fuego medio hasta que queden crujientes (3-4 min).",
        "Añade el arroz cocido y saltea a fuego vivo durante 2 minutos para que absorba el aroma.",
        "Cocina los huevos a la plancha en la misma sartén.",
        "Sirve el arroz caliente con los huevos por encima y espolvorea abundante queso parmesano rallado.",
      ],
    },
    nutritionHighlights: {
      en: "High satiety and complete animal protein with essential B-vitamins.",
      bg: "Високо съдържание на пълноценен протеин и витамини от група B.",
      es: "Aporte elevado de proteína de alto valor biológico y saciedad duradera.",
    },
    imageUrl: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rec-creamy-macaroni",
    title: {
      en: "Creamy Garlic Macaroni with Cucumber Salad",
      bg: "Кремообразни Макарони с Чесън и Свеж Пепино",
      es: "Macarrones Cremosos al Ajo y Philadelphia con Pepino",
    },
    description: {
      en: "Pasta tossed in a velvety Philadelphia sauce with garlic and a refreshing cucumber side.",
      bg: "Апетитна паста с кадифен сос от крем сирене Филаделфия и хрупкава краставичка.",
      es: "Pasta corta envuelta en suave salsa de queso crema Philadelphia y ajo, con rodajas de pepino fresco.",
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
    tags: ["Rápido 15 min", "Económico", "Vegetariano"],
    ingredients: [
      { name: "Macarrones", amount: 200, unit: "g", inPantry: true },
      { name: "Queso crema Philadelphia", amount: 80, unit: "g", inPantry: true },
      { name: "Ajo en polvo", amount: 1, unit: "cdta", inPantry: true },
      { name: "Pepino", amount: 1, unit: "ud", inPantry: true },
    ],
    instructions: {
      en: [
        "Boil macaroni in salted water according to package instructions (approx 8 minutes).",
        "Reserve 3 tablespoons of hot pasta water, then drain pasta.",
        "Melt Philadelphia cream cheese and garlic powder into the warm pasta with the pasta water to create a silky sauce.",
        "Slice cucumber thinly and serve chilled alongside the warm creamy pasta.",
      ],
      bg: [
        "Сварете макароните в подсолена вода според указанията (около 8 минути).",
        "Запазете 3 с.л. от водата на пастата, след което я отцедете.",
        "Разбъркайте крем сиренето с чесъна на прах и водата от пастата до копринен сос.",
        "Нарежете краставицата на тънки резени и поднесете като свежа гарнитура.",
      ],
      es: [
        "Cuece los macarrones en agua hirviendo con sal durante 8 minutos al dente.",
        "Reserva 3 cucharadas del agua de cocción antes de escurrir la pasta.",
        "Mezcla el queso crema Philadelphia con el ajo en polvo y el agua reservada sobre la pasta caliente hasta formar una crema sedosa.",
        "Corta el pepino en rodajas finas y acompáñalo como guarnición fresca y crujiente.",
      ],
    },
    nutritionHighlights: {
      en: "Comforting balance of complex carbohydrates, calcium, and refreshing hydration.",
      bg: "Баланс от енергийни въглехидрати, калций и хидратиращи електролити от краставицата.",
      es: "Aporte energético limpio, calcio lácteo y frescura hidratante gracias al pepino.",
    },
    imageUrl: "https://images.unsplash.com/photo-1621996346565-e3d5d6281699?auto=format&fit=crop&w=800&q=80",
  },
];

export const INITIAL_RECIPES: Recipe[] = SAMPLE_RECIPES;

export const INITIAL_SHOPPING: ShoppingItem[] = [];

export const DEFAULT_MEAL_PLAN: MealPlanDay[] = [];

export const DEFAULT_PROFILE: UserProfile = {
  name: "Balkan Explorer",
  language: "es",
  currency: "EUR",
  cookingSpeed: "fast",
  healthGoal: "balanced",
  dietStyle: "mediterranean",
  disliked: [],
  budgetTier: "balanced",
  isProSubscriber: true,
  onboardingCompleted: true,
};
