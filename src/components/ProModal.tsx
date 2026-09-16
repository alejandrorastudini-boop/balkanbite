import React, { useState } from "react";
import { Sparkles, Check, X, Shield, Zap, Heart, ChefHat, Tag, ArrowRight } from "lucide-react";
import { Language, Currency } from "../types";

interface ProModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  currency: Currency;
  isPro: boolean;
  onTogglePro: () => void;
}

export const ProModal: React.FC<ProModalProps> = ({
  isOpen,
  onClose,
  language,
  currency,
  isPro,
  onTogglePro,
}) => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");

  if (!isOpen) return null;

  const currSymbol = currency === "USD" ? "$" : "€";
  const monthlyPrice = currency === "USD" ? "$3.99" : "3.99€";
  const annualPrice = currency === "USD" ? "$29.99" : "29.99€";
  const monthlyEquivalentInAnnual = currency === "USD" ? "$2.49" : "2.49€";

  const texts = {
    es: {
      tagline: "Chef Nutricionista IA Personal y Radar de Supermercados",
      subtitle: "Cocina saludable, ahorra hasta 120€ al mes en comida y nunca tires alimentos.",
      monthly: "Mensual",
      annual: "Anual (Ahorra 37%)",
      perMonth: "/ mes",
      perYear: "/ año",
      billedAnnually: `Facturado anualmente a ${annualPrice} (${monthlyEquivalentInAnnual}/mes)`,
      billedMonthly: "Facturación mensual flexible",
      features: [
        {
          title: "Chef Nutricionista IA Ilimitado",
          desc: "Genera recetas personalizadas según tus ingredientes, macros, calorías y velocidad de cocinado.",
        },
        {
          title: "Deducción Automática de Despensa",
          desc: "Al cocinar un plato, el inventario se actualiza automáticamente con un clic.",
        },
        {
          title: "Radar de Precios de Supermercado",
          desc: "Estimación realista de costes de la compra para optimizar tu presupuesto semanal.",
        },
        {
          title: "Vigilante Anti-Desperdicio",
          desc: "Alertas inteligentes para ingredientes que caducan en 2-4 días y recetas para aprovecharlos.",
        },
        {
          title: "Dictado por Voz Inteligente",
          desc: "Añade tickets y compras enteras con manos libres mientras guardas la compra.",
        },
      ],
      activeProText: "Estado de la suscripción Pro no disponible",
      keepActive: "Mantener Suscripción Activa",
      activateBtn: `Activar BalkanBite Pro (${billingCycle === "annual" ? annualPrice : monthlyPrice})`,
      guarantee: "Cancela en 1 clic en cualquier momento. Sin compromisos ni letra pequeña.",
    },
    bg: {
      tagline: "Неограничен кулинарен AI и радар за хранителни стоки",
      subtitle: "Гответе балансирано, пестете до 120€ месечно и намалете изхвърлянето на храна.",
      monthly: "Месечен",
      annual: "Годишен",
      perMonth: "/ месец",
      perYear: "/ година",
      billedAnnually: `Таксува се годишно ${annualPrice} (${monthlyEquivalentInAnnual}/месец)`,
      billedMonthly: "Гъвкав месечен абонамент",
      features: [
        {
          title: "Неограничен Кулинарен AI",
          desc: "Генерирайте балансирани ястия според вашите съставки, калории и цели.",
        },
        {
          title: "Автоматична Синхронизация на Килера",
          desc: "При готвене използваните съставки се изваждат автоматично от наличностите.",
        },
        {
          title: "Ценови Радар за Супермаркети",
          desc: "Реалистични цени за планиране на здравословно седмично меню с минимален бюджет.",
        },
        {
          title: "Защита Срещу Изхвърляне на Храна",
          desc: "Известия за съставки с изтичащ срок и идеи за незабавно оползотворяване.",
        },
        {
          title: "Гласово Диктуване Без Ръце",
          desc: "Добавяйте цели покупки само с глас, докато подреждате продуктите у дома.",
        },
      ],
      activeProText: "Активен Pro Абонамент",
      keepActive: "Поддържай абонамента активен",
      activateBtn: `Активирай BalkanBite Pro (${billingCycle === "annual" ? annualPrice : monthlyPrice})`,
      guarantee: "Отказ по всяко време с 1 клик. Без скрити такси.",
    },
    en: {
      tagline: "Personal AI Nutrition Chef & Grocery Radar",
      subtitle: "Cook healthy, save up to €120/month on groceries, and eliminate food waste.",
      monthly: "Monthly",
      annual: "Annual (Save 37%)",
      perMonth: "/ month",
      perYear: "/ year",
      billedAnnually: `Billed annually at ${annualPrice} (${monthlyEquivalentInAnnual}/mo)`,
      billedMonthly: "Flexible monthly billing",
      features: [
        {
          title: "Unlimited AI Nutritionist",
          desc: "Tailored recipes adapting to your macros, health goals, and speed of preparation.",
        },
        {
          title: "Live Pantry Deductions",
          desc: "Cooking a meal automatically updates and syncs your pantry inventory in real-time.",
        },
        {
          title: "Market Price Radar",
          desc: "Hyper-realistic item pricing to keep your nutritious weekly grocery cart under budget.",
        },
        {
          title: "Anti-Food-Waste Watchdog",
          desc: "Smart alerts for ingredients expiring in 2-4 days with instant rescue recipe recommendations.",
        },
        {
          title: "Hands-Free Voice Dictation",
          desc: "Add groceries and inventory adjustments seamlessly using voice.",
        },
      ],
      activeProText: "Pro subscription status unavailable",
      keepActive: "Keep Subscription Active",
      activateBtn: `Activate BalkanBite Pro (${billingCycle === "annual" ? annualPrice : monthlyPrice})`,
      guarantee: "Cancel anytime with 1 click. No questions asked.",
    },
  };

  const t = texts[language] || texts.es;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="bg-stone-900 border border-amber-500/40 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl relative overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow gradients */}
        <div className="absolute -top-24 -right-24 w-52 h-52 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center text-white font-black shadow-lg shadow-amber-950/50">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white font-['Outfit'] tracking-tight">
                  BalkanBite Pro
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold uppercase tracking-wider border border-amber-500/30">
                  Premium
                </span>
              </div>
              <p className="text-xs text-amber-200/90 font-medium">
                {t.tagline}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Billing cycle toggle */}
        <div className="bg-stone-950/80 p-1 rounded-xl border border-stone-800 flex relative z-10">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              billingCycle === "monthly"
                ? "bg-stone-800 text-white shadow-sm"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            {t.monthly} ({monthlyPrice}/m)
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("annual")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              billingCycle === "annual"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            <span>{t.annual}</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500 text-stone-950 font-extrabold uppercase">
              -37%
            </span>
          </button>
        </div>

        {/* Highlight Price Banner */}
        <div className="bg-gradient-to-br from-stone-800/90 to-stone-900 border border-amber-500/30 rounded-2xl p-4 text-center space-y-1 relative z-10 shadow-inner">
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-3xl font-black text-white font-['Outfit']">
              {billingCycle === "annual" ? monthlyEquivalentInAnnual : monthlyPrice}
            </span>
            <span className="text-xs text-stone-400 font-semibold">{t.perMonth}</span>
          </div>
          <p className="text-[11px] text-amber-300/90 font-medium">
            {billingCycle === "annual" ? t.billedAnnually : t.billedMonthly}
          </p>
        </div>

        {/* Feature List */}
        <div className="space-y-2.5 relative z-10 text-xs">
          {t.features.map((feat, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-stone-200">
              <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </div>
              <div className="space-y-0.5">
                <span className="font-bold text-white block">{feat.title}</span>
                <span className="text-stone-400 text-[11px] leading-relaxed block">{feat.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <div className="pt-2 relative z-10 space-y-2">
          <button
            type="button"
            onClick={() => {
              onTogglePro();
              onClose();
            }}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-emerald-500 to-teal-500 hover:opacity-95 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-950/40 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{isPro ? t.keepActive : t.activateBtn}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[10px] text-center text-stone-400 font-medium">
            {t.guarantee}
          </p>
        </div>
      </div>
    </div>
  );
};
