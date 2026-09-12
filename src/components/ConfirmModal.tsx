import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = true,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-sm bg-stone-900 border border-stone-700/80 rounded-2xl p-5 shadow-2xl space-y-4 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${danger ? "bg-rose-500/15 text-rose-400 border border-rose-500/30" : "bg-amber-500/15 text-amber-400 border border-amber-500/30"}`}>
            {danger ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div className="space-y-1 flex-1 pr-6">
            <h3 className="text-sm font-bold text-white font-['Outfit']">{title}</h3>
            <p className="text-xs text-stone-300 leading-relaxed">{description}</p>
          </div>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-stone-400 hover:text-stone-200 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold border border-stone-700 transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-white text-xs font-bold transition-all shadow-md ${danger ? "bg-rose-600 hover:bg-rose-500 shadow-rose-950/50" : "bg-emerald-600 hover:bg-emerald-500"}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
