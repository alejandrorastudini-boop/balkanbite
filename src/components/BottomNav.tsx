import React from "react";
import { Layers, ChefHat, ShoppingCart, User, Calendar } from "lucide-react";
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
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  language,
  pantryCount,
  shoppingCount,
  theme = "dark",
}) => {
  const currentText = t[language];
  const isDark = theme === "dark";

  const navItems = [
    {
      id: "pantry" as TabType,
      label: currentText.navPantry,
      icon: Layers,
      count: pantryCount,
      badgeColor: "bg-emerald-600 text-white",
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
      id: "recipes" as TabType,
      label: currentText.navRecipes,
      icon: ChefHat,
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
      className={`fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] sm:max-w-[440px] md:max-w-[520px] z-40 backdrop-blur-md px-2 py-2 transition-all duration-300 rounded-3xl ${
        isDark
          ? "bg-[#131A1F]/80 border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
          : "bg-white/85 border border-stone-200/90 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)]"
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
              onClick={() => onChangeTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 px-1 sm:px-2 rounded-2xl transition-all duration-300 cursor-pointer relative group ${
                isActive
                  ? isDark
                    ? "text-emerald-400 font-bold"
                    : "text-emerald-700 font-extrabold"
                  : isDark
                  ? "text-stone-500 hover:text-stone-300 hover:bg-white/[0.04]"
                  : "text-stone-500 hover:text-stone-900 hover:bg-slate-100"
              }`}
            >
              {/* Active pill indicator at the bottom */}
              {isActive && (
                <div className="absolute -bottom-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
              )}

              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-300 ${
                    isActive
                      ? isDark
                        ? "scale-110 text-emerald-400"
                        : "scale-110 text-emerald-700"
                      : "group-hover:-translate-y-0.5"
                  }`}
                />
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center shadow-md border ${
                      isDark ? "border-[#131A1F]" : "border-white"
                    } ${item.badgeColor}`}
                  >
                    {item.count > 99 ? "99+" : item.count}
                  </span>
                )}
              </div>

              <span
                className={`text-[10px] mt-1.5 tracking-tight truncate max-w-[65px] sm:max-w-none transition-colors ${
                  isActive
                    ? "text-emerald-500 font-bold"
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
