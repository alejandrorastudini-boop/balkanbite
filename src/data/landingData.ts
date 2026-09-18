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
      es: "Escaneo con revisión humana",
      en: "AI scan with human review",
      bg: "AI сканиране с човешки преглед",
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
          "Per-serving cost only when known price data is available",
        ],
        bg: [
          "Приоритет на продуктите с изтичащ срок за спестяване",
          "Хранителни стойности: калории, протеини, въглехидрати и мазнини",
          "Цена на порция само при налични известни ценови данни",
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
        es: "Acceso actual",
        en: "Current access",
        bg: "Текущ достъп",
      },
      price: "Beta",
      period: {
        es: "sin cobro activado",
        en: "billing not enabled",
        bg: "без активирано плащане",
      },
      desc: {
        es: "La aplicación está en desarrollo y no tiene cobro de suscripción activado.",
        en: "The app is under development and subscription billing is not enabled.",
        bg: "Приложението е в разработка и абонаментното плащане не е активирано.",
      },
      features: {
        es: [
          "Despensa, recetas, planificación y lista de compra en evolución",
          "Escaneo con revisión antes de guardar datos importantes",
          "Las funciones reales dependen del estado implementado de cada módulo",
        ],
        en: [
          "Pantry, recipes, planning and shopping list are evolving",
          "Scanning requires review before important data is saved",
          "Actual capabilities depend on each module's implemented state",
        ],
        bg: [
          "Килер, рецепти, планиране и списък за покупки в развитие",
          "Сканирането изисква преглед преди запазване на важни данни",
          "Реалните възможности зависят от внедрения статус на всеки модул",
        ],
      },
      cta: {
        es: "Abrir BalkanBite",
        en: "Open BalkanBite",
        bg: "Отвори BalkanBite",
      },
    },
    pro: {
      badge: {
        es: "EN PLANIFICACIÓN",
        en: "PLANNED",
        bg: "В ПЛАН",
      },
      name: {
        es: "BalkanBite PRO",
        en: "BalkanBite PRO",
        bg: "BalkanBite PRO",
      },
      price: "—",
      period: {
        es: "precio pendiente",
        en: "pricing pending",
        bg: "цената предстои",
      },
      desc: {
        es: "Concepto de futura oferta Pro. Precio, límites y periodo de prueba aún no están activados.",
        en: "Concept for a future Pro offer. Pricing, limits and trial terms are not enabled yet.",
        bg: "Концепция за бъдещ Pro план. Цена, лимити и пробен период още не са активирани.",
      },
      features: {
        es: [
          "Funciones Pro y límites aún por definir y validar",
          "Sin garantía de ahorro ni retorno económico",
          "Sin suscripción o prueba gratuita activa en este momento",
        ],
        en: [
          "Pro features and limits still need definition and validation",
          "No savings or financial-return guarantee",
          "No active subscription or free trial at this time",
        ],
        bg: [
          "Pro функциите и лимитите предстои да бъдат определени и валидирани",
          "Без гаранция за спестяване или финансова възвръщаемост",
          "В момента няма активен абонамент или безплатен пробен период",
        ],
      },
      cta: {
        es: "PRO aún no disponible",
        en: "PRO not available yet",
        bg: "PRO все още не е наличен",
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
        es: "El escáner analiza la imagen y devuelve sugerencias para revisar. Antes de añadir un alimento debes confirmar explícitamente cantidad y unidad; precio y caducidad sugeridos no se guardan como datos autoritativos, y los datos dudosos permanecen desconocidos.",
        en: "The scanner analyzes the image and returns suggestions for review. Before adding an item you must explicitly confirm quantity and unit; suggested price and expiry are not saved as authoritative data, and uncertain fields remain unknown.",
        bg: "Скенерът анализира изображението и връща предложения за преглед. Преди добавяне трябва изрично да потвърдите количество и мерна единица; предложените цена и срок не се запазват като авторитетни данни, а несигурните полета остават неизвестни.",
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
