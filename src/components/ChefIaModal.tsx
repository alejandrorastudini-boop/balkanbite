import React, { useEffect } from "react";
import { X, Sparkles, ChefHat, Maximize2 } from "lucide-react";
import { Language, PantryItem, MealLog, ChatMessage } from "../types";
import { VoiceChefView } from "./VoiceChefView";
import type { FoodSafetyQuarantine } from "../utils/foodSafetyQuarantine";

interface ChefIaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExpandToTab?: () => void;
  pantry: PantryItem[];
  mealLogs?: MealLog[];
  chatMessages: ChatMessage[];
  onUpdateChatMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  onClearChat: () => void;
  onAddItemsToPantry: (items: any[]) => boolean;
  onAddItemsToShoppingList: (items: any[]) => boolean;
  onDeductItemsFromPantry: (items: any[]) => boolean;
  onNavigateToRecipes: (query?: string) => void;
  onLogMeal: (log: any) => void;
  foodSafety: FoodSafetyQuarantine;
  language: Language;
}

export const ChefIaModal: React.FC<ChefIaModalProps> = ({
  isOpen,
  onClose,
  onExpandToTab,
  pantry,
  mealLogs,
  chatMessages,
  onUpdateChatMessages,
  onClearChat,
  onAddItemsToPantry,
  onAddItemsToShoppingList,
  onDeductItemsFromPantry,
  onNavigateToRecipes,
  onLogMeal,
  foodSafety,
  language,
}) => {
  // Prevent scrolling background when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      id="chef-ia-modal-backdrop"
      className="fixed inset-0 z-50 bg-[#0B0F12] flex flex-col h-full w-full overflow-hidden animate-in fade-in duration-200"
    >
      <div
        id="chef-ia-modal-panel"
        className="w-full flex-1 flex flex-col h-full max-w-4xl mx-auto overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/[0.06] bg-[#131A1F]/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-inner shrink-0">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white font-['Outfit'] tracking-wide flex items-center gap-1.5">
                  <span>{language === "es" ? "Chef IA Asistente" : language === "bg" ? "AI Шеф Асистент" : "AI Chef Assistant"}</span>
                  <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                </h3>
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  Online
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-stone-400 font-medium">
                {language === "es"
                  ? "Asistente de voz, despensa y cocina inteligente"
                  : language === "bg"
                  ? "Гласов асистент за готвене и интелигентен склад"
                  : "Smart voice assistant, pantry & cooking guidance"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="close-chef-ia-modal-btn"
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-white/[0.04] text-stone-300 hover:text-white hover:bg-white/[0.08] border border-white/[0.08] transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title={language === "es" ? "Cerrar Chef IA" : language === "bg" ? "Затвори" : "Close"}
            >
              <X className="w-4 h-4 text-emerald-400" />
              <span>{language === "es" ? "Volver" : language === "bg" ? "Назад" : "Back"}</span>
            </button>
          </div>
        </div>

        {/* Modal Body - VoiceChefView Full Height */}
        <div className="flex-1 overflow-hidden px-3 sm:px-6 py-2 flex flex-col bg-transparent min-h-0">
          <VoiceChefView
            pantry={pantry}
            mealLogs={mealLogs}
            chatMessages={chatMessages}
            onUpdateChatMessages={onUpdateChatMessages}
            onClearChat={onClearChat}
            onAddItemsToPantry={onAddItemsToPantry}
            onAddItemsToShoppingList={onAddItemsToShoppingList}
            onDeductItemsFromPantry={onDeductItemsFromPantry}
            onNavigateToRecipes={(q) => {
              onNavigateToRecipes(q);
              onClose();
            }}
            onLogMeal={onLogMeal}
            foodSafety={foodSafety}
            language={language}
          />
        </div>
      </div>
    </div>
  );
};
