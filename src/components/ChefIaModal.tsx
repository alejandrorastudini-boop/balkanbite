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
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        id="chef-ia-modal-panel"
        className="w-full max-w-lg bg-[#0B0F12] border-t sm:border border-white/[0.08] rounded-t-[32px] sm:rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col h-[85vh] sm:h-[680px] overflow-hidden animate-in slide-in-from-bottom-5 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer drag handle for mobile */}
        <div className="w-12 h-1.5 bg-white/[0.1] rounded-full mx-auto mt-3 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04] bg-[#131A1F]/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-['Outfit'] tracking-wide flex items-center gap-1.5">
                  <span>{language === "es" ? "Chef IA" : language === "bg" ? "AI Шеф" : "AI Chef"}</span>
                  <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                </h3>
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  Online
                </span>
              </div>
              <p className="text-xs text-stone-400 font-medium">
                {language === "es"
                  ? "Asistente de voz y cocina inteligente"
                  : language === "bg"
                  ? "Гласов асистент за готвене"
                  : "Smart voice & cooking assistant"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onExpandToTab && (
              <button
                type="button"
                onClick={() => {
                  onExpandToTab();
                  onClose();
                }}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] text-stone-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                title={language === "es" ? "Pantalla completa" : language === "bg" ? "Цял екран" : "Full screen"}
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}

            <button
              id="close-chef-ia-modal-btn"
              type="button"
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] text-stone-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              title={language === "es" ? "Cerrar" : language === "bg" ? "Затвори" : "Close"}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body - VoiceChefView */}
        <div className="flex-1 overflow-hidden px-5 py-3 flex flex-col bg-transparent">
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
