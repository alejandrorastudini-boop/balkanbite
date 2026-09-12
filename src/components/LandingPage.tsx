import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Camera,
  Calendar,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  TrendingDown,
  Wallet,
  Clock,
  Flame,
  ChefHat,
  Printer,
  Star,
  Smartphone,
  Utensils,
  Globe,
  Monitor,
} from "lucide-react";
import { Language, Currency } from "../types";
import { LANDING_DATA } from "../data/landingData";

interface LandingPageProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  currency: Currency;
  onCurrencyChange: (curr: Currency) => void;
  onOpenApp: () => void;
  onOpenPro: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  language,
  onLanguageChange,
  currency,
  onCurrencyChange,
  onOpenApp,
  onOpenPro,
}) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [familyMembers, setFamilyMembers] = useState<number>(2);
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);
  const [monthlySpend, setMonthlySpend] = useState<number>(380);
  const [activePreviewTab, setActivePreviewTab] = useState<"fridge" | "recipes" | "planner" | "print">("fridge");

  const currSymbol = currency === "EUR" ? "€" : "$";
  const currRatio = currency === "EUR" ? 1 : 1.08;

  // Real-time savings calculation
  const calculatedWaste = Math.round(monthlySpend * 0.22); 
  const monthlySavings = Math.round(monthlySpend * 0.28); 
  const annualSavings = monthlySavings * 12;

  const hero = LANDING_DATA.hero;

  return (
    <div className="min-h-screen bg-[#0B0F12] text-stone-100 font-['Plus_Jakarta_Sans'] selection:bg-emerald-500 selection:text-white antialiased overflow-x-hidden">
      {/* Glow subtle ambient lighting */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-emerald-600/10 blur-[130px] rounded-full pointer-events-none -z-10" />
      <div className="fixed top-[400px] right-0 w-[500px] h-[300px] bg-amber-500/8 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#131A1F]/80 backdrop-blur-md border-b border-white/[0.04] shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={onOpenApp}>
            <img
              src="/images/logo.jpg"
              alt="BalkanBite Logo"
              className="w-10 h-10 rounded-xl object-cover border-2 border-emerald-500/30 shadow-[0_2px_10px_rgba(16,185,129,0.2)] shrink-0 group-hover:scale-105 transition-transform"
            />
            <div>
              <span className="text-lg font-bold tracking-wide text-white font-['Outfit'] block leading-none">
                BalkanBite
              </span>
              <span className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase mt-0.5 block">
                AI Kitchen & Zero-Waste
              </span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-stone-400">
            <a href="#features" className="hover:text-white transition-colors">
              {language === "es" ? "Funcionalidades" : language === "bg" ? "Функции" : "Features"}
            </a>
            <a href="#calculator" className="hover:text-white transition-colors">
              {language === "es" ? "Calculadora de Ahorro" : language === "bg" ? "Калкулатор" : "Savings Calculator"}
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              {language === "es" ? "Precios" : language === "bg" ? "Цени" : "Pricing"}
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              FAQ
            </a>
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Language Picker */}
            <div className="flex items-center bg-white/[0.02] border border-white/[0.04] rounded-xl p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => onLanguageChange("es")}
                className={`px-2 py-1.5 rounded-lg transition-all cursor-pointer ${
                  language === "es" ? "bg-emerald-500 text-stone-950 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "text-stone-500 hover:text-stone-300 hover:bg-white/[0.04]"
                }`}
              >
                ES
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange("en")}
                className={`px-2 py-1.5 rounded-lg transition-all cursor-pointer ${
                  language === "en" ? "bg-emerald-500 text-stone-950 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "text-stone-500 hover:text-stone-300 hover:bg-white/[0.04]"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange("bg")}
                className={`px-2 py-1.5 rounded-lg transition-all cursor-pointer ${
                  language === "bg" ? "bg-emerald-500 text-stone-950 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "text-stone-500 hover:text-stone-300 hover:bg-white/[0.04]"
                }`}
              >
                БГ
              </button>
            </div>

            {/* Currency Picker */}
            <button
              type="button"
              onClick={() => onCurrencyChange(currency === "EUR" ? "USD" : "EUR")}
              className="px-2.5 py-1.5 bg-white/[0.02] border border-white/[0.04] rounded-xl text-xs font-bold text-emerald-400 hover:bg-white/[0.04] hover:text-emerald-300 transition-colors cursor-pointer"
            >
              {currency === "EUR" ? "€" : "$"}
            </button>

            {/* Primary Enter App Button */}
            <button
              id="landing-enter-app-top-btn"
              type="button"
              onClick={onOpenApp}
              className="px-4 sm:px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs sm:text-sm font-extrabold tracking-wide uppercase rounded-xl flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02] cursor-pointer"
            >
              <span>{language === "es" ? "Entrar" : language === "bg" ? "Вход" : "Open App"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-12 sm:pt-20 pb-16 sm:pb-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold tracking-wide"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
            <span>{hero.tag[language]}</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white font-['Outfit'] max-w-4xl mx-auto leading-[1.12]"
          >
            {hero.titleLine1[language]}{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">
              {hero.titleHighlight[language]}
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-base sm:text-lg md:text-xl text-stone-300 max-w-2xl mx-auto leading-relaxed font-normal"
          >
            {hero.subtitle[language]}
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3"
          >
            <button
              onClick={onOpenApp}
              className="w-full sm:w-auto px-7 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm sm:text-base font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/60 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <span>{hero.ctaPrimary[language]}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="#calculator"
              className="w-full sm:w-auto px-6 py-3.5 bg-stone-900 hover:bg-stone-850 border border-stone-800 hover:border-stone-700 text-stone-200 text-sm sm:text-base font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Wallet className="w-4 h-4 text-amber-400" />
              <span>{hero.ctaSecondary[language]}</span>
            </a>
          </motion.div>
        </div>

        {/* HERO INTERACTIVE SHOWCASE MOCKUP */}
        <div className="max-w-4xl mx-auto mt-12 sm:mt-16">
          <div className="relative rounded-3xl bg-gradient-to-b from-stone-850 to-stone-900 p-2 sm:p-4 border border-stone-800 shadow-2xl shadow-black/80">
            {/* Interactive Tab Switcher on Mockup */}
            <div className="flex items-center justify-between border-b border-stone-800/80 pb-3 px-2 sm:px-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-bold text-stone-400 ml-2 hidden sm:inline">
                  BalkanBite App Preview
                </span>
              </div>

              <div className="flex items-center gap-1 bg-stone-900 border border-stone-800 rounded-xl p-1 text-[11px] font-bold">
                {(["fridge", "recipes", "planner", "print"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActivePreviewTab(tab)}
                    className={`px-2 sm:px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      activePreviewTab === tab
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-stone-400 hover:text-stone-200"
                    }`}
                  >
                    {tab === "fridge" ? "📸" : tab === "recipes" ? "🍳" : tab === "planner" ? "📅" : "🧲"}
                    <span className="ml-1 hidden sm:inline">
                      {tab === "fridge" && (language === "es" ? "Escáner" : language === "bg" ? "Скенер" : "Scanner")}
                      {tab === "recipes" && (language === "es" ? "Recetas" : language === "bg" ? "Рецепти" : "Recipes")}
                      {tab === "planner" && (language === "es" ? "Plan" : language === "bg" ? "План" : "Plan")}
                      {tab === "print" && (language === "es" ? "PDF" : language === "bg" ? "PDF" : "PDF")}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mockup Canvas Screen */}
            <div className="p-4 sm:p-6 bg-stone-950/70 rounded-2xl mt-3 min-h-[320px] flex flex-col justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePreviewTab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {activePreviewTab === "fridge" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                            <Camera className="w-4 h-4 text-emerald-400" />
                            <span>
                              {language === "es"
                                ? "Detección Visual en Vivo (Gemini 3.8 Flash Vision)"
                                : language === "bg"
                                ? "Визуално разпознаване на живо (Gemini 3.8 Flash Vision)"
                                : "Live Visual Detection (Gemini 3.8 Flash Vision)"}
                            </span>
                          </h3>
                          <p className="text-xs text-stone-400">
                            {language === "es"
                              ? "IA analizando estantes..."
                              : language === "bg"
                              ? "AI сканира продуктите..."
                              : "AI analyzing shelves..."}
                          </p>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Auto-Tag</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🍅</span>
                            <div>
                              <p className="font-bold text-stone-200">
                                {language === "es" ? "Tomates" : language === "bg" ? "Домати" : "Tomatoes"}
                              </p>
                              <p className="text-[10px] text-stone-400">500g</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                            {language === "es" ? "3 días" : language === "bg" ? "3 дни" : "3 days"}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🧀</span>
                            <div>
                              <p className="font-bold text-stone-200">
                                {language === "es" ? "Sirene / Feta" : language === "bg" ? "Сирене" : "Sirene / Feta"}
                              </p>
                              <p className="text-[10px] text-stone-400">200g</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                            {language === "es" ? "7 días" : language === "bg" ? "7 дни" : "7 days"}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🥒</span>
                            <div>
                              <p className="font-bold text-stone-200">
                                {language === "es" ? "Pepinos" : language === "bg" ? "Краставици" : "Cucumbers"}
                              </p>
                              <p className="text-[10px] text-stone-400">
                                {language === "es" ? "2 uds" : language === "bg" ? "2 бр." : "2 pcs"}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                            {language === "es" ? "1 día" : language === "bg" ? "1 ден" : "1 day"}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="text-stone-300">
                            {language === "es"
                              ? "Chef: Tienes lo necesario para una Ensalada Shopska."
                              : language === "bg"
                              ? "Шеф: Имате всички продукти за Шопска салата."
                              : "Chef: You have all ingredients for a Shopska Salad."}
                          </span>
                        </div>
                        <button onClick={onOpenApp} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer">
                          {language === "es" ? "Cocinar" : language === "bg" ? "Сготви" : "Cook"}
                        </button>
                      </div>
                    </div>
                  )}

                  {activePreviewTab === "recipes" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <ChefHat className="w-4 h-4 text-amber-400" />
                          <span>
                            {language === "es"
                              ? "Recetas de Aprovechamiento"
                              : language === "bg"
                              ? "Рецепти за оползотворяване"
                              : "Smart Rescue Recipes"}
                          </span>
                        </h3>
                        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20">
                          {language === "es" ? "Ahorro Máximo" : language === "bg" ? "Максимално спестяване" : "Max Savings"}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {[
                          {
                            title: language === "es" ? "Ensalada Shopska" : language === "bg" ? "Шопска салата" : "Shopska Salad",
                            price: "1,20 €",
                            time: "10 min",
                            cal: "210 kcal"
                          },
                          {
                            title: language === "es" ? "Tortilla con Feta" : language === "bg" ? "Омлет със сирене" : "Feta Cheese Omelette",
                            price: "1,65 €",
                            time: "15 min",
                            cal: "340 kcal"
                          }
                        ].map((recipe, i) => (
                          <div key={i} className="p-3.5 rounded-xl bg-stone-900 border border-stone-800">
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-white text-sm">{recipe.title}</h4>
                              <span className="text-emerald-400 font-bold">{recipe.price}</span>
                            </div>
                            <div className="flex gap-3 mt-2 text-[10px] text-stone-400">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {recipe.time}</span>
                              <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-amber-500" /> {recipe.cal}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activePreviewTab === "planner" && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-emerald-400" />
                        <span>
                          {language === "es"
                            ? "Menú Semanal de 7 Días"
                            : language === "bg"
                            ? "7-дневно седмично меню"
                            : "7-Day Weekly Meal Plan"}
                        </span>
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(language === "es"
                          ? [
                              { day: "Lun", dish: "🍳 Huevos con Feta" },
                              { day: "Mar", dish: "🥗 Ensalada Shopska" },
                              { day: "Mié", dish: "🍲 Musaka" },
                              { day: "Jue", dish: "🥘 Pisto Búlgaro" },
                            ]
                          : language === "bg"
                          ? [
                              { day: "Пон", dish: "🍳 Яйца със сирене" },
                              { day: "Вто", dish: "🥗 Шопска салата" },
                              { day: "Сря", dish: "🍲 Мусака" },
                              { day: "Чет", dish: "🥘 Миш-маш" },
                            ]
                          : [
                              { day: "Mon", dish: "🍳 Feta Omelette" },
                              { day: "Tue", dish: "🥗 Shopska Salad" },
                              { day: "Wed", dish: "🍲 Moussaka" },
                              { day: "Thu", dish: "🥘 Veggie Stew" },
                            ]
                        ).map((item, i) => (
                          <div key={i} className="p-2.5 rounded-xl bg-stone-900 border border-stone-800 text-[10px]">
                            <span className="font-bold text-emerald-400 block border-b border-stone-800 pb-1 mb-1">{item.day}</span>
                            <p className="text-stone-300 truncate">{item.dish}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-stone-800">
                        <span className="text-[10px] text-stone-500">
                          {language === "es"
                            ? "Cálculo exacto basado en tu presupuesto"
                            : language === "bg"
                            ? "Точно изчисление според вашия бюджет"
                            : "Exact calculation based on your budget"}
                        </span>
                        <button onClick={onOpenApp} className="text-emerald-400 text-[10px] font-bold flex items-center gap-1 cursor-pointer">
                          <span>
                            {language === "es"
                              ? "Ver mi semana"
                              : language === "bg"
                              ? "Виж седмицата"
                              : "View my week"}
                          </span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {activePreviewTab === "print" && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Printer className="w-4 h-4 text-emerald-400" />
                        <span>
                          {language === "es"
                            ? "Formato PDF para Nevera"
                            : language === "bg"
                            ? "PDF формат за хладилника"
                            : "Fridge PDF Format"}
                        </span>
                      </h3>
                      <div className="p-4 rounded-xl bg-white text-stone-900 border border-stone-200 text-xs space-y-2 max-w-sm mx-auto shadow-lg">
                        <div className="flex justify-between border-b-2 border-emerald-600 pb-2">
                          <span className="font-extrabold text-stone-900">BalkanBite Plan</span>
                          <span className="text-[9px] text-stone-500 uppercase">
                            {language === "es" ? "Semana 38" : language === "bg" ? "Седмица 38" : "Week 38"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[9px]">
                          <div className="p-1.5 bg-stone-50 rounded">
                            <strong>{language === "es" ? "Lunes:" : language === "bg" ? "Понеделник:" : "Monday:"}</strong>{" "}
                            {language === "es" ? "Revuelto Feta" : language === "bg" ? "Миш-маш" : "Scrambled Eggs"}
                          </div>
                          <div className="p-1.5 bg-stone-50 rounded">
                            <strong>{language === "es" ? "Martes:" : language === "bg" ? "Вторник:" : "Tuesday:"}</strong>{" "}
                            {language === "es" ? "Musaka Casera" : language === "bg" ? "Мусака" : "Home Moussaka"}
                          </div>
                        </div>
                        <div className="text-[8px] text-stone-400 pt-1 border-t border-stone-100 italic">
                          {language === "es"
                            ? "✓ Escaneado con IA • Cero Desperdicio"
                            : language === "bg"
                            ? "✓ AI Сканиране • Нулев отпадък"
                            : "✓ AI Scanned • Zero Waste"}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* METRICS COUNTER BAR */}
      <section className="py-12 bg-stone-900/60 border-y border-stone-850 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {LANDING_DATA.metrics.map((m, idx) => (
            <div key={idx} className="space-y-1">
              <div className="text-2xl sm:text-4xl font-black text-emerald-400 font-['Outfit']">{m.value}</div>
              <p className="text-xs sm:text-sm font-bold text-white">{m.label[language]}</p>
              <p className="text-[11px] text-stone-400">{m.sub[language]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* THREE PILLARS / FEATURES */}
      <section id="features" className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              {language === "es" ? "Funcionalidades Principales" : language === "bg" ? "Основни възможности" : "Core Capabilities"}
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-['Outfit'] tracking-tight">
              {language === "es"
                ? "Todo lo que necesitas para una cocina sin estrés"
                : language === "bg"
                ? "Всичко необходимо за спокойна кухня"
                : "Everything you need for a frictionless kitchen"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {LANDING_DATA.pillars.map((pillar) => {
              const IconComp = pillar.icon === "Camera" ? Camera : pillar.icon === "Sparkles" ? Sparkles : Calendar;
              return (
                <div key={pillar.id} className="bg-stone-900/90 border border-stone-800 rounded-3xl p-6 flex flex-col justify-between hover:border-emerald-500/40 transition-all shadow-lg shadow-black/40">
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center"><IconComp className="w-6 h-6" /></div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase">{pillar.badge}</span>
                      <h3 className="text-lg font-bold text-white font-['Outfit']">{pillar.title[language]}</h3>
                    </div>
                    <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">{pillar.description[language]}</p>
                    <div className="space-y-2 pt-2 border-t border-stone-800/80">
                      {pillar.highlights[language].map((highlight, hIdx) => (
                        <div key={hIdx} className="flex items-start gap-2 text-xs text-stone-300">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{highlight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={onOpenApp} className="mt-6 w-full py-2.5 rounded-xl bg-stone-850 hover:bg-stone-800 border border-stone-750 text-stone-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                    <span>
                      {language === "es" ? "Probar en la app" : language === "bg" ? "Опитай в приложението" : "Try in app"}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SAVINGS CALCULATOR */}
      <section id="calculator" className="py-20 bg-stone-900/40 border-y border-stone-850 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              {language === "es" ? "Simulador de Ahorro en Vivo" : language === "bg" ? "Калкулатор за спестявания на живо" : "Live Savings Simulator"}
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-['Outfit'] tracking-tight">
              {language === "es"
                ? "¿Cuánto puedes ahorrar con BalkanBite?"
                : language === "bg"
                ? "Колко можете да спестите с BalkanBite?"
                : "How much can you save with BalkanBite?"}
            </h2>
          </div>

          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-stone-300">
                      {language === "es" ? "Personas en el hogar:" : language === "bg" ? "Членове на домакинството:" : "Household members:"}
                    </span>
                    <span className="text-base font-extrabold text-emerald-400">{familyMembers}</span>
                  </div>
                  <input type="range" min="1" max="6" value={familyMembers} onChange={(e) => setFamilyMembers(Number(e.target.value))} className="w-full accent-emerald-500" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-stone-300">
                      {language === "es" ? "Gasto mensual:" : language === "bg" ? "Месечен разход за храна:" : "Monthly grocery spend:"}
                    </span>
                    <span className="text-base font-extrabold text-amber-400">{Math.round(monthlySpend * currRatio)} {currSymbol}</span>
                  </div>
                  <input type="range" min="120" max="900" step="20" value={monthlySpend} onChange={(e) => setMonthlySpend(Number(e.target.value))} className="w-full accent-amber-500" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-stone-950 to-stone-900 border border-emerald-500/30 rounded-2xl p-6 flex flex-col justify-between text-center relative overflow-hidden shadow-inner">
                <div className="space-y-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                    {language === "es" ? "Tu Ahorro Estimado" : language === "bg" ? "Вашето очаквано спестяване" : "Your Estimated Savings"}
                  </span>
                  <div className="pt-2">
                    <div className="text-4xl sm:text-5xl font-black text-white font-['Outfit'] tracking-tight">
                      +{Math.round(monthlySavings * currRatio)} {currSymbol}
                      <span className="text-base font-bold text-stone-400 ml-1">
                        / {language === "es" ? "mes" : language === "bg" ? "месец" : "mo"}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-emerald-400 mt-1">
                      ≈ +{Math.round(annualSavings * currRatio)} {currSymbol} {language === "es" ? "al año ahorrados" : language === "bg" ? "спестени годишно" : "saved per year"}
                    </p>
                  </div>
                </div>
                <div className="pt-6">
                  <button onClick={onOpenApp} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all cursor-pointer">
                    {language === "es" ? "Empezar a Ahorrar" : language === "bg" ? "Започнете да спестявате" : "Start Saving Today"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-stone-400 bg-stone-900 px-3 py-1 rounded-full border border-stone-800">
              {language === "es" ? "Comparativa Directa" : language === "bg" ? "Директно сравнение" : "Direct Comparison"}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-['Outfit']">
              {language === "es" ? "Cocina Tradicional vs BalkanBite" : language === "bg" ? "Традиционна кухня vs BalkanBite" : "Traditional Way vs BalkanBite"}
            </h2>
          </div>
          <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-xl text-xs sm:text-sm">
            <div className="grid grid-cols-3 bg-stone-850 p-4 border-b border-stone-800 font-extrabold text-stone-400">
              <span>{language === "es" ? "Aspecto" : language === "bg" ? "Функция" : "Feature"}</span>
              <span className="text-center">{language === "es" ? "Tradicional" : language === "bg" ? "Традиционно" : "Traditional"}</span>
              <span className="text-emerald-400 text-center">BalkanBite AI</span>
            </div>
            {(language === "es"
              ? [
                  { aspect: "Inventario", old: "Olvidos y desperdicio", new: "Escaneo Visual IA" },
                  { aspect: "Menú Semanal", old: "Improvisación diaria", new: "Plan de 7 días" },
                  { aspect: "Lista de la Compra", old: "Notas de papel dispersas", new: "WhatsApp Sync" }
                ]
              : language === "bg"
              ? [
                  { aspect: "Инвентар", old: "Забравени храни и отпадък", new: "AI Визуален скенер" },
                  { aspect: "Седмично меню", old: "Ежедневен стрес и импровизация", new: "7-дневен смарт план" },
                  { aspect: "Списък за пазаруване", old: "Разпилени хвърчащи бележки", new: "WhatsApp синхронизация" }
                ]
              : [
                  { aspect: "Inventory", old: "Forgotten items & food waste", new: "Visual AI Scanning" },
                  { aspect: "Weekly Menu", old: "Daily improvisation stress", new: "7-Day Smart Plan" },
                  { aspect: "Grocery List", old: "Scattered paper notes", new: "WhatsApp Sync" }
                ]
            ).map((row, i) => (
              <div key={i} className="grid grid-cols-3 p-4 items-center border-b border-stone-800/80">
                <span className="font-semibold text-stone-200">{row.aspect}</span>
                <span className="text-stone-400 text-center">{row.old}</span>
                <span className="text-emerald-400 text-center font-bold">{row.new}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-20 bg-stone-900/40 border-y border-stone-850 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              {language === "es" ? "Historias Reales" : language === "bg" ? "Реални отзиви" : "Real Stories"}
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-['Outfit']">
              {language === "es"
                ? "+8.500 hogares cocinando mejor"
                : language === "bg"
                ? "+8 500 домакинства готвят по-добре"
                : "8,500+ homes cooking smarter"}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {LANDING_DATA.testimonials.map((t, idx) => (
              <div key={idx} className="bg-stone-900 border border-stone-800 rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-lg">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex text-amber-400">{[...Array(t.rating)].map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400" />)}</div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">{t.savings}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-300 italic leading-relaxed">"{t.comment[language]}"</p>
                </div>
                <div className="flex items-center gap-3 pt-3 border-t border-stone-800">
                  <img src={t.avatar} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                  <div><h4 className="text-xs sm:text-sm font-bold text-white">{t.name}</h4><p className="text-[11px] text-stone-400">{t.role[language]}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-['Outfit']">
              {language === "es" ? "Planes Transparentes" : language === "bg" ? "Прозрачни планове" : "Simple Pricing"}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">{LANDING_DATA.pricing.free.name[language]}</h3>
                <div className="text-3xl font-black text-white">{LANDING_DATA.pricing.free.price}</div>
                <div className="space-y-2.5 pt-4 border-t border-stone-800 text-xs text-stone-300">
                  {LANDING_DATA.pricing.free.features[language].map((f, i) => <div key={i} className="flex items-center gap-2"><Check className="w-3 h-3" /><span>{f}</span></div>)}
                </div>
              </div>
              <button onClick={onOpenApp} className="mt-6 w-full py-3 rounded-xl bg-stone-800 hover:bg-stone-750 text-white font-bold text-xs cursor-pointer">
                {language === "es" ? "Empezar Gratis" : language === "bg" ? "Започни безплатно" : "Get Started Free"}
              </button>
            </div>
            <div className="bg-gradient-to-b from-stone-900 to-stone-950 border-2 border-emerald-500/70 rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative shadow-2xl">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-stone-950 font-extrabold text-[10px] px-3 py-0.5 rounded-full uppercase">{LANDING_DATA.pricing.pro.badge[language]}</div>
              <div className="space-y-4 pt-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-1.5">{LANDING_DATA.pricing.pro.name[language]} <Sparkles className="w-4 h-4 text-amber-400" /></h3>
                <div className="text-3xl font-black text-emerald-400">{LANDING_DATA.pricing.pro.price}</div>
                <div className="space-y-2.5 pt-4 border-t border-stone-800 text-xs text-stone-200">
                  {LANDING_DATA.pricing.pro.features[language].map((f, i) => <div key={i} className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-400" /><span>{f}</span></div>)}
                </div>
              </div>
              <button onClick={() => { onOpenApp(); onOpenPro(); }} className="mt-6 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg cursor-pointer">
                {language === "es" ? "Probar 7 Días Gratis" : language === "bg" ? "Пробвай 7 дни безплатно" : "Try 7 Days Free"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-stone-900/40 border-y border-stone-850 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-2"><h2 className="text-2xl sm:text-3xl font-extrabold text-white font-['Outfit']">FAQ</h2></div>
          <div className="space-y-3">
            {LANDING_DATA.faq.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden">
                  <button type="button" onClick={() => setOpenFaqIndex(isOpen ? null : idx)} className="w-full p-4 flex items-center justify-between text-left text-xs sm:text-sm font-bold text-white hover:text-emerald-400 cursor-pointer">
                    <span>{item.question[language]}</span>{isOpen ? <ChevronUp className="w-4 h-4 text-emerald-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                  </button>
                  {isOpen && <div className="px-4 pb-4 text-xs sm:text-sm text-stone-300 leading-relaxed border-t border-stone-800/60 pt-3 animate-in fade-in duration-200">{item.answer[language]}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 px-4 sm:px-6 text-center">
        <div className="max-w-3xl mx-auto bg-gradient-to-tr from-emerald-950 via-stone-900 to-stone-900 border border-emerald-500/30 rounded-3xl p-8 sm:p-12 shadow-2xl space-y-6">
          <Utensils className="w-12 h-12 text-emerald-400 mx-auto" />
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-['Outfit'] tracking-tight">
            {language === "es"
              ? "Tu próxima comida rica y sin desperdicio empieza aquí."
              : language === "bg"
              ? "Вашето вкусно готвене без разхищение започва тук."
              : "Your smart, zero-waste kitchen starts right here."}
          </h2>
          <button onClick={onOpenApp} className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-2xl shadow-xl transition-all hover:scale-[1.02] inline-flex items-center gap-2 cursor-pointer">
            <span>
              {language === "es"
                ? "Abrir BalkanBite Gratis"
                : language === "bg"
                ? "Отвори BalkanBite безплатно"
                : "Open BalkanBite Free"}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      <footer className="border-t border-stone-850 py-10 px-4 text-center bg-stone-950 text-[10px] text-stone-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img
              src="/images/logo.jpg"
              alt="BalkanBite Logo"
              className="w-6 h-6 rounded-lg object-cover border border-emerald-500/30"
            />
            <span className="font-bold text-stone-300">BalkanBite AI</span>
          </div>
          <div className="flex items-center gap-4 text-stone-400">
            <a
              href="/privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-400 transition-colors underline cursor-pointer"
            >
              Política de Privacidad
            </a>
            <span>•</span>
            <a
              href="/terms.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-400 transition-colors underline cursor-pointer"
            >
              Términos del Servicio
            </a>
          </div>
          <p>© {new Date().getFullYear()} BalkanBite. Todos los derechos reservados.</p>
        </div>
      </footer>

      {/* Legal Modal */}
      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-lg w-full p-6 text-stone-200 max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-lg font-bold text-white font-['Outfit']">
                {legalModal === "privacy" ? "Política de Privacidad" : "Términos del Servicio"} - BalkanBite
              </h3>
              <button
                onClick={() => setLegalModal(null)}
                className="text-stone-400 hover:text-white p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            {legalModal === "privacy" ? (
              <div className="text-xs text-stone-300 leading-relaxed space-y-3">
                <p>En BalkanBite valoramos y protegemos la privacidad de tus datos personales.</p>
                <h4 className="font-bold text-emerald-400 text-sm">1. Información que recopilamos</h4>
                <p>Recopilamos únicamente tu correo electrónico y nombre de perfil suministrados a través de Google Sign-In para sincronizar tu inventario de despensa y recetas guardadas en la nube.</p>
                <h4 className="font-bold text-emerald-400 text-sm">2. Uso de la información</h4>
                <p>Tus datos son utilizados exclusivamente para ofrecerte recomendaciones culinarias personalizadas y sincronizar tu menú semanal entre dispositivos.</p>
                <h4 className="font-bold text-emerald-400 text-sm">3. Seguridad</h4>
                <p>Utilizamos Firebase Authentication y reglas de seguridad de Google Cloud Firestore para proteger el acceso a tus colecciones.</p>
              </div>
            ) : (
              <div className="text-xs text-stone-300 leading-relaxed space-y-3">
                <p>Bienvenido a los Términos del Servicio de BalkanBite.</p>
                <h4 className="font-bold text-emerald-400 text-sm">1. Uso del servicio</h4>
                <p>BalkanBite ofrece herramientas inteligentes para la gestión de despensa y generación de recetas. El usuario es responsable de verificar alergias e ingredientes.</p>
                <h4 className="font-bold text-emerald-400 text-sm">2. Cuentas de usuario</h4>
                <p>Al registrarte con tu cuenta de Google, te comprometes a hacer un uso adecuado de los servicios y mantener la seguridad de tus credenciales.</p>
              </div>
            )}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
