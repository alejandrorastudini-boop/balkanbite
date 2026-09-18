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
        es: "Fotografía la nevera o un ticket para obtener sugerencias revisables. La IA puede proponer alimentos, categorías, cantidades, unidades, precio o caducidad, pero los datos importantes no se convierten automáticamente en verdad de la despensa.",
        en: "Photograph your fridge or a grocery receipt to get reviewable suggestions. AI may suggest foods, categories, quantities, units, price, or expiry, but important fields do not automatically become pantry truth.",
        bg: "Снимайте хладилника или касова бележка, за да получите предложения за преглед. AI може да предложи храни, категории, количества, мерни единици, цена или срок, но важните полета не стават автоматично истина за килера.",
      },
      highlights: {
        es: [
          "Sugerencias visuales de alimentos para revisar",
          "Sugerencias de artículos desde imágenes de tickets",
          "Lector de códigos de barras EAN conectado a Open Food Facts",
        ],
        en: [
          "Visual food suggestions for review",
          "Receipt-image item suggestions for review",
          "Barcode scanner linked directly with Open Food Facts",
        ],
        bg: [
          "Визуални предложения за храни за преглед",
          "Предложения за артикули от снимки на касови бележки",
          "Баркод скенер с връзка към Open Food Facts",
        ],
      },
    },
    {
      id: "chef",
      icon: "Sparkles",
      badge: "Chef IA",
      title: {
        es: "Chef de Recetas Basado en tu Despensa",
        en: "Pantry-Aware Recipe Chef",
        bg: "Шеф за рецепти според килера",
      },
      description: {
        es: "Pide ideas al Chef a partir de los alimentos confirmados de tu despensa. Las recetas son recomendaciones y los datos nutricionales o de coste deben tratarse como estimaciones salvo que procedan de datos verificados.",
        en: "Ask the Chef for ideas based on confirmed pantry items. Recipes are recommendations, and nutrition or cost data should be treated as estimates unless backed by verified data.",
        bg: "Поискайте идеи от шефа според потвърдените продукти в килера. Рецептите са препоръки, а хранителните и ценовите данни са оценки, освен ако не са подкрепени от проверени данни.",
      },
      highlights: {
        es: [
          "Puede priorizar fechas conocidas próximas a caducar",
          "Campos nutricionales mostrados como estimación cuando no están verificados",
          "Coste por ración solo cuando existen datos de precio conocidos o claramente estimados",
        ],
        en: [
          "Can prioritize known upcoming expiry dates",
          "Nutrition fields remain estimates unless verified",
          "Per-serving cost only when known price data is available",
        ],
        bg: [
          "Може да приоритизира известни наближаващи срокове",
          "Хранителните стойности са оценки, освен ако не са проверени",
          "Цена на порция само при известни или ясно обозначени приблизителни ценови данни",
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
        es: "Organiza un plan semanal y deriva faltantes a partir de la despensa y recetas cuando las cantidades y unidades son comparables. La lista puede compartirse por WhatsApp y el menú puede imprimirse o exportarse a PDF.",
        en: "Organize a weekly plan and derive missing items from pantry and recipe data when quantities and units are comparable. The list can be shared to WhatsApp, and the menu can be printed or exported to PDF.",
        bg: "Организирайте седмичен план и извеждайте липсващите продукти от килера и рецептите, когато количествата и мерните единици са сравними. Списъкът може да се сподели в WhatsApp, а менюто да се отпечата или експортира като PDF.",
      },
      highlights: {
        es: [
          "Plan semanal de hasta 7 días a partir de los datos disponibles",
          "Hoja de menú lista para imprimir y colgar con imán en tu cocina",
          "Envío instantáneo de la lista de compra a WhatsApp con un toque",
        ],
        en: [
          "Weekly plan of up to 7 days from available data",
          "Print-ready magnet sheet for your refrigerator door",
          "One-tap grocery list sharing directly via WhatsApp",
        ],
        bg: [
          "Седмичен план до 7 дни според наличните данни",
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
        es: "BalkanBite incluye una experiencia PWA y controles de instalación cuando el navegador los ofrece. La disponibilidad exacta depende del navegador y del sistema operativo.",
        en: "BalkanBite includes a PWA experience and installation controls when the browser supports them. Exact availability depends on the browser and operating system.",
        bg: "BalkanBite включва PWA изживяване и контроли за инсталиране, когато браузърът ги поддържа. Точната наличност зависи от браузъра и операционната система.",
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
