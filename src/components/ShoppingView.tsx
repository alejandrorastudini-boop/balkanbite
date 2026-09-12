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
      <div className="bg-gradient-to-br from-amber-950/40 via-stone-900 to-emerald-950/40 border border-amber-500/30 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {currentText.shoppingBasketTitle}
          </span>
          <span className="text-xs font-extrabold text-emerald-400 font-['Outfit']">
            {currency === "EUR"
              ? `€${totalCostEUR.toFixed(2)}`
              : `$${(totalCostEUR * 1.1).toFixed(2)}`}
          </span>
        </div>

        <div>
          <h2 className="text-base font-bold text-white font-['Outfit']">
            {currentText.shoppingTitle}
          </h2>
          <p className="text-xs text-stone-300">
            {currentText.shoppingSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            id="ai-shopping-suggest-btn"
            disabled={isLoadingAi}
            onClick={onGenerateAiShopping}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAi ? "animate-spin" : ""}`} />
            <span>{isLoadingAi ? currentText.aiThinking : currentText.suggestAiList}</span>
          </button>

          {checkedCount > 0 && (
            <button
              id="transfer-to-pantry-btn"
              onClick={onTransferToPantry}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {currentText.shoppingTransfer} ({checkedCount})
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400 font-medium">
            {shoppingList.length} {currentText.shoppingItemsInList}
          </span>
          {/* Smart Supermarket Savings Radar */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
            <TrendingDown className="w-3 h-3 text-emerald-400" />
            <span>~€14.50 ahorro planificado</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {shoppingList.length > 0 && (
            <>
              <button
                id="share-whatsapp-btn"
                type="button"
                onClick={handleShareWhatsApp}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title={currentText.whatsappShareList || "Enviar a WhatsApp"}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>

              <button
                id="copy-list-btn"
                type="button"
                onClick={handleCopyList}
                className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title={currentText.copyListFormatted || "Copiar Lista"}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{copied ? "¡Copiado!" : (currentText.copyListFormatted || "Copiar")}</span>
              </button>
            </>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{currentText.addItem}</span>
          </button>
        </div>
      </div>

      {/* Shopping Items List */}
      {shoppingList.length === 0 ? (
        <div className="bg-stone-800/40 border border-dashed border-stone-700 rounded-2xl p-8 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-stone-800 flex items-center justify-center text-stone-500">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <p className="text-xs text-stone-400 max-w-xs mx-auto leading-relaxed">
            {currentText.noItemsInList}
          </p>
          <button
            onClick={onGenerateAiShopping}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
          >
            ✨ {currentText.suggestAiList}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {shoppingList.map((item) => (
            <div
              key={item.id}
              id={`shopping-item-${item.id}`}
              className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                item.checked
                  ? "bg-stone-900/60 border-stone-800/80 opacity-60 line-through"
                  : "bg-stone-800/85 border-stone-700/80 hover:border-emerald-500/40 shadow-sm"
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onToggleItem(item.id)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                    item.checked
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "border-stone-600 hover:border-emerald-400"
                  }`}
                >
                  {item.checked && <CheckCircle2 className="w-3.5 h-3.5" />}
                </button>

                <div>
                  <h2 className="text-xs font-bold text-white leading-tight">
                    {item.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-400">
                    <span>
                      {item.quantity} {item.unit}
                    </span>
                    {item.category && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-700 text-stone-300">
                        {item.category}
                      </span>
                    )}
                    {item.reason && (
                      <span className="text-emerald-400 text-[10px] italic line-clamp-1">
                        • {item.reason}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-emerald-400 font-['Outfit']">
                  {currency === "EUR"
                    ? `€${item.estimatedPriceEUR.toFixed(2)}`
                    : `$${(item.estimatedPriceEUR * 1.1).toFixed(2)}`}
                </span>
                <button
                  onClick={() => onDeleteItem(item.id)}
                  className="text-stone-500 hover:text-red-400 p-1 rounded-md transition-colors"
                  title={currentText.delete}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-800 border border-stone-700 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">
                {currentText.addItem}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                  {currentText.shoppingAddProduct}
                </label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={currentText.pantryFormPlaceholder}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                    {currentText.qty}
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                    {currentText.unit}
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="pcs">pcs (бр.)</option>
                    <option value="kg">kg (кг)</option>
                    <option value="g">g (грама)</option>
                    <option value="pack">pack (пакет)</option>
                    <option value="bunch">bunch (връзка)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                  {currentText.shoppingAddPrice}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-stone-700 text-stone-300 text-xs font-semibold"
                >
                  {currentText.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md"
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
