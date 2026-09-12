import React from "react";
import { Layers, ChefHat, ShoppingCart, User, Calendar, Mic } from "lucide-react";
import { Language } from "../types";
import { t } from "../utils/translations";

export type TabType = "pantry" | "recipes" | "mealPlan" | "shopping" | "profile" | "voice";

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  language: Language;
  pantryCount: number;
  shoppingCount: number;
  theme?: "dark" | "light";
  onOpenChefIaModal?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  language,
  pantryCount,
  shoppingCount,
  theme = "dark",
  onOpenChefIaModal,
}) => {
  const currentText = t[language];
  const isDark = theme === "dark";

  const chefIaLabel =
    language === "es" ? "Chef IA" : language === "bg" ? "AI Шеф" : "AI Chef";

  const navItems = [
    {
      id: "pantry" as TabType,
      label: currentText.navPantry,
      icon: Layers,
      count: pantryCount,
      badgeColor: "bg-emerald-600 text-white",
    },
    {
      id: "recipes" as TabType,
      label: currentText.navRecipes,
      icon: ChefHat,
    },
    {
      id: "voice" as TabType,
      label: chefIaLabel,
      icon: Mic,
      isAi: true,
    },
    {
      id: "mealPlan" as TabType,
      label: currentText.navMealPlan,
      icon: Calendar,
    },
    {
      id: "shopping" as TabType,
      label: currentText.navShopping,
      icon: ShoppingCart,
      count: shoppingCount,
      badgeColor: "bg-amber-500 text-stone-950 font-bold",
    },
    {
      id: "profile" as TabType,
      label: currentText.navProfile,
      icon: User,
    },
  ];

  return (
    <nav
      id="bottom-navigation"
      className={`fixed bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-1.25rem)] sm:max-w-[480px] md:max-w-[560px] z-40 backdrop-blur-md px-1.5 sm:px-2 py-1.5 sm:py-2 transition-all duration-300 rounded-3xl ${
        isDark
          ? "bg-[#131A1F]/90 border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
          : "bg-white/90 border border-stone-200/90 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)]"
      }`}
    >
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}`}
              type="button"
              onClick={() => {
                if (item.id === "voice" && onOpenChefIaModal) {
                  onOpenChefIaModal();
                } else {
                  onChangeTab(item.id);
                }
              }}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 sm:py-2 px-0.5 sm:px-2 rounded-2xl transition-all duration-300 cursor-pointer relative group ${
                isActive
                  ? "text-emerald-400 font-bold"
                  : item.isAi
                  ? "text-emerald-400/90 hover:text-emerald-300"
                  : isDark
                  ? "text-stone-500 hover:text-stone-300 hover:bg-white/[0.04]"
                  : "text-stone-500 hover:text-stone-800 hover:bg-stone-100"
              }`}
            >
              {/* Active pill indicator at the bottom */}
              {isActive && (
                <div className="absolute -bottom-1 w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
              )}

              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-300 ${
                    isActive
                      ? "scale-110 text-emerald-400"
                      : item.isAi
                      ? "text-emerald-400 group-hover:scale-110"
                      : "group-hover:-translate-y-0.5"
                  }`}
                />
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-2 text-[9px] font-extrabold w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center shadow-md border ${
                      isDark ? "border-[#131A1F]" : "border-white"
                    } ${item.badgeColor}`}
                  >
                    {item.count > 99 ? "99+" : item.count}
                  </span>
                )}
              </div>

              <span
                className={`text-[9px] sm:text-[10px] mt-1 tracking-tight truncate max-w-[58px] sm:max-w-none transition-colors ${
                  isActive
                    ? "text-emerald-500 font-bold"
                    : item.isAi
                    ? "text-emerald-400 font-bold"
                    : isDark
                    ? "text-stone-400 group-hover:text-stone-300"
                    : "text-stone-500 group-hover:text-stone-800"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
