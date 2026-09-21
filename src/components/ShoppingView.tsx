import React, { useState } from "react";
import {
  ShoppingCart,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Layers,
  RefreshCw,
  Share2,
  Copy,
  Check,
  Tag,
  Languages,
  Mic,
  Bell,
} from "lucide-react";
import { ShoppingItem, Language, Currency } from "../types";
import type { RawReconciliationExtraItem } from "../utils/purchasePantryMerge";
import { t } from "../utils/translations";
import {
  translateFoodName,
  translateCategory,
  translateUnit,
  translateReason,
} from "../utils/foodTranslator";
import { hasValidManualShoppingRequiredFields } from "../utils/manualShoppingValidation";
import { VoiceShoppingReconcileModal } from "./VoiceShoppingReconcileModal";

interface ShoppingViewProps {
  shoppingList: ShoppingItem[];
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: (item: Omit<ShoppingItem, "id" | "checked">) => void;
  onTransferToPantry: () => void;
  onGenerateAiShopping: () => Promise<void>;
  onClearList?: () => void;
  onReconcileShopping?: (result: {
    purchasedItemIds: string[];
    itemsToAddToPantry: RawReconciliationExtraItem[];
    reconciliationId?: string;
  }) => void;
  isLoadingAi: boolean;
  language: Language;
  currency: Currency;
  onOpenShoppingAdvisor?: () => void;
}

export const ShoppingView: React.FC<ShoppingViewProps> = ({
  shoppingList,
  onToggleItem,
  onDeleteItem,
  onAddItem,
  onTransferToPantry,
  onGenerateAiShopping,
  onClearList,
  onReconcileShopping,
  isLoadingAi,
  language,
  currency,
  onOpenShoppingAdvisor,
}) => {
  const currentText = t[language];
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [quantity, setQuantity] = useState<string>("");
  const [unit, setUnit] = useState<string>("");
  const [estimatedCost, setEstimatedCost] = useState<string>("");

  const estimatedPricedItems = shoppingList.filter(
    (item) =>
      typeof item.estimatedPriceEUR === "number" &&
      Number.isFinite(item.estimatedPriceEUR) &&
      item.estimatedPriceEUR > 0
  );
  const estimatedSubtotalEUR = estimatedPricedItems.reduce(
    (total, item) => total + (item.estimatedPriceEUR as number),
    0
  );
  const hasUnknownPrices = estimatedPricedItems.length < shoppingList.length;
  const unknownPriceLabel =
    language === "es"
      ? "precios desconocidos"
      : language === "bg"
      ? "неизвестни цени"
      : "unknown prices";
  const estimatedPriceSubtotalLabel =
    language === "es"
      ? "Subtotal estimado"
      : language === "bg"
      ? "Прогнозна междинна сума"
      : "Estimated subtotal";
  const priceSummaryLabel =
    language === "es"
      ? "Información de precios"
      : language === "bg"
      ? "Информация за цените"
      : "Price information";
  const totalCostDisplay =
    estimatedPricedItems.length === 0 && hasUnknownPrices
      ? unknownPriceLabel
      : `${estimatedPriceSubtotalLabel}: ~€${estimatedSubtotalEUR.toFixed(2)}${
          hasUnknownPrices ? ` + ${unknownPriceLabel}` : ""
        }`;

  const checkedCount = shoppingList.filter((i) => i.checked).length;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedQuantity = Number(quantity);
    const candidate = {
      name: newItemName,
      quantity: parsedQuantity,
      unit,
    };
    if (!hasValidManualShoppingRequiredFields(candidate)) return;

    onAddItem({
      name: newItemName.trim(),
      quantity: parsedQuantity,
      unit: unit.trim(),
      // Manual shopping does not infer a food category from the item name.
      // Blank remains unclassified until a later explicit/source-backed step.
      category: "",
      ...(estimatedCost.trim() !== "" &&
      Number.isFinite(Number(estimatedCost)) &&
      Number(estimatedCost) > 0
        ? { estimatedPriceEUR: Number(estimatedCost) }
        : {}),
    });

    setNewItemName("");
    setQuantity("");
    setUnit("");
    setEstimatedCost("");
    setShowAddModal(false);
  };

  const formatListAsText = () => {
    if (shoppingList.length === 0) return "";
    const header = `🛒 BalkanBite - ${currentText.shoppingBasketTitle || "Lista de la Compra"}:\n`;
    const items = shoppingList
      .map((item) => {
        const displayName = translateFoodName(item.name, language);
        const displayUnit = translateUnit(item.unit, language);
        return `${item.checked ? "✅" : "▫️"} ${displayName} (${item.quantity} ${displayUnit})`;
      })
      .join("\n");
    const footer = `\n💰 ${priceSummaryLabel}: ${totalCostDisplay}`;
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
    <div id="shopping-view" className="space-y-4 pb-36 sm:pb-32">
      {/* Top Banner with AI Generator */}
      <div className="bg-[#131A1F]/80 backdrop-blur-md border border-amber-500/20 rounded-3xl p-5 shadow-[0_8px_30px_rgba(245,158,11,0.08)] relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none group-hover:bg-amber-500/15 transition-all duration-700" />
        
        <div className="flex items-center justify-between relative z-10">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            {currentText.shoppingBasketTitle}
          </span>
          <span className="text-sm font-extrabold text-emerald-400 font-['Outfit'] tracking-wide">
            {totalCostDisplay}
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

        <div className="flex flex-wrap items-center gap-2.5 pt-4 relative z-10">
          <button
            id="ai-shopping-suggest-btn"
            disabled={isLoadingAi}
            onClick={onGenerateAiShopping}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-stone-950 text-sm font-bold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingAi ? "animate-spin" : ""}`} />
            <span>{isLoadingAi ? currentText.aiThinking : currentText.suggestAiList}</span>
          </button>

          {/* Dedicated Voice Shopping Reconciliation Button */}
          <button
            id="voice-shopping-reconcile-banner-btn"
            type="button"
            onClick={() => setShowVoiceModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-sm font-bold flex items-center gap-2 transition-all shadow-[0_0_12px_rgba(16,185,129,0.15)] cursor-pointer"
            title={language === "es" ? "Dictar qué has comprado realmente" : "Dictate what you actually bought"}
          >
            <Mic className="w-4 h-4 text-emerald-400" />
            <span>
              {language === "es"
                ? "Registrar Compra por Voz"
                : language === "bg"
                ? "Отчети покупка с глас"
                : "Voice Purchase Log"}
            </span>
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

          {shoppingList.length > 0 && onClearList && (
            <button
              id="clear-shopping-list-btn"
              onClick={onClearList}
              className="px-3 py-2.5 rounded-xl bg-white/[0.04] hover:bg-red-500/10 hover:text-red-400 text-stone-400 text-xs font-bold flex items-center gap-1.5 transition-colors border border-white/[0.06] cursor-pointer"
              title={language === "es" ? "Vaciar lista actual" : language === "bg" ? "Изчисти списъка" : "Clear list"}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{language === "es" ? "Vaciar Lista" : language === "bg" ? "Изчисти" : "Clear"}</span>
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

          {onOpenShoppingAdvisor && (
            <button
              id="open-advisor-from-shopping-btn"
              type="button"
              onClick={onOpenShoppingAdvisor}
              className="p-2.5 sm:px-3 sm:py-2 bg-white/[0.04] hover:bg-amber-500/15 hover:border-amber-500/30 text-amber-400 text-xs font-bold rounded-xl border border-white/[0.08] flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              title={language === "es" ? "Avisos y Diagnóstico de Compra" : "Shopping Advisor & Alerts"}
            >
              <Bell className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">
                {language === "es" ? "Avisos de Compra" : language === "bg" ? "Анализ на пазара" : "Shopping Advisor"}
              </span>
            </button>
          )}

          <button
            id="quick-voice-reconcile-action-btn"
            type="button"
            onClick={() => setShowVoiceModal(true)}
            className="p-2.5 sm:px-3 sm:py-2 bg-gradient-to-r from-amber-500/10 to-emerald-500/10 hover:from-amber-500/20 hover:to-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
            title={language === "es" ? "Dictar lo comprado por voz" : "Dictate purchased items"}
          >
            <Mic className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">
              {language === "es" ? "Dictar Compra" : language === "bg" ? "С глас" : "Voice"}
            </span>
          </button>

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
            className="text-sm text-amber-400 hover:text-amber-300 font-bold tracking-wide cursor-pointer"
          >
            ✨ {currentText.suggestAiList}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shoppingList.map((item) => {
            const displayName = translateFoodName(item.name, language);
            const displayCategory = translateCategory(item.category, language);
            const displayUnit = translateUnit(item.unit, language);
            const displayReason = translateReason(item.reason, language);
            const itemPriceEUR = item.estimatedPriceEUR;
            const priceDisplay =
              typeof itemPriceEUR === "number" &&
              Number.isFinite(itemPriceEUR) &&
              itemPriceEUR > 0
                ? `~€${itemPriceEUR.toFixed(2)}`
                : unknownPriceLabel;

            return (
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
                      {displayName}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-stone-400 font-medium">
                      <span>
                        {item.quantity} {displayUnit}
                      </span>
                      {displayCategory && (
                        <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-white/[0.04] text-stone-300 border border-white/[0.08]">
                          {displayCategory}
                        </span>
                      )}
                      {displayReason && (
                        <span className="text-emerald-400/90 italic line-clamp-1">
                          • {displayReason}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold text-emerald-400 font-['Outfit'] tracking-wide">
                    {priceDisplay}
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
            );
          })}
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
                  placeholder={language === "es" ? "Ej. Tomates frescos, Huevos..." : currentText.pantryFormPlaceholder}
                  className="w-full px-4 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-sm font-medium text-white placeholder-stone-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">
                    {currentText.qty}
                  </label>
                  <input
                    id="manual-shopping-quantity"
                    type="number"
                    min="0.1"
                    step="any"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-sm font-medium text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">
                    {currentText.unit}
                  </label>
                  <select
                    id="manual-shopping-unit"
                    required
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-sm font-medium text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  >
                    <option value="" disabled>
                      {language === "es"
                        ? "Selecciona unidad"
                        : language === "bg"
                        ? "Изберете мерна единица"
                        : "Select unit"}
                    </option>
                    <option value="uds">{language === "es" ? "Unidades (uds)" : "Units (pcs)"}</option>
                    <option value="kg">Kilogramos (kg)</option>
                    <option value="g">Gramos (g)</option>
                    <option value="packs">{language === "es" ? "Paquetes (packs)" : "Packs"}</option>
                    <option value="manojos">{language === "es" ? "Manojos" : "Bunches"}</option>
                    <option value="l">Litros (l)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">
                  {language === "es"
                    ? "Precio estimado (€) — opcional; déjalo vacío si se desconoce"
                    : language === "bg"
                    ? "Прогнозна цена (€) — по избор; оставете празно, ако е неизвестна"
                    : "Estimated price (€) — optional; leave blank if unknown"}
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
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
                  id="manual-shopping-submit"
                  type="submit"
                  disabled={
                    !hasValidManualShoppingRequiredFields({
                      name: newItemName,
                      quantity: Number(quantity),
                      unit,
                    })
                  }
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 text-sm font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-colors"
                >
                  {currentText.add}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Voice Shopping Reconciliation Modal */}
      <VoiceShoppingReconcileModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        shoppingList={shoppingList}
        language={language}
        currency={currency}
        onConfirmReconciliation={(res) => {
          if (onReconcileShopping) {
            onReconcileShopping(res);
          }
        }}
      />
    </div>
  );
};
