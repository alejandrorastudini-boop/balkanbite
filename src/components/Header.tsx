import React from "react";
import { Sparkles, Smartphone, Monitor, Sun, Moon, Globe, User as UserIcon, Bell, BellRing, ShoppingCart } from "lucide-react";
import { User } from "firebase/auth";
import { Language, Currency } from "../types";
import { t } from "../utils/translations";

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  currency: Currency;
  onCurrencyChange: (curr: Currency) => void;
  onOpenProModal: () => void;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  onGoToLanding?: () => void;
  currentUser?: User | null;
  onOpenAuthModal?: () => void;
  onOpenShoppingAdvisor?: () => void;
  shoppingUrgencyLevel?: "urgent" | "recommended" | "optimal";
  shoppingBadgeCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  currency,
  onCurrencyChange,
  onOpenProModal,
  theme = "dark",
  onToggleTheme,
  onGoToLanding,
  currentUser,
  onOpenAuthModal,
  onOpenShoppingAdvisor,
  shoppingUrgencyLevel = "optimal",
  shoppingBadgeCount = 0,
}) => {
  const currentText = t[language];
  const isDark = theme === "dark";
  const isUrgent = shoppingUrgencyLevel === "urgent";
  const isRecommended = shoppingUrgencyLevel === "recommended";

  return (
    <header
      id="app-header"
      className={`sticky top-0 z-30 px-2.5 sm:px-4 py-2 sm:py-3 transition-colors duration-200 ${
        isDark
          ? "bg-[#0B0F12]/90 backdrop-blur-md border-b border-white/[0.06] text-white shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
          : "bg-white/90 backdrop-blur-xl border-b border-stone-200/80 text-stone-900 shadow-xs"
      }`}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-1 sm:gap-4">
        {/* Brand identity */}
        <div
          className={`flex items-center gap-1.5 sm:gap-3 shrink-0 ${onGoToLanding ? "cursor-pointer group" : ""}`}
          onClick={onGoToLanding}
          title={onGoToLanding ? currentText.viewLandingPage : undefined}
        >
          <img
            src="/images/logo.jpg"
            alt="BalkanBite Logo"
            className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl object-cover border-2 border-emerald-500/40 shadow-[0_2px_10px_rgba(16,185,129,0.25)] shrink-0 group-hover:scale-105 group-hover:border-emerald-400 transition-all"
          />
          <div className="shrink-0">
            <div className="flex items-center gap-1 sm:gap-2">
              <h1 className="text-sm sm:text-lg font-extrabold tracking-tight font-['Outfit'] group-hover:text-emerald-400 transition-colors whitespace-nowrap">
                {currentText.appName}
              </h1>
              <button
                id="header-pro-badge"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenProModal();
                }}
                className="hidden sm:flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer shrink-0 uppercase tracking-widest"
                title="BalkanBite Pro Tier"
              >
                <Sparkles className="w-2.5 h-2.5" />
                PRO
              </button>
            </div>
            <p className="text-[10px] sm:text-xs text-stone-400 hidden md:block truncate font-medium">
              {currentText.tagline}
            </p>
          </div>
        </div>

        {/* Action controls - guaranteed no overflow on mobile */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Shopping Alert & Urgency Bell */}
          {onOpenShoppingAdvisor && (
            <button
              id="header-shopping-alert-btn"
              type="button"
              onClick={onOpenShoppingAdvisor}
              className={`relative w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg sm:rounded-xl border transition-all cursor-pointer shrink-0 ${
                isUrgent
                  ? "bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.3)] animate-pulse"
                  : isRecommended
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.25)]"
                  : isDark
                  ? "bg-white/[0.04] border-white/[0.08] text-stone-400 hover:text-white hover:bg-white/[0.08]"
                  : "bg-stone-100 border-stone-200 text-stone-600 hover:text-stone-900"
              }`}
              title={
                language === "es"
                  ? isUrgent
                    ? "¡Alerta! Necesitas ir a comprar para tus menús"
                    : "Asesor y avisos de compra"
                  : isUrgent
                  ? "Alert! Shopping needed for planned meals"
                  : "Shopping Advisor & alerts"
              }
            >
              {isUrgent ? (
                <BellRing className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
              ) : isRecommended ? (
                <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              ) : (
                <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
              {shoppingBadgeCount > 0 && (
                <span
                  className={`absolute -top-1 -right-1 text-[8px] sm:text-[9px] font-black w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center shadow-xs ${
                    isUrgent
                      ? "bg-red-500 text-stone-950"
                      : isRecommended
                      ? "bg-amber-400 text-stone-950"
                      : "bg-emerald-500 text-stone-950"
                  }`}
                >
                  {shoppingBadgeCount > 9 ? "9+" : shoppingBadgeCount}
                </span>
              )}
            </button>
          )}

          {/* Theme Switcher */}
          {onToggleTheme && (
            <button
              id="theme-toggle-btn"
              type="button"
              onClick={onToggleTheme}
              className={`w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg sm:rounded-xl border transition-all cursor-pointer shrink-0 ${
                isDark
                  ? "bg-white/[0.04] border-white/[0.08] text-amber-400 hover:bg-white/[0.08] hover:text-amber-300"
                  : "bg-stone-100 border-stone-200 text-amber-600 hover:bg-stone-200"
              }`}
              title={
                isDark
                  ? language === "es"
                    ? "Cambiar a tema claro"
                    : language === "bg"
                    ? "Светла тема"
                    : "Switch to light theme"
                  : language === "es"
                  ? "Cambiar a tema oscuro"
                  : language === "bg"
                  ? "Тъмна тема"
                  : "Switch to dark theme"
              }
            >
              {isDark ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          )}

          {/* Language Switcher: Compact tap-to-cycle on mobile, 3-button segmented on desktop */}
          <div className="shrink-0 flex items-center">
            {/* Mobile single tap language cycle */}
            <button
              id="lang-btn-mobile"
              type="button"
              onClick={() => {
                const nextLang: Record<Language, Language> = {
                  es: "en",
                  en: "bg",
                  bg: "es",
                };
                onLanguageChange(nextLang[language]);
              }}
              className={`sm:hidden text-[11px] font-extrabold px-1.5 py-1 rounded-lg border transition-all cursor-pointer ${
                isDark
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 active:bg-emerald-500/20"
                  : "bg-emerald-50 border-emerald-300 text-emerald-800 active:bg-emerald-100"
              }`}
              title={
                language === "es"
                  ? "Idioma: Español. Toca para cambiar."
                  : language === "bg"
                  ? "Език: Български. Докоснете за смяна."
                  : "Language: English. Tap to cycle."
              }
            >
              {language === "es" ? "ES" : language === "en" ? "EN" : "BG"}
            </button>

            {/* Desktop segmented switch */}
            <div
              className={`hidden sm:flex items-center rounded-xl p-0.5 border shrink-0 ${
                isDark ? "bg-white/[0.02] border-white/[0.04]" : "bg-stone-100 border-stone-200"
              }`}
            >
              <button
                id="lang-btn-es"
                type="button"
                onClick={() => onLanguageChange("es")}
                className={`text-[11px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  language === "es"
                    ? "bg-emerald-500 text-stone-950 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                    : isDark
                    ? "text-stone-500 hover:text-stone-300 hover:bg-white/[0.04]"
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
                className={`text-[11px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  language === "en"
                    ? "bg-emerald-500 text-stone-950 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                    : isDark
                    ? "text-stone-500 hover:text-stone-300 hover:bg-white/[0.04]"
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
                className={`text-[11px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  language === "bg"
                    ? "bg-emerald-500 text-stone-950 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                    : isDark
                    ? "text-stone-500 hover:text-stone-300 hover:bg-white/[0.04]"
                    : "text-stone-500 hover:text-stone-900"
                }`}
                title="Български"
              >
                БГ
              </button>
            </div>
          </div>

          {/* Currency Switcher: Compact tap-to-toggle on mobile, segmented on desktop */}
          <div className="shrink-0 flex items-center">
            {/* Mobile single tap toggle */}
            <button
              id="curr-btn-mobile"
              type="button"
              onClick={() => onCurrencyChange(currency === "EUR" ? "USD" : "EUR")}
              className={`sm:hidden text-[11px] font-extrabold px-1.5 py-1 rounded-lg border transition-all cursor-pointer ${
                isDark
                  ? "bg-white/[0.02] border-white/[0.08] text-emerald-400 active:bg-white/[0.04]"
                  : "bg-stone-100 border-stone-200 text-emerald-700 active:bg-stone-200"
              }`}
              title={
                language === "es"
                  ? `Moneda actual: ${currency}. Toca para cambiar.`
                  : language === "bg"
                  ? `Текуща валута: ${currency}. Докоснете за смяна.`
                  : `Current currency: ${currency}. Tap to change.`
              }
            >
              {currency === "EUR" ? "€" : "$"}
            </button>

            {/* Desktop segmented switch */}
            <div
              className={`hidden sm:flex items-center rounded-xl p-0.5 border ${
                isDark ? "bg-white/[0.02] border-white/[0.04]" : "bg-stone-100 border-stone-200"
              }`}
            >
              <button
                id="curr-btn-eur"
                type="button"
                onClick={() => onCurrencyChange("EUR")}
                className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  currency === "EUR"
                    ? "bg-emerald-500 text-stone-950 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                    : isDark
                    ? "text-stone-500 hover:text-stone-300 hover:bg-white/[0.04]"
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
                className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  currency === "USD"
                    ? "bg-emerald-500 text-stone-950 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
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

          {/* Go to Landing button (Desktop & tablet only, mobile uses logo or profile) */}
          {onGoToLanding && (
            <button
              id="header-goto-landing-btn"
              type="button"
              onClick={onGoToLanding}
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-colors cursor-pointer shrink-0 text-xs font-bold ${
                isDark
                  ? "bg-white/[0.02] border-white/[0.04] text-stone-400 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-white/[0.04]"
                  : "bg-stone-100 border-stone-200 text-stone-700 hover:text-emerald-600 hover:bg-stone-200"
              }`}
              title={currentText.viewLandingPage}
            >
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>Landing</span>
            </button>
          )}

          {/* Cloud Auth / Account button - compact avatar/icon on mobile, full on desktop */}
          {onOpenAuthModal && (
            <button
              id="header-auth-btn"
              type="button"
              onClick={onOpenAuthModal}
              className={`w-7 h-7 sm:w-auto sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl border transition-colors cursor-pointer shrink-0 text-xs font-bold flex items-center justify-center sm:gap-2 ${
                currentUser
                  ? isDark
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                    : "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                  : isDark
                  ? "bg-white/[0.02] border-white/[0.04] text-stone-400 hover:text-white hover:border-white/[0.1]"
                  : "bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200"
              }`}
              title={
                currentUser
                  ? currentUser.email || "Cuenta de Google"
                  : language === "es"
                  ? "Iniciar sesión con Google"
                  : language === "bg"
                  ? "Вход с Google"
                  : "Sign In with Google"
              }
            >
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt="Usuario"
                  className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover shrink-0 border border-emerald-500/50"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
              )}
              <span className="hidden sm:inline truncate max-w-[70px]">
                {currentUser ? (currentUser.displayName?.split(" ")[0] || "Perfil") : "Google"}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
