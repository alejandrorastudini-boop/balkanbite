import { Language } from "../types";

export interface LandingFeature {
  id: string;
  icon: string;
  badge?: string;
  title: Record<Language, string>;
  description: Record<Language, string>;
  highlights: Record<Language, string[]>;
}

export interface LandingFaq {
  question: Record<Language, string>;
  answer: Record<Language, string>;
}

export const LANDING_DATA = {
  hero: {
    tag: {
      es: "Tecnología Culinaria & Inteligencia Artificial",
      en: "Culinary Technology & Artificial Intelligence",
      bg: "Кулинарни технологии и изкуствен интелект",
    },
    titleLine1: {
      es: "Tu cocina inteligente.",
      en: "Your smart kitchen.",
      bg: "Вашата интелигентна кухня.",
    },
    titleHighlight: {
      es: "Planifica con lo que ya tienes.",
      en: "Plan with what you already have.",
      bg: "Планирайте с това, което вече имате.",
    },
    subtitle: {
      es: "Escanea tu nevera, revisa los ingredientes detectados y planifica comidas con los productos confirmados.",
      en: "Scan your fridge, review detected ingredients, and plan meals using confirmed items.",
      bg: "Сканирайте хладилника, прегледайте разпознатите продукти и планирайте ястия с потвърдените продукти.",
    },
    ctaPrimary: {
      es: "Abrir BalkanBite Gratis",
      en: "Launch BalkanBite Free",
      bg: "Отвори BalkanBite безплатно",
    },
    ctaSecondary: {
      es: "Ver Demostración Interactiva",
      en: "Interactive Demo",
      bg: "Интерактивно демо",
    },
    badge1: {
      es: "AI-assisted visual review",
      en: "AI-assisted visual review",
      bg: "AI-assisted visual review",
    },
    badge2: {
      es: "PWA Instalable en Móvil",
      en: "Installable Mobile PWA",
      bg: "PWA мобилна инсталация",
    },
    badge3: {
      es: "100% Sin Anuncios",
      en: "100% Ad-Free",
      bg: "100% без реклами",
    },
  },
  metrics: [
    {
      value: "Despensa",
      label: {
        es: "Inventario revisable",
        en: "Reviewable inventory",
        bg: "Преглеждан инвентар",
      },
      sub: {
        es: "Los datos dudosos permanecen pendientes",
        en: "Uncertain data stays pending",
        bg: "Несигурните данни остават непотвърдени",
      },
    },
    {
      value: "Menús",
      label: {
        es: "Planificación conectada",
        en: "Connected meal planning",
        bg: "Свързано планиране на меню",
      },
      sub: {
        es: "Basada en alimentos confirmados",
        en: "Based on confirmed food data",
        bg: "На база потвърдени хранителни данни",
      },
    },
    {
      value: "Compra",
      label: {
        es: "Faltantes visibles",
        en: "Visible missing items",
        bg: "Видими липсващи продукти",
      },
      sub: {
        es: "Lista vinculada a necesidades conocidas",
        en: "Shopping list tied to known needs",
        bg: "Списък според известните нужди",
      },
    },
    {
      value: "BG · ES · EN",
      label: {
        es: "Interfaz multilingüe",
        en: "Multilingual interface",
        bg: "Многоезичен интерфейс",
      },
      sub: {
        es: "Bulgaria-first con español e inglés",
        en: "Bulgaria-first with Spanish and English",
        bg: "Фокус върху България с испански и английски",
      },
    },
  ],
  pillars: [
    {
      id: "vision",
      icon: "Camera",
      badge: "AI Vision",
      title: {
        es: "Escáner Visual de Nevera & Tickets",
        en: "Visual Fridge & Receipt Scanner",
        bg: "Визуален скенер за хладилник и бележки",
      },
      description: {
        es: "Apunta la cámara de tu móvil a los estantes de tu frigorífico o fotografía el ticket del supermercado. Nuestra IA identifica los alimentos, calcula su vida útil y los clasifica.",
        en: "Point your phone camera at your fridge shelves or snap your grocery receipt. AI identifies items, estimates shelf-life, and categorizes automatically.",
        bg: "Насочете камерата към рафтовете на хладилника или снимайте касовата бележка. AI разпознава съставките, срока на годност и категориите.",
      },
      highlights: {
        es: [
          "Reconocimiento instantáneo de frutas, verduras y lácteos",
          "Extracción inteligente de artículos desde tickets de compra",
          "Lector de códigos de barras EAN conectado a Open Food Facts",
        ],
        en: [
          "Instant detection of produce, dairy, meats and pantry items",
          "Automated receipt OCR to import entire grocery trips",
          "Barcode scanner linked directly with Open Food Facts",
        ],
        bg: [
          "Мигновено разпознаване на плодове, зеленчуци и млечни продукти",
          "Интелигентно извличане на покупки от касови бележки",
          "Баркод скенер с връзка към Open Food Facts",
        ],
      },
    },
    {
      id: "chef",
      icon: "Sparkles",
      badge: "Chef IA",
      title: {
        es: "Chef Inteligente de Aprovechamiento",
        en: "Zero-Waste Intelligent Chef",
        bg: "Интелигентен шеф-готвач за оползотворяване",
      },
      description: {
        es: "¿No sabes qué cocinar hoy? Dile al Chef qué ingredientes te quedan o habla por voz mientras cocinas. Generará recetas deliciosas y balanceadas sin tener que bajar al súper.",
        en: "Wondering what to cook tonight? Ask the Chef or speak hands-free while cooking. Get wholesome, budget-friendly recipes tailored to your ingredients.",
        bg: "Чудите се какво да сготвите? Попитайте шефа с глас, докато готвите. Вкусни и балансирани ястия с наличните ви продукти.",
      },
      highlights: {
        es: [
          "Prioriza ingredientes a punto de caducar para evitar pérdidas",
          "Desglose nutricional de calorías, proteínas, carbohidratos y grasas",
          "Coste estimado por ración (desde 0,85 € por plato)",
        ],
        en: [
          "Prioritizes items expiring soon to eliminate spoilage",
          "Full nutritional macro breakdown (calories, protein, carbs, fats)",
          "Estimated cost per serving (often under €1.00 per portion)",
        ],
        bg: [
          "Приоритет на продуктите с изтичащ срок за спестяване",
          "Хранителни стойности: калории, протеини, въглехидрати и мазнини",
          "Приблизителна цена на порция (под 1,00 €)",
        ],
      },
    },
    {
      id: "planner",
      icon: "Calendar",
      badge: "Smart Planning",
      title: {
        es: "Menú Semanal & Hoja de Nevera Imprimible",
        en: "Weekly Meal Planner & Printable Fridge Sheet",
        bg: "Седмично меню и готов лист за печат",
      },
      description: {
        es: "Organiza tu semana en un clic. Genera la lista de compras exacta con lo que realmente te falta, compártela por WhatsApp o imprime el menú para colgarlo en la nevera.",
        en: "Plan your whole week with a single click. Generate an exact grocery list with missing items only, send it to WhatsApp, or print a sheet for your fridge door.",
        bg: "Организирайте седмицата с един клик. Точен списък за пазаруване само с липсващото, изпращане по WhatsApp и лист за принтиране.",
      },
      highlights: {
        es: [
          "Generador de 7 días completos optimizado por tu presupuesto",
          "Hoja de menú lista para imprimir y colgar con imán en tu cocina",
          "Envío instantáneo de la lista de compra a WhatsApp con un toque",
        ],
        en: [
          "Full 7-day automated plan optimized for health and budget",
          "Print-ready magnet sheet for your refrigerator door",
          "One-tap grocery list sharing directly via WhatsApp",
        ],
        bg: [
          "7-дневно меню оптимизирано според бюджета",
          "Готов лист за принтиране и закачане с магнит",
          "Мигновено споделяне на списъка в WhatsApp с един бутон",
        ],
      },
    },
  ],
  pricing: {
    free: {
      name: {
        es: "Plan Gratuito",
        en: "Free Forever",
        bg: "Безплатен план",
      },
      price: "0 €",
      period: {
        es: "para siempre",
        en: "forever",
        bg: "завинаги",
      },
      desc: {
        es: "Todo lo básico para organizar tu despensa y cocinar sin desperdiciar.",
        en: "All essentials to manage your pantry and stop wasting food.",
        bg: "Всичко необходимо за организиране на кухнята без излишен разход.",
      },
      features: {
        es: [
          "Seguimiento de hasta 30 ingredientes en despensa",
          "Recetas saludables y económicas",
          "Escaneo visual con IA estándar",
          "Lista de compras básica",
          "Aplicación instalable en el móvil (PWA)",
        ],
        en: [
          "Track up to 30 pantry ingredients",
          "Wholesome budget recipes",
          "Standard AI visual scanning",
          "Basic smart shopping list",
          "Installable mobile app (PWA)",
        ],
        bg: [
          "До 30 продукта в килера",
          "Здравословни и икономични рецепти",
          "Стандартен AI визуален скенер",
          "Основен списък за пазаруване",
          "Инсталация като PWA на телефона",
        ],
      },
      cta: {
        es: "Empezar Gratis",
        en: "Get Started Free",
        bg: "Започни безплатно",
      },
    },
    pro: {
      badge: {
        es: "MÁS POPULAR • 7 DÍAS GRATIS",
        en: "MOST POPULAR • 7 DAYS FREE",
        bg: "НАЙ-ПОПУЛЯРЕН • 7 ДНИ БЕЗПЛАТНО",
      },
      name: {
        es: "BalkanBite PRO",
        en: "BalkanBite PRO",
        bg: "BalkanBite PRO",
      },
      price: "2,49 €",
      period: {
        es: "/ mes (o 22,99 €/año)",
        en: "/ month (or €22.99/year)",
        bg: "/ месец (или 22,99 €/година)",
      },
      desc: {
        es: "Automatización total, menús semanales ilimitados e inteligencia de ahorro máxima.",
        en: "Complete automation, unlimited meal generation, and maximum savings intelligence.",
        bg: "Пълна автоматизация, неограничени седмични менюта и максимално спестяване.",
      },
      features: {
        es: [
          "Despensa y almacenamiento ilimitados",
          "Generador de menús semanales de 7 días con IA ilimitado",
          "Escáner fotográfico continuo de neveras y tickets de compra",
          "Chef Asistente por Voz manos libres para cocinar",
          "Hoja magnética imprimible en PDF para la nevera",
          "Exportación directa de lista de la compra a WhatsApp",
          "Retorno de inversión: Te ahorra más de 120 € al mes",
        ],
        en: [
          "Unlimited pantry tracking and ingredients",
          "Unlimited 7-day automated weekly meal planner",
          "Continuous AI visual fridge & supermarket receipt scanner",
          "Hands-free Voice Assistant Chef while cooking",
          "Printable magnet fridge sheet (PDF format)",
          "Instant one-tap WhatsApp grocery list sharing",
          "ROI guaranteed: Saves an average of €120+ every month",
        ],
        bg: [
          "Неограничен брой продукти в килера",
          "Неограничено 7-дневно меню генерирано от AI",
          "Визуален скенер за хладилник и касови бележки",
          "Гласов асистент шеф-готвач за готвене със свободни ръце",
          "Готов лист за принтиране на хладилника (PDF)",
          "Директно споделяне на списъка в WhatsApp",
          "Гарантирана възвръщаемост: Спестява над 120 € месечно",
        ],
      },
      cta: {
        es: "Probar 7 Días Gratis",
        en: "Start 7-Day Free Trial",
        bg: "Опитай 7 дни безплатно",
      },
    },
  },
  faq: [
    {
      question: {
        es: "¿Cómo detecta la IA los alimentos de mi nevera?",
        en: "How does the AI detect items inside my fridge?",
        bg: "Как изкуственият интелект разпознава храната в хладилника?",
      },
      answer: {
        es: "Utilizamos el modelo multimodal AI-assisted visual review. Al hacer una foto con tu cámara, analiza los objetos visibles, identifica qué ingredientes son, estima cuántos días les quedan antes de estropearse y los clasifica automáticamente.",
        en: "We leverage AI-assisted visual review. When you take a photo, it analyzes visible items, identifies ingredients, estimates shelf-life days remaining, and categorizes them automatically.",
        bg: "Използваме модела AI-assisted visual review. При снимка моделът анализира видимите продукти, разпознава съставките, изчислява дните до изтичане и ги подрежда по категории.",
      },
    },
    {
      question: {
        es: "¿Puedo instalarla en mi iPhone o Android sin pasar por App Store?",
        en: "Can I install it on my iPhone or Android without App Store?",
        bg: "Мога ли да я инсталирам на iPhone или Android без App Store?",
      },
      answer: {
        es: "¡Sí! BalkanBite es una Progressive Web App (PWA). Solo tienes que pulsar en 'Instalar en el móvil' desde el perfil o seleccionar 'Añadir a pantalla de inicio' en Safari o Chrome. Se abrirá a pantalla completa como cualquier app nativa.",
        en: "Yes! BalkanBite is a Progressive Web App (PWA). Simply tap 'Install on phone' from your profile or choose 'Add to Home Screen' in Safari or Chrome. It opens full screen with zero lag.",
        bg: "Да! BalkanBite е Progressive Web App (PWA). Изберете 'Инсталирай на телефона' или 'Добави към началния екран' в Safari или Chrome. Работи на цял екран като стандартна инсталирана апликация.",
      },
    },
    {
      question: {
        es: "¿Realmente puedo ahorrar dinero con esta app?",
        en: "Can I truly save money using this application?",
        bg: "Наистина ли мога да спестя пари с това приложение?",
      },
      answer: {
        es: "La aplicación puede ayudarte a controlar las existencias y las fechas y a planificar con lo que ya tienes. El ahorro real depende de las compras y el uso de cada hogar y no está garantizado.",
        en: "The app can help you track stock and dates and plan with what you already have. Actual savings depend on each household's purchases and usage and are not guaranteed.",
        bg: "Приложението може да помогне да следите наличностите и сроковете и да планирате с това, което имате. Реалните спестявания зависят от покупките и употребата на всяко домакинство и не са гарантирани.",
      },
    },
    {
      question: {
        es: "¿Qué tipo de recetas ofrece BalkanBite?",
        en: "What types of recipes does BalkanBite offer?",
        bg: "Какъв тип рецепти предлага BalkanBite?",
      },
      answer: {
        es: "Una cuidada fusión de cocina mediterránea, platos tradicionales de los Balcanes (como Banitsa, Musaka ligera, ensaladas Shopska, guisos aromáticos) y opciones internacionales sanas, siempre con ingredientes accesibles de supermercado y foco en alto valor nutricional y bajo coste.",
        en: "A delicious blend of Mediterranean home cuisine, traditional wholesome Balkan classics (Banitsa, light Musaka, Shopska salads, savory stews), and international balanced meals, all using affordable everyday supermarket ingredients.",
        bg: "Балансирана комбинация от средиземноморска кухня, традиционни балкански класики (баница, мусака, шопска салата, яхнии) и съвременни здравословни ястия с достъпни съставки.",
      },
    },
  ],
};
