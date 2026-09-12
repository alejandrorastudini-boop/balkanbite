import React, { useState } from "react";
import {
  ShoppingCart,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Layers,
  RefreshCw,
  Share2,
  Copy,
  Check,
  Tag,
} from "lucide-react";
import { ShoppingItem, Language, Currency } from "../types";
import { t } from "../utils/translations";

interface ShoppingViewProps {
  shoppingList: ShoppingItem[];
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: (item: Omit<ShoppingItem, "id" | "checked">) => void;
  onTransferToPantry: () => void;
  onGenerateAiShopping: () => Promise<void>;
  isLoadingAi: boolean;
  language: Language;
  currency: Currency;
  isPro?: boolean;
  onOpenProModal?: () => void;
}

export const ShoppingView: React.FC<ShoppingViewProps> = ({
  shoppingList,
  onToggleItem,
  onDeleteItem,
  onAddItem,
  onTransferToPantry,
  onGenerateAiShopping,
  isLoadingAi,
  language,
  currency,
  isPro = false,
  onOpenProModal,
}) => {
  const currentText = t[language];
  const [showAddModal, setShowAddModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState<string>("pcs");
  const [category, setCategory] = useState<string>("Produce");
  const [estimatedCost, setEstimatedCost] = useState<number>(2.0);

  const totalCostEUR = shoppingList.reduce(
    (acc, curr) => acc + (curr.estimatedPriceEUR || 0),
    0
  );

  const checkedCount = shoppingList.filter((i) => i.checked).length;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    onAddItem({
      name: newItemName.trim(),
      quantity: Number(quantity),
      unit,
      category,
      estimatedPriceEUR: Number(estimatedCost),
    });

    setNewItemName("");
    setQuantity(1);
    setShowAddModal(false);
  };

  const formatListAsText = () => {
    if (shoppingList.length === 0) return "";
    const header = `🛒 BalkanBite - ${currentText.shoppingBasketTitle || "Lista de la Compra"}:\n`;
    const items = shoppingList
      .map((item) => `${item.checked ? "✅" : "▫️"} ${item.name} (${item.quantity} ${item.unit})`)
      .join("\n");
    const footer = `\n💰 Total est: ${currency === "EUR" ? `€${totalCostEUR.toFixed(2)}` : `$${(totalCostEUR * 1.1).toFixed(2)}`}`;
    return `${header}\n${items}\n${footer}`;
  };

  const handleShareWhatsApp = () => {
    const text = formatListAsText();
    if (!text) return;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleCopyList = () => {
    const text = formatListAsText();
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div id="shopping-view" className="space-y-4 pb-20">
      {/* Top Banner with AI Generator */}
      <div className="bg-[#131A1F]/80 backdrop-blur-md border border-amber-500/20 rounded-3xl p-5 shadow-[0_8px_30px_rgba(245,158,11,0.08)] relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none group-hover:bg-amber-500/15 transition-all duration-700" />
        
        <div className="flex items-center justify-between relative z-10">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            {currentText.shoppingBasketTitle}
          </span>
          <span className="text-sm font-extrabold text-emerald-400 font-['Outfit'] tracking-wide">
            {currency === "EUR"
              ? `€${totalCostEUR.toFixed(2)}`
              : `$${(totalCostEUR * 1.1).toFixed(2)}`}
          </span>
        </div>

        <div className="mt-3 relative z-10">
          <h2 className="text-xl font-bold text-white font-['Outfit'] tracking-wide">
            {currentText.shoppingTitle}
          </h2>
          <p className="text-sm text-stone-400 font-medium mt-1">
            {currentText.shoppingSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-4 relative z-10">
          <button
            id="ai-shopping-suggest-btn"
            disabled={isLoadingAi}
            onClick={onGenerateAiShopping}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-stone-950 text-sm font-bold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingAi ? "animate-spin" : ""}`} />
            <span>{isLoadingAi ? currentText.aiThinking : currentText.suggestAiList}</span>
          </button>

          {checkedCount > 0 && (
            <button
              id="transfer-to-pantry-btn"
              onClick={onTransferToPantry}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-sm font-bold flex items-center gap-2 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {currentText.shoppingTransfer} ({checkedCount})
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-400 font-bold uppercase tracking-widest px-2">
            {shoppingList.length} {currentText.shoppingItemsInList}
          </span>
          {/* Smart Supermarket Savings Radar */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-widest">
            <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {currency === "EUR" ? "~€14.50" : "~$16.00"}{" "}
              {language === "es"
                ? "ahorro"
                : language === "bg"
                ? "спестяване"
                : "savings"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {shoppingList.length > 0 && (
            <>
              <button
                id="share-whatsapp-btn"
                type="button"
                onClick={handleShareWhatsApp}
                className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title={currentText.whatsappShareList || "Enviar a WhatsApp"}
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>

              <button
                id="copy-list-btn"
                type="button"
                onClick={handleCopyList}
                className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-stone-300 border border-white/[0.08] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title={currentText.copyListFormatted || "Copiar Lista"}
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">
                  {copied
                    ? language === "es"
                      ? "¡Copiado!"
                      : language === "bg"
                      ? "Копирано!"
                      : "Copied!"
                    : currentText.copyListFormatted || "Copy"}
                </span>
              </button>
            </>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          >
            <Plus className="w-4 h-4" />
            <span>{currentText.addItem}</span>
          </button>
        </div>
      </div>

      {/* Shopping Items List */}
      {shoppingList.length === 0 ? (
        <div className="bg-[#131A1F]/60 backdrop-blur-md border border-white/[0.04] border-dashed rounded-3xl p-8 text-center space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-stone-900 to-stone-800 flex items-center justify-center text-stone-500 shadow-inner border border-stone-800/50">
            <ShoppingCart className="w-7 h-7" />
          </div>
          <p className="text-sm text-stone-400 max-w-sm mx-auto leading-relaxed font-medium">
            {currentText.noItemsInList}
          </p>
          <button
            onClick={onGenerateAiShopping}
            className="text-sm text-amber-400 hover:text-amber-300 font-bold tracking-wide"
          >
            ✨ {currentText.suggestAiList}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shoppingList.map((item) => (
            <div
              key={item.id}
              id={`shopping-item-${item.id}`}
              className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                item.checked
                  ? "bg-black/40 border-white/[0.02] opacity-60 line-through"
                  : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-emerald-500/40 shadow-sm"
              }`}
            >
              <div className="flex items-center gap-4">
                <button
                  onClick={() => onToggleItem(item.id)}
                  className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                    item.checked
                      ? "bg-emerald-500 border-emerald-400 text-stone-950 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                      : "bg-black/50 border-white/[0.1] hover:border-emerald-400"
                  }`}
                >
                  {item.checked && <CheckCircle2 className="w-4 h-4" />}
                </button>

                <div>
                  <h2 className="text-sm font-bold text-white leading-tight tracking-wide">
                    {item.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-stone-400 font-medium">
                    <span>
                      {item.quantity} {item.unit}
                    </span>
                    {item.category && (
                      <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-white/[0.04] text-stone-300 border border-white/[0.08]">
                        {item.category}
                      </span>
                    )}
                    {item.reason && (
                      <span className="text-emerald-400/80 italic line-clamp-1">
                        • {item.reason}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-emerald-400 font-['Outfit'] tracking-wide">
                  {currency === "EUR"
                    ? `€${item.estimatedPriceEUR.toFixed(2)}`
                    : `$${(item.estimatedPriceEUR * 1.1).toFixed(2)}`}
                </span>
                <button
                  onClick={() => onDeleteItem(item.id)}
                  className="text-stone-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-xl transition-colors"
                  title={currentText.delete}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#131A1F] border border-white/[0.08] rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <h2 className="text-lg font-bold text-white font-['Outfit'] tracking-wide">
                {currentText.addItem}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.04] text-stone-400 hover:bg-white/[0.08] hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">
                  {currentText.shoppingAddProduct}
                </label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={currentText.pantryFormPlaceholder}
                  className="w-full px-4 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-sm font-medium text-white placeholder-stone-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">
                    {currentText.qty}
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-sm font-medium text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">
                    {currentText.unit}
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-sm font-medium text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  >
                    <option value="pcs">{language === "bg" ? "бр." : language === "es" ? "ud" : "pcs"}</option>
                    <option value="kg">{language === "bg" ? "кг" : "kg"}</option>
                    <option value="g">{language === "bg" ? "г" : "g"}</option>
                    <option value="pack">{language === "bg" ? "пакет" : language === "es" ? "paquete" : "pack"}</option>
                    <option value="bunch">{language === "bg" ? "връзка" : language === "es" ? "manojo" : "bunch"}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">
                  {currentText.shoppingAddPrice}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-sm font-medium text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/[0.04] text-stone-300 text-sm font-bold hover:bg-white/[0.08] transition-colors"
                >
                  {currentText.cancel}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-sm font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-colors"
                >
                  {currentText.add}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
