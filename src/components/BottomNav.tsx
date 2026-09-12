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
      id: "recipes" as TabType,
      label: currentText.navRecipes,
      icon: ChefHat,
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
      className={`fixed bottom-0 left-0 right-0 z-30 backdrop-blur-xl px-2 sm:px-4 py-2 transition-colors duration-200 ${
        isDark
          ? "bg-stone-900/95 border-t border-stone-800/80"
          : "bg-white/95 border-t border-stone-200/90 shadow-md"
      }`}
    >
      <div className="max-w-lg mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}`}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 sm:px-2 rounded-xl transition-all duration-200 cursor-pointer relative group ${
                isActive
                  ? "text-emerald-500 font-bold"
                  : isDark
                  ? "text-stone-400 hover:text-stone-200"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {/* Active pill indicator at the top */}
              {isActive && (
                <div className="absolute -top-2 w-8 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full shadow-xs shadow-emerald-400/50" />
              )}

              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? "scale-110 text-emerald-500" : ""
                  }`}
                />
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center shadow-xs border ${
                      isDark ? "border-stone-900" : "border-white"
                    } ${item.badgeColor}`}
                  >
                    {item.count > 99 ? "99+" : item.count}
                  </span>
                )}
              </div>

              <span
                className={`text-[10px] sm:text-[11px] mt-1 tracking-tight truncate max-w-[65px] sm:max-w-none transition-colors ${
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
