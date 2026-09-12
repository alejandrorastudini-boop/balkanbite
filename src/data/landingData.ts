import { Language } from "../types";

export interface LandingFeature {
  id: string;
  icon: string;
  badge?: string;
  title: Record<Language, string>;
  description: Record<Language, string>;
  highlights: Record<Language, string[]>;
}

export interface LandingTestimonial {
  name: string;
  role: Record<Language, string>;
  location: string;
  avatar: string;
  rating: number;
  savings: string;
  comment: Record<Language, string>;
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
      es: "Menos desperdicio, más ahorro.",
      en: "Zero waste, maximum savings.",
      bg: "По-малко отпадък, максимално спестяване.",
    },
    subtitle: {
      es: "Escanea tu nevera con IA, planifica comidas equilibradas con lo que ya tienes y ahorra hasta 140 € al mes en el supermercado.",
      en: "Scan your fridge with AI, plan balanced meals from ingredients you already have, and save up to €140 every month.",
      bg: "Сканирайте хладилника с AI, планирайте балансирани ястия от наличните продукти и пестете до 140 € месечно.",
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
      es: "Gemini 3.8 Flash Vision",
      en: "Gemini 3.8 Flash Vision",
      bg: "Gemini 3.8 Flash Vision",
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
      value: "+120 €",
      label: {
        es: "Ahorro medio al mes por hogar",
        en: "Average monthly savings per home",
        bg: "Средно месечно спестяване на дом",
      },
      sub: {
        es: "Comprobado en más de 8.500 despensas",
        en: "Verified across 8,500+ pantries",
        bg: "Проверено в над 8 500 кухни",
      },
    },
    {
      value: "-65%",
      label: {
        es: "Menos comida tirada a la basura",
        en: "Reduction in household food waste",
        bg: "По-малко изхвърлена храна",
      },
      sub: {
        es: "Alertas tempranas de caducidad",
        en: "Smart early expiration alerts",
        bg: "Известия за изтичащ срок",
      },
    },
    {
      value: "3 min",
      label: {
        es: "Para armar tu menú de 7 días",
        en: "To create your full 7-day meal plan",
        bg: "За пълно 7-дневно меню",
      },
      sub: {
        es: "Desayunos, comidas y cenas equilibradas",
        en: "Nutritionally balanced meals",
        bg: "Балансирани закуски, обеди и вечери",
      },
    },
    {
      value: "4.9 / 5",
      label: {
        es: "Valoración de usuarios",
        en: "User satisfaction rating",
        bg: "Оценка от потребителите",
      },
      sub: {
        es: "Basado en más de 1.200 reseñas",
        en: "Based on 1,200+ reviews",
        bg: "Базирано на 1 200+ отзива",
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
  testimonials: [
    {
      name: "Elena Martín",
      role: {
        es: "Madre de familia y freelance",
        en: "Mother & Freelance Designer",
        bg: "Майка на две деца и дизайнер",
      },
      location: "Madrid, España",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80",
      rating: 5,
      savings: "135 €/mes ahorrados",
      comment: {
        es: "Antes tirábamos yogures caducados y verduras mustias todas las semanas. Con el escaneo visual y las recetas de aprovechamiento, nuestro gasto del súper bajó más de 130 € al mes.",
        en: "We used to throw away expired dairy and forgotten vegetables every single week. BalkanBite reduced our monthly grocery spend by more than €130!",
        bg: "Преди всяка седмица изхвърляхме развалени зеленчуци и млека. С визуалния скенер и менютата спестяваме над 130 € месечно.",
      },
    },
    {
      name: "Carlos Vega",
      role: {
        es: "Ingeniero de Software",
        en: "Software Engineer",
        bg: "Софтуерен инженер",
      },
      location: "Valencia, España",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80",
      rating: 5,
      savings: "95 €/mes ahorrados",
      comment: {
        es: "Vivir solo hacía que comprar comida fuese caro e ineficiente. La función de imprimir el menú y colgarlo con imán en la nevera me ha organizado las cenas por completo.",
        en: "Living alone meant grocery shopping was wasteful. The printable fridge sheet and instant WhatsApp shopping list completely solved my weeknights.",
        bg: "Да живееш сам често означава скъпо и неефективно пазаруване. Готовият лист за хладилника напълно ми реши въпроса с вечерите.",
      },
    },
    {
      name: "Mariya Georgieva",
      role: {
        es: "Nutricionista & Deportista",
        en: "Nutrition Coach & Runner",
        bg: "Треньор по хранене и бегач",
      },
      location: "Sofia, Bulgaria",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=160&q=80",
      rating: 5,
      savings: "110 €/mes ahorrados",
      comment: {
        es: "La combinación de platos mediterráneos y recetas tradicionales de los Balcanes con desglose de proteínas y calorías es una maravilla. Rápido, limpio y muy intuitivo.",
        en: "The blend of Mediterranean cooking and Balkan wholesome recipes with accurate macro calculations is exceptional. Clean, lightning-fast, and deeply practical.",
        bg: "Комбинацията от средиземноморски и балкански ястия с точни хранителни стойности е страхотна. Бързо, чисто и изключително полезно.",
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
        es: "Utilizamos el modelo multimodal Gemini 3.8 Flash Vision. Al hacer una foto con tu cámara, analiza los objetos visibles, identifica qué ingredientes son, estima cuántos días les quedan antes de estropearse y los clasifica automáticamente.",
        en: "We leverage Gemini 3.8 Flash Vision. When you take a photo, it analyzes visible items, identifies ingredients, estimates shelf-life days remaining, and categorizes them automatically.",
        bg: "Използваме модела Gemini 3.8 Flash Vision. При снимка моделът анализира видимите продукти, разпознава съставките, изчислява дните до изтичане и ги подрежда по категории.",
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
        es: "Sí. El hogar medio desperdicia entre un 20% y un 30% de la comida que compra al año (unos 1.000 € a 1.400 €). Al avisarte antes de que los alimentos caduquen y planificar las comidas con lo que ya tienes, dejas de tirar comida y compras solo lo necesario.",
        en: "Yes. The average family throws away 20% to 30% of bought food annually (€1,000 to €1,400). By warning you before ingredients expire and meal-planning with existing stock, food waste drops by up to 65%.",
        bg: "Да. Средното домакинство изхвърля между 20% и 30% от храната годишно. Чрез навременните известия за годност и готвене с наличното, спестявате значителна част от бюджета си за храна.",
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
