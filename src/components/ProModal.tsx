import React from "react";
import { Sparkles, Check, X } from "lucide-react";
import { Language } from "../types";

interface ProModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export const ProModal: React.FC<ProModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  if (!isOpen) return null;

  const texts = {
    es: {
      badge: "En planificación",
      title: "BalkanBite Pro",
      subtitle:
        "BalkanBite Pro es un concepto de producto futuro. No hay suscripción, cobro ni periodo de prueba activados.",
      featuresTitle: "Áreas que estamos evaluando",
      features: [
        "Más automatización para planificación y recetas.",
        "Herramientas avanzadas de presupuesto y compra basadas en datos conocidos.",
        "Flujos de voz y captura con las mismas confirmaciones de seguridad que el resto de la app.",
      ],
      note:
        "Precio, límites, disponibilidad y condiciones comerciales aún no están definidos. Esta pantalla no activa ninguna función Pro.",
      action: "Entendido",
    },
    bg: {
      badge: "В план",
      title: "BalkanBite Pro",
      subtitle:
        "BalkanBite Pro е концепция за бъдещ продукт. Няма активиран абонамент, плащане или пробен период.",
      featuresTitle: "Области, които оценяваме",
      features: [
        "Повече автоматизация за планиране и рецепти.",
        "Разширени инструменти за бюджет и покупки на база известни данни.",
        "Гласови и сканиращи потоци със същите потвърждения за безопасност като останалата част от приложението.",
      ],
      note:
        "Цена, лимити, наличност и търговски условия още не са определени. Този екран не активира Pro функции.",
      action: "Разбрах",
    },
    en: {
      badge: "Planned",
      title: "BalkanBite Pro",
      subtitle:
        "BalkanBite Pro is a future product concept. No subscription, billing, or trial is currently enabled.",
      featuresTitle: "Areas under evaluation",
      features: [
        "More automation for planning and recipes.",
        "Advanced budget and shopping tools based on known data.",
        "Voice and capture workflows with the same confirmation safeguards as the rest of the app.",
      ],
      note:
        "Pricing, limits, availability, and commercial terms are not defined yet. This screen does not activate any Pro capability.",
      action: "Got it",
    },
  };

  const t = texts[language] || texts.es;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div
        className="bg-stone-900 border border-amber-500/40 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-5 shadow-2xl relative overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -top-24 -right-24 w-52 h-52 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center text-white shadow-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white font-['Outfit'] tracking-tight">
                  {t.title}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold uppercase tracking-wider border border-amber-500/30">
                  {t.badge}
                </span>
              </div>
              <p className="text-xs text-stone-300 mt-1 leading-relaxed">
                {t.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative z-10 rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-300 mb-3">
            {t.featuresTitle}
          </h3>
          <div className="space-y-3">
            {t.features.map((feature) => (
              <div key={feature} className="flex items-start gap-2.5 text-xs text-stone-200">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
                <span className="leading-relaxed">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-[11px] leading-relaxed text-stone-400">
          {t.note}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="relative z-10 w-full py-3 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs transition-colors cursor-pointer"
        >
          {t.action}
        </button>
      </div>
    </div>
  );
};
