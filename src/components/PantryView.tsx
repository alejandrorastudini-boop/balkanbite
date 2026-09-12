import React, { useState } from "react";
import {
  Plus,
  Search,
  AlertTriangle,
  Sparkles,
  Trash2,
  Minus,
  CheckCircle2,
  Calendar,
  Layers,
  Mic,
  Camera,
} from "lucide-react";
import { PantryItem, Language, Currency } from "../types";
import { t } from "../utils/translations";
import { ConfirmModal } from "./ConfirmModal";
import { ScanModal } from "./ScanModal";

interface PantryViewProps {
  pantry: PantryItem[];
  onAddItem: (item: Omit<PantryItem, "id" | "addedAt">) => void;
  onAddMultipleItems?: (items: Array<Omit<PantryItem, "id" | "addedAt">>) => void;
  onUpdateQuantity: (id: string, newQty: number) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
  onOpenVoiceTab: () => void;
  language: Language;
  currency: Currency;
}

export const PantryView: React.FC<PantryViewProps> = ({
  pantry,
  onAddItem,
  onAddMultipleItems,
  onUpdateQuantity,
  onDeleteItem,
  onClearAll,
  onOpenVoiceTab,
  language,
  currency,
}) => {
  const currentText = t[language];
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // New item form state
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState<string>("pcs");
  const [category, setCategory] = useState<PantryItem["category"]>("Produce");
  const [expiryDays, setExpiryDays] = useState<number>(7);
  const [cost, setCost] = useState<number>(2.5);

  const categories = [
    { id: "All", label: currentText.filterAll },
    { id: "Produce", label: currentText.categoryProduce },
    { id: "Dairy", label: currentText.categoryDairy },
    { id: "Meat/Fish", label: currentText.categoryMeat },
    { id: "Pantry/Grains", label: currentText.categoryPantry },
    { id: "Spices", label: currentText.categorySpices },
  ];

  const filteredItems = pantry.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.nameBg && item.nameBg.toLowerCase().includes(search.toLowerCase()));
    const matchesCat =
      activeCategory === "All" ? true : item.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const expiringCount = pantry.filter(
    (i) => i.expiryDaysLeft !== undefined && i.expiryDaysLeft <= 3
  ).length;

  const totalValueEUR = pantry.reduce(
    (acc, curr) => acc + (curr.estimatedCostEUR || 0),
    0
  );

  const handleClearWithConfirm = () => {
    setShowClearConfirm(true);
  };

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddItem({
      name: name.trim(),
      quantity: Number(quantity),
      unit,
      category,
      expiryDaysLeft: Number(expiryDays),
      estimatedCostEUR: Number(cost),
    });

    setName("");
    setQuantity(1);
    setShowAddModal(false);
  };

  return (
    <div id="pantry-view" className="space-y-4 pb-20">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-stone-800/80 border border-stone-700/60 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
            {currentText.pantryStatsItems}
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold text-white font-['Outfit']">
              {pantry.length}
            </span>
            <span className="text-xs text-stone-400">
              {currentText.pantryStatsStock}
            </span>
          </div>
        </div>

        <div className="bg-stone-800/80 border border-stone-700/60 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            {currentText.pantryStatsExpiring}
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span
              className={`text-xl font-bold font-['Outfit'] ${
                expiringCount > 0 ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {expiringCount}
            </span>
            <span className="text-xs text-stone-400">
              {currentText.pantryStatsSoon}
            </span>
          </div>
        </div>

        <div className="bg-stone-800/80 border border-stone-700/60 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
            {currentText.pantryStatsValue}
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold text-emerald-400 font-['Outfit']">
              {currency === "EUR"
                ? `€${totalValueEUR.toFixed(1)}`
                : `$${(totalValueEUR * 1.1).toFixed(1)}`}
            </span>
          </div>
        </div>
      </div>

      {/* Anti-Waste Financial Savings Ticker */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-stone-850 to-stone-900 border border-emerald-500/30 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
            🌱
          </div>
          <div>
            <span className="text-stone-200 font-bold block">{currentText.savingsRadarTitle || "Radar de Ahorro Anti-Desperdicio"}</span>
            <p className="text-[11px] text-stone-400">Ingredientes aprovechados a tiempo</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-emerald-400 font-extrabold font-['Outfit'] text-sm">
            +{currency === "EUR" ? "€42.50" : "$46.80"}
          </span>
          <span className="block text-[10px] text-stone-400 font-medium">{currentText.savingsRadarEstimated || "Ahorrado este mes"}</span>
        </div>
      </div>

      {/* Voice Assistant Shortcut Bar */}
      <div className="bg-gradient-to-r from-emerald-900/40 via-teal-900/30 to-stone-900 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">
              {currentText.pantryVoiceTitle}
            </p>
            <p className="text-[11px] text-stone-400">
              {currentText.pantryVoiceSay}
            </p>
          </div>
        </div>
        <button
          id="pantry-voice-shortcut-btn"
          onClick={onOpenVoiceTab}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/50"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{currentText.pantryDictate}</span>
        </button>
      </div>

      {/* Search and Add manual item */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            id="pantry-search-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={currentText.searchPantry}
            className="w-full pl-9 pr-3 py-2 bg-stone-800/90 border border-stone-700 rounded-xl text-xs text-white placeholder-stone-400 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
        <button
          id="pantry-scan-camera-btn"
          type="button"
          onClick={() => setShowScanModal(true)}
          className="px-3 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-teal-950/40 cursor-pointer shrink-0"
          title={currentText.scanCameraBtn || "Escanear Nevera / Ticket"}
        >
          <Camera className="w-4 h-4" />
          <span className="hidden sm:inline">{currentText.scanCameraBtn || "Escanear"}</span>
        </button>

        <button
          id="pantry-add-item-btn"
          onClick={() => setShowAddModal(true)}
          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{currentText.addItem}</span>
        </button>

        {pantry.length > 0 && (
          <button
            id="pantry-clear-all-btn"
            type="button"
            onClick={handleClearWithConfirm}
            className="p-2 bg-stone-800 hover:bg-rose-950/40 text-stone-400 hover:text-rose-400 border border-stone-700 hover:border-rose-800/60 rounded-xl transition-colors cursor-pointer shrink-0"
            title={currentText.pantryClearAll}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat.id}
            id={`pantry-cat-${cat.id}`}
            onClick={() => setActiveCategory(cat.id)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat.id
                ? "bg-stone-200 text-stone-900 font-semibold shadow-sm"
                : "bg-stone-800/80 text-stone-400 hover:text-stone-200 border border-stone-700/60"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Item List */}
      {filteredItems.length === 0 ? (
        <div className="bg-stone-800/50 border border-dashed border-stone-700 rounded-2xl p-8 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-stone-800 flex items-center justify-center text-stone-500">
            <Layers className="w-6 h-6" />
          </div>
          <p className="text-xs text-stone-400 max-w-xs mx-auto">
            {currentText.emptyPantry}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
          >
            + {currentText.addItem}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filteredItems.map((item) => {
            const isExpiring =
              item.expiryDaysLeft !== undefined && item.expiryDaysLeft <= 3;
            const displayName =
              language === "bg" && item.nameBg ? item.nameBg : item.name;

            return (
              <div
                key={item.id}
                id={`pantry-item-${item.id}`}
                className="bg-stone-800/80 hover:bg-stone-800 border border-stone-700/70 rounded-xl p-3 flex flex-col justify-between gap-2.5 transition-all shadow-sm group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-white leading-tight">
                      {displayName}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-stone-700 text-stone-300 font-medium">
                        {item.category}
                      </span>
                      {item.expiryDaysLeft !== undefined && (
                        <span
                          className={`text-[11px] flex items-center gap-1 font-medium ${
                            isExpiring ? "text-amber-400 font-bold" : "text-stone-400"
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          {item.expiryDaysLeft} {currentText.shelfLifeDays}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="text-stone-500 hover:text-red-400 p-1 rounded-md transition-colors opacity-80 group-hover:opacity-100"
                    title={currentText.delete}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quantity Controls & Estimated Cost */}
                <div className="flex items-center justify-between border-t border-stone-700/50 pt-2 text-xs">
                  <div className="flex items-center gap-1.5 bg-stone-900/60 rounded-lg p-1 border border-stone-700/60">
                    <button
                      onClick={() =>
                        onUpdateQuantity(
                          item.id,
                          Math.max(0, item.quantity - (item.unit === "g" ? 50 : 1))
                        )
                      }
                      className="w-6 h-6 rounded flex items-center justify-center bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-white"
                      title="Decrease quantity"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold text-white px-1.5 min-w-[50px] text-center">
                      {item.quantity} {item.unit}
                    </span>
                    <button
                      onClick={() =>
                        onUpdateQuantity(
                          item.id,
                          item.quantity + (item.unit === "g" ? 50 : 1)
                        )
                      }
                      className="w-6 h-6 rounded flex items-center justify-center bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-white"
                      title="Increase quantity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {item.estimatedCostEUR && (
                    <span className="text-xs font-medium text-emerald-400">
                      {currency === "EUR"
                        ? `~€${item.estimatedCostEUR.toFixed(2)}`
                        : `~$${(item.estimatedCostEUR * 1.1).toFixed(2)}`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-800 border border-stone-700 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">
                {currentText.addItem}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                  {currentText.pantryFormName}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                    <option value="pcs">pcs</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="pack">pack</option>
                    <option value="bunch">bunch</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                    {currentText.pantryFormCategory}
                  </label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as PantryItem["category"])
                    }
                    className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Produce">Produce</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Meat/Fish">Meat/Fish</option>
                    <option value="Pantry/Grains">Pantry/Grains</option>
                    <option value="Spices">Spices</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                    {currentText.pantryFormShelfLife}
                  </label>
                  <input
                    type="number"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                  {currentText.pantryFormCost}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-stone-700 text-stone-300 hover:bg-stone-600 text-xs font-semibold"
                >
                  {currentText.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md"
                >
                  {currentText.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Clearing Pantry */}
      <ConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => {
          onClearAll();
          setShowClearConfirm(false);
        }}
        title={currentText.pantryClearAll || "Vaciar Despensa"}
        description={currentText.pantryClearConfirm || "¿Estás seguro de que deseas vaciar toda la despensa?"}
        confirmText={currentText.clear}
        cancelText={currentText.cancel}
        danger={true}
      />

      {/* AI Visual & Barcode Scanner Modal */}
      <ScanModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        language={language}
        currency={currency}
        onAddItems={(items) => {
          if (onAddMultipleItems) {
            onAddMultipleItems(items);
          } else {
            items.forEach((item) => onAddItem(item));
          }
        }}
      />
    </div>
  );
};
