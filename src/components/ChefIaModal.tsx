import React, { useEffect } from "react";
import { X, Sparkles, ChefHat, Maximize2 } from "lucide-react";
import { Language, PantryItem, MealLog, ChatMessage } from "../types";
import { VoiceChefView } from "./VoiceChefView";

interface ChefIaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExpandToTab?: () => void;
  pantry: PantryItem[];
  mealLogs?: MealLog[];
  chatMessages: ChatMessage[];
  onUpdateChatMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  onClearChat: () => void;
  onAddItemsToPantry: (items: any[]) => void;
  onDeductItemsFromPantry: (items: any[]) => void;
  onNavigateToRecipes: (query?: string) => void;
  onLogMeal: (log: any) => void;
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
  onDeductItemsFromPantry,
  onNavigateToRecipes,
  onLogMeal,
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
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        id="chef-ia-modal-panel"
        className="w-full max-w-lg bg-stone-900 border-t sm:border border-stone-800 rounded-t-[28px] sm:rounded-3xl shadow-2xl shadow-black flex flex-col h-[85vh] sm:h-[680px] overflow-hidden animate-in slide-in-from-bottom-5 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer drag handle for mobile */}
        <div className="w-12 h-1.5 bg-stone-700 rounded-full mx-auto mt-2 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-800 bg-stone-900/95 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-emerald-950/50">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold text-white font-['Outfit'] flex items-center gap-1">
                  <span>{language === "es" ? "Chef IA" : language === "bg" ? "AI Шеф" : "AI Chef"}</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-emerald-950/80 border border-emerald-700/50 text-emerald-400">
                  Online
                </span>
              </div>
              <p className="text-[11px] text-stone-400">
                {language === "es"
                  ? "Asistente de voz y cocina inteligente"
                  : language === "bg"
                  ? "Гласов асистент за готвене"
                  : "Smart voice & cooking assistant"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onExpandToTab && (
              <button
                type="button"
                onClick={() => {
                  onExpandToTab();
                  onClose();
                }}
                className="p-2 rounded-xl bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition-colors"
                title={language === "es" ? "Pantalla completa" : "Full screen"}
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}

            <button
              id="close-chef-ia-modal-btn"
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition-colors cursor-pointer"
              title={language === "es" ? "Cerrar" : "Close"}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body - VoiceChefView */}
        <div className="flex-1 overflow-hidden px-4 py-2 flex flex-col">
          <VoiceChefView
            pantry={pantry}
            mealLogs={mealLogs}
            chatMessages={chatMessages}
            onUpdateChatMessages={onUpdateChatMessages}
            onClearChat={onClearChat}
            onAddItemsToPantry={onAddItemsToPantry}
            onDeductItemsFromPantry={onDeductItemsFromPantry}
            onNavigateToRecipes={(q) => {
              onNavigateToRecipes(q);
              onClose();
            }}
            onLogMeal={onLogMeal}
            language={language}
          />
        </div>
      </div>
    </div>
  );
};
