import React from "react";
import { Sparkles, Smartphone, Monitor, Sun, Moon, Globe } from "lucide-react";
import { Language, Currency } from "../types";
import { t } from "../utils/translations";

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  currency: Currency;
  onCurrencyChange: (curr: Currency) => void;
  isMobileFrame: boolean;
  onToggleFrame: () => void;
  onOpenProModal: () => void;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  onGoToLanding?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  currency,
  onCurrencyChange,
  isMobileFrame,
  onToggleFrame,
  onOpenProModal,
  theme = "dark",
  onToggleTheme,
  onGoToLanding,
}) => {
  const currentText = t[language];
  const isDark = theme === "dark";

  return (
    <header
      id="app-header"
      className={`sticky top-0 z-30 px-2.5 sm:px-4 py-2 transition-colors duration-200 ${
        isDark
          ? "bg-stone-900/95 backdrop-blur-md border-b border-stone-800/80 text-stone-100"
          : "bg-white/95 backdrop-blur-md border-b border-stone-200/80 text-stone-900 shadow-xs"
      }`}
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Brand identity */}
        <div
          className={`flex items-center gap-2 shrink min-w-0 ${onGoToLanding ? "cursor-pointer group" : ""}`}
          onClick={onGoToLanding}
          title={onGoToLanding ? "Ver Landing Page" : undefined}
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-amber-500 flex items-center justify-center shadow-md shadow-emerald-950/30 text-white font-extrabold text-sm sm:text-base tracking-wider shrink-0 group-hover:scale-105 transition-transform">
            BB
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight font-['Outfit'] truncate group-hover:text-emerald-400 transition-colors">
                {currentText.appName}
              </h1>
              <button
                id="header-pro-badge"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenProModal();
                }}
                className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-emerald-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/30 hover:scale-105 transition-transform cursor-pointer shrink-0"
                title="BalkanBite Pro Tier"
              >
                <Sparkles className="w-2.5 h-2.5" />
                PRO
              </button>
            </div>
            <p className="text-[10px] sm:text-[11px] text-stone-400 hidden sm:block truncate">
              {currentText.tagline}
            </p>
          </div>
        </div>

        {/* Action controls - guaranteed no overflow on mobile */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Theme Switcher */}
          {onToggleTheme && (
            <button
              id="theme-toggle-btn"
              type="button"
              onClick={onToggleTheme}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                isDark
                  ? "bg-stone-800 border-stone-700 text-amber-300 hover:bg-stone-700 hover:text-amber-200"
                  : "bg-stone-100 border-stone-200 text-amber-600 hover:bg-stone-200"
              }`}
              title={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            >
              {isDark ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          )}

          {/* Language Switcher */}
          <div
            className={`flex items-center rounded-lg p-0.5 border shrink-0 ${
              isDark ? "bg-stone-800/90 border-stone-700" : "bg-stone-100 border-stone-200"
            }`}
          >
            <button
              id="lang-btn-es"
              type="button"
              onClick={() => onLanguageChange("es")}
              className={`text-[11px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                language === "es"
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : isDark
                  ? "text-stone-400 hover:text-stone-200"
                  : "text-stone-500 hover:text-stone-900"
              }`}
              title="Español"
            >
              ES
            </button>
            <button
              id="lang-btn-en"
              type="button"
              onClick={() => onLanguageChange("en")}
              className={`text-[11px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                language === "en"
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : isDark
                  ? "text-stone-400 hover:text-stone-200"
                  : "text-stone-500 hover:text-stone-900"
              }`}
              title="English"
            >
              EN
            </button>
            <button
              id="lang-btn-bg"
              type="button"
              onClick={() => onLanguageChange("bg")}
              className={`text-[11px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                language === "bg"
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : isDark
                  ? "text-stone-400 hover:text-stone-200"
                  : "text-stone-500 hover:text-stone-900"
              }`}
              title="Български"
            >
              БГ
            </button>
          </div>

          {/* Currency Switcher: Compact tap-to-toggle on mobile, segmented on desktop */}
          <div className="shrink-0 flex items-center">
            {/* Mobile single tap toggle */}
            <button
              id="curr-btn-mobile"
              type="button"
              onClick={() => onCurrencyChange(currency === "EUR" ? "USD" : "EUR")}
              className={`sm:hidden text-xs font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                isDark
                  ? "bg-stone-800 border-stone-700 text-emerald-400 active:bg-stone-700"
                  : "bg-stone-100 border-stone-200 text-emerald-700 active:bg-stone-200"
              }`}
              title={`Moneda actual: ${currency}. Toca para cambiar.`}
            >
              {currency === "EUR" ? "€" : "$"}
            </button>

            {/* Desktop segmented switch */}
            <div
              className={`hidden sm:flex items-center rounded-lg p-0.5 border ${
                isDark ? "bg-stone-800/90 border-stone-700" : "bg-stone-100 border-stone-200"
              }`}
            >
              <button
                id="curr-btn-eur"
                type="button"
                onClick={() => onCurrencyChange("EUR")}
                className={`text-xs font-semibold px-2 py-1 rounded-md transition-all cursor-pointer ${
                  currency === "EUR"
                    ? "bg-emerald-600 text-white font-bold"
                    : isDark
                    ? "text-stone-400 hover:text-stone-200"
                    : "text-stone-500 hover:text-stone-900"
                }`}
                title="Euro (€)"
              >
                €
              </button>
              <button
                id="curr-btn-usd"
                type="button"
                onClick={() => onCurrencyChange("USD")}
                className={`text-xs font-semibold px-2 py-1 rounded-md transition-all cursor-pointer ${
                  currency === "USD"
                    ? "bg-emerald-600 text-white font-bold"
                    : isDark
                    ? "text-stone-400 hover:text-stone-200"
                    : "text-stone-500 hover:text-stone-900"
                }`}
                title="US Dollar ($)"
              >
                $
              </button>
            </div>
          </div>

          {/* Go to Landing button */}
          {onGoToLanding && (
            <button
              id="header-goto-landing-btn"
              type="button"
              onClick={onGoToLanding}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors cursor-pointer shrink-0 text-xs font-semibold ${
                isDark
                  ? "bg-stone-800 border-stone-700 text-stone-300 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-stone-750"
                  : "bg-stone-100 border-stone-200 text-stone-700 hover:text-emerald-600 hover:bg-stone-200"
              }`}
              title="Ver Landing Page de BalkanBite"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Landing</span>
            </button>
          )}

          {/* Mobile frame preview toggle (desktop only) */}
          <button
            id="toggle-frame-btn"
            type="button"
            onClick={onToggleFrame}
            className={`hidden md:flex items-center justify-center w-8 h-8 rounded-lg border transition-colors cursor-pointer shrink-0 ${
              isDark
                ? "bg-stone-800 border-stone-700 text-stone-400 hover:text-white hover:bg-stone-700"
                : "bg-stone-100 border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-200"
            }`}
            title={isMobileFrame ? "Vista Amplia" : "Vista Móvil"}
          >
            {isMobileFrame ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
