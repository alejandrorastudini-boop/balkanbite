import { Language } from "../types";

// Common food items translation dictionary
const FOOD_DICTIONARY: Record<string, { es: string; bg: string }> = {
  // Meats & Fish
  "chicken breast": { es: "Pechuga de pollo", bg: "Пилешки гърди" },
  "chicken breasts": { es: "Pechugas de pollo", bg: "Пилешки гърди" },
  "chicken": { es: "Pollo", bg: "Пилешко месо" },
  "beef": { es: "Ternera", bg: "Телешко месо" },
  "ground beef": { es: "Carne picada de ternera", bg: "Телешка кайма" },
  "minced meat": { es: "Carne picada", bg: "Кайма" },
  "pork": { es: "Cerdo", bg: "Свинско месо" },
  "turkey breast": { es: "Pechuga de pavo", bg: "Пуешки гърди" },
  "salmon": { es: "Salmón fresco", bg: "Сьомга" },
  "tuna": { es: "Atún", bg: "Риба тон" },
  "canned tuna": { es: "Lata de atún", bg: "Консерва риба тон" },
  "fish": { es: "Pescado", bg: "Риба" },

  // Dairy & Eggs
  "greek yogurt": { es: "Yogur griego natural", bg: "Цедено кисело мляко" },
  "yogurt": { es: "Yogur natural", bg: "Кисело мляко" },
  "bulgarian yogurt": { es: "Yogur búlgaro tradicional", bg: "Българско кисело мляко" },
  "eggs": { es: "Huevos camperos", bg: "Яйца" },
  "free-range eggs": { es: "Huevos camperos L", bg: "Яйца от свободни кокошки" },
  "egg": { es: "Huevo", bg: "Яйце" },
  "milk": { es: "Leche entera/semi", bg: "Прясно мляко" },
  "butter": { es: "Mantequilla", bg: "Краве масло" },
  "feta cheese": { es: "Queso Feta / Sirene", bg: "Бяло сирене" },
  "sirene": { es: "Queso Sirene blanco", bg: "Българско сирене" },
  "sirene cheese": { es: "Queso Sirene", bg: "Бяло сирене" },
  "kashkaval": { es: "Queso Kashkaval", bg: "Кашкавал" },
  "cheese": { es: "Queso", bg: "Сирене / Кашкавал" },
  "cream cheese": { es: "Queso crema", bg: "Крем сирене" },
  "cottage cheese": { es: "Queso cottage / requesón", bg: "Извара" },

  // Vegetables & Herbs
  "spinach": { es: "Espinacas frescas", bg: "Пресен спанак" },
  "fresh spinach": { es: "Espinacas frescas", bg: "Пресен спанак" },
  "cucumber": { es: "Pepino fresco", bg: "Краставица" },
  "cucumbers": { es: "Pepinos frescos", bg: "Пресни краставици" },
  "fresh cucumbers": { es: "Pepinos frescos", bg: "Пресни краставици" },
  "tomato": { es: "Tomate maduro", bg: "Домат" },
  "tomatoes": { es: "Tomates frescos", bg: "Пресни домати" },
  "pink tomatoes": { es: "Tomates rosados", bg: "Розови домати" },
  "bell pepper": { es: "Pimiento dulce", bg: "Чушка" },
  "bell peppers": { es: "Pimientos dulces", bg: "Чушки" },
  "peppers": { es: "Pimientos", bg: "Чушки" },
  "garlic": { es: "Ajo fresco", bg: "Чесън" },
  "garlic clove": { es: "Diente de ajo", bg: "Скилидка чесън" },
  "garlic cloves": { es: "Dientes de ajo", bg: "Скилидки чесън" },
  "onion": { es: "Cebolla", bg: "Лук" },
  "onions": { es: "Cebollas", bg: "Лук" },
  "red onion": { es: "Cebolla morada", bg: "Червен лук" },
  "dill": { es: "Eneldo fresco", bg: "Пресен копър" },
  "fresh dill": { es: "Eneldo fresco", bg: "Пресен копър" },
  "parsley": { es: "Perejil fresco", bg: "Пресен магданоз" },
  "fresh parsley": { es: "Perejil fresco", bg: "Пресен магданоз" },
  "potato": { es: "Patata", bg: "Картоф" },
  "potatoes": { es: "Patatas", bg: "Картофи" },
  "carrot": { es: "Zanahoria", bg: "Морков" },
  "carrots": { es: "Zanahorias", bg: "Моркови" },
  "zucchini": { es: "Calabacín", bg: "Тиквичка" },
  "eggplant": { es: "Berenjena", bg: "Патладжан" },
  "lettuce": { es: "Lechuga", bg: "Маруля" },
  "mushrooms": { es: "Champiñones", bg: "Гъби" },
  "avocado": { es: "Aguacate", bg: "Авокадо" },

  // Fruits
  "banana": { es: "Plátano", bg: "Банан" },
  "bananas": { es: "Plátanos", bg: "Банани" },
  "apple": { es: "Manzana", bg: "Ябълка" },
  "apples": { es: "Manzanas", bg: "Ябълки" },
  "lemon": { es: "Limón", bg: "Лимон" },
  "lemons": { es: "Limones", bg: "Лимони" },
  "orange": { es: "Naranja", bg: "Портокал" },
  "berries": { es: "Frutos rojos", bg: "Горски плодове" },

  // Grains, Legumes & Pantry
  "olive oil": { es: "Aceite de oliva virgen extra", bg: "Зехтин екстра върджин" },
  "extra virgin olive oil": { es: "Aceite de oliva virgen extra", bg: "Зехтин екстра върджин" },
  "sunflower oil": { es: "Aceite de girasol", bg: "Слънчогледово олио" },
  "oil": { es: "Aceite", bg: "Олио / Зехтин" },
  "walnuts": { es: "Nueces peladas", bg: "Орехови ядки" },
  "walnut halves": { es: "Nueces peladas", bg: "Орехови ядки" },
  "almonds": { es: "Almendras", bg: "Бадеми" },
  "rice": { es: "Arroz", bg: "Ориз" },
  "brown rice": { es: "Arroz integral", bg: "Кафяв ориз" },
  "pasta": { es: "Pasta", bg: "Паста" },
  "macaroni": { es: "Macarrones", bg: "Макарони" },
  "oats": { es: "Copos de avena", bg: "Овесени ядки" },
  "lentils": { es: "Lentejas", bg: "Леща" },
  "beans": { es: "Alubias / Judías blancas", bg: "Бял боб" },
  "chickpeas": { es: "Garbanzos", bg: "Нахут" },
  "flour": { es: "Harina de trigo", bg: "Брашно" },
  "honey": { es: "Miel pura", bg: "Пчелен мед" },
  "salt": { es: "Sal marina", bg: "Морска сол" },
  "black pepper": { es: "Pimienta negra", bg: "Черен пипер" },
  "paprika": { es: "Pimentón dulce", bg: "Червен пипер" },
  "chubritza": { es: "Chubritza (Ajedrea balcánica)", bg: "Шарена сол / Чубрица" },
  "oregano": { es: "Orégano", bg: "Риган" },
  "bread": { es: "Pan artesanal", bg: "Пълнозърнест хляб" },
};

// Translate an ingredient or food name dynamically
export function translateFoodName(rawName: string, language: Language): string {
  if (!rawName) return rawName;
  if (language === "en") return rawName;

  const normalized = rawName.trim().toLowerCase();

  // Direct exact match
  if (FOOD_DICTIONARY[normalized]) {
    return FOOD_DICTIONARY[normalized][language] || rawName;
  }

  // Partial match search
  for (const [enKey, trans] of Object.entries(FOOD_DICTIONARY)) {
    if (normalized.includes(enKey) || enKey.includes(normalized)) {
      return trans[language];
    }
  }

  return rawName;
}

// Translate category labels
export function translateCategory(category: string, language: Language): string {
  if (!category) return category;
  const cat = category.toUpperCase().trim();

  if (language === "es") {
    if (cat.includes("PRODUCE") || cat.includes("VEG") || cat.includes("FRUIT")) return "Frutas y Verduras";
    if (cat.includes("DAIRY")) return "Lácteos";
    if (cat.includes("MEAT") || cat.includes("FISH") || cat.includes("PROTEIN")) return "Carnes y Pescados";
    if (cat.includes("PANTRY") || cat.includes("GRAIN")) return "Despensa";
    if (cat.includes("SPICE") || cat.includes("HERB")) return "Especias";
    return "Otros";
  }

  if (language === "bg") {
    if (cat.includes("PRODUCE") || cat.includes("VEG") || cat.includes("FRUIT")) return "Плодове и зеленчуци";
    if (cat.includes("DAIRY")) return "Млечни продукти";
    if (cat.includes("MEAT") || cat.includes("FISH") || cat.includes("PROTEIN")) return "Месо и риба";
    if (cat.includes("PANTRY") || cat.includes("GRAIN")) return "Склад и зърнени";
    if (cat.includes("SPICE") || cat.includes("HERB")) return "Подправки";
    return "Други";
  }

  return category;
}

// Translate units
export function translateUnit(unit: string, language: Language): string {
  if (!unit) return unit;
  const u = unit.toLowerCase().trim();

  if (language === "es") {
    if (u === "grams" || u === "gram" || u === "g") return "g";
    if (u === "kilograms" || u === "kg") return "kg";
    if (u === "pcs" || u === "pieces" || u === "piece" || u === "unit" || u === "units") return "uds";
    if (u === "pack" || u === "packs" || u === "package") return "paquete(s)";
    if (u === "bunch" || u === "bunches") return "manojo(s)";
    if (u === "tbsp" || u === "tablespoon") return "cda";
    if (u === "tsp" || u === "teaspoon") return "cdta";
    if (u === "can" || u === "cans") return "lata(s)";
    if (u === "bottle" || u === "bottles") return "botella(s)";
    return u;
  }

  if (language === "bg") {
    if (u === "grams" || u === "gram" || u === "g") return "г";
    if (u === "kilograms" || u === "kg") return "кг";
    if (u === "pcs" || u === "pieces" || u === "piece" || u === "unit") return "бр.";
    if (u === "pack" || u === "packs") return "опак.";
    if (u === "bunch" || u === "bunches") return "връзка";
    if (u === "tbsp") return "с.л.";
    if (u === "tsp") return "ч.л.";
    if (u === "can") return "консерва";
    return u;
  }

  return unit;
}

// Translate reason / nutritional bullet
export function translateReason(reason: string | undefined, language: Language): string | undefined {
  if (!reason) return undefined;
  if (language === "en") return reason;

  let text = reason;

  if (language === "es") {
    text = text
      .replace(/Provides lean protein/gi, "Aporta proteína magra de alta calidad")
      .replace(/Provides protein/gi, "Aporta proteínas esenciales")
      .replace(/Adds probiotics/gi, "Añade probióticos digestivos")
      .replace(/Rich in probiotics/gi, "Rico en probióticos saludables")
      .replace(/Critical for/gi, "Esencial para")
      .replace(/High in fiber/gi, "Rico en fibra natural")
      .replace(/Healthy fats/gi, "Grasas saludables y omega-3")
      .replace(/Vitamin C/gi, "Vitamina C e hidratación")
      .replace(/Antioxidants/gi, "Antioxidantes naturales")
      .replace(/Electrolytes/gi, "Electrólitos y frescura");
  } else if (language === "bg") {
    text = text
      .replace(/Provides lean protein/gi, "Осигурява чист протеин")
      .replace(/Provides protein/gi, "Осигурява протеин")
      .replace(/Adds probiotics/gi, "Добавя пробиотици")
      .replace(/Critical for/gi, "Критично за")
      .replace(/High in fiber/gi, "Богато на фибри")
      .replace(/Healthy fats/gi, "Полезни мазнини");
  }

  return text;
}
