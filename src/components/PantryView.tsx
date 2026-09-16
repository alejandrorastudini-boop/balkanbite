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
import { validateManualPantryRequiredFields } from "../utils/manualPantryValidation";
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
  const [quantity, setQuantity] = useState<number | "">("");
  const [unit, setUnit] = useState<string>("");
  const [category, setCategory] = useState<PantryItem["category"] | "">("");
  const [expiryDays, setExpiryDays] = useState<number | "">("");
  const [cost, setCost] = useState<number | "">("");
  const [formError, setFormError] = useState("");
  const requiredFieldLabel =
    language === "bg"
      ? "задължително поле"
      : language === "es"
        ? "campo obligatorio"
        : "required field";
  const optionalFieldLabel =
    language === "bg"
      ? "поле по избор"
      : language === "es"
        ? "campo opcional"
        : "optional field";

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

  const hasCompleteCostData = pantry.every(
    (item) => item.estimatedCostEUR !== undefined
  );
  const totalValueEUR = hasCompleteCostData
    ? pantry.reduce((acc, curr) => acc + (curr.estimatedCostEUR ?? 0), 0)
    : null;

  const handleClearWithConfirm = () => {
    setShowClearConfirm(true);
  };

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    const requiredFields = validateManualPantryRequiredFields({
      quantity: String(quantity),
      unit,
      expiryDays: String(expiryDays),
      cost: String(cost),
    });
    if (!name.trim()) {
      setFormError(
        language === "bg"
          ? "Въведете име на продукта."
          : language === "es"
            ? "Introduce el nombre del producto."
            : "Enter the item name.",
      );
      return;
    }
    if (!category) {
      setFormError(
        language === "bg"
          ? "Изберете категория."
          : language === "es"
            ? "Selecciona una categoría."
            : "Select a category.",
      );
      return;
    }
    if (!requiredFields.valid) {
      setFormError(
        language === "bg"
          ? "Задължителни: име, категория, положително количество и мерна единица. По избор: дни до изтичане и цена; ако са попълнени, трябва да са неотрицателни числа."
          : language === "es"
            ? "Obligatorios: nombre, categoría, cantidad positiva y unidad. Opcionales: días hasta caducidad y coste; si se indican, deben ser números no negativos."
            : "Required: name, category, a positive quantity, and a unit. Optional: expiry days and cost; if provided, they must be non-negative numbers.",
      );
      return;
    }

    setFormError("");
    onAddItem({
      name: name.trim(),
      quantity: requiredFields.quantity,
      unit: requiredFields.unit,
      category,
      ...(requiredFields.expiryDays !== undefined
        ? { expiryDaysLeft: requiredFields.expiryDays }
        : {}),
      ...(requiredFields.cost !== undefined
        ? { estimatedCostEUR: requiredFields.cost }
        : {}),
    });

    setName("");
    setQuantity("");
    setUnit("");
    setCategory("");
    setExpiryDays("");
    setCost("");
    setFormError("");
    setShowAddModal(false);
  };

  return (
    <div id="pantry-view" className="space-y-4 pb-36 sm:pb-32">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#131A1F]/60 backdrop-blur-md border border-white/[0.06] rounded-2xl p-3.5 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
            {currentText.pantryStatsItems}
          </span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-extrabold text-white font-['Outfit'] tracking-tight">
              {pantry.length}
            </span>
            <span className="text-[11px] font-medium text-stone-500">
              {currentText.pantryStatsStock}
            </span>
          </div>
        </div>

        <div className="bg-[#131A1F]/60 backdrop-blur-md border border-white/[0.06] rounded-2xl p-3.5 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.2)] relative overflow-hidden">
          {expiringCount > 0 && (
             <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 blur-xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          )}
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 relative z-10">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            {currentText.pantryStatsExpiring}
          </span>
          <div className="flex items-baseline gap-1 mt-2 relative z-10">
            <span
              className={`text-2xl font-extrabold font-['Outfit'] tracking-tight ${
                expiringCount > 0 ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {expiringCount}
            </span>
            <span className="text-[11px] font-medium text-stone-500">
              {currentText.pantryStatsSoon}
            </span>
          </div>
        </div>

        <div className="bg-[#131A1F]/60 backdrop-blur-md border border-white/[0.06] rounded-2xl p-3.5 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.2)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 blur-xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest relative z-10">
            {currentText.pantryStatsValue}
          </span>
          <div className="flex items-baseline gap-1 mt-2 relative z-10">
            <span className="text-xl font-extrabold text-emerald-400 font-['Outfit'] tracking-tight">
              {totalValueEUR === null || currency !== "EUR"
                ? language === "es"
                  ? "Sin datos"
                  : language === "bg"
                  ? "Няма данни"
                  : "No data"
                : `€${totalValueEUR.toFixed(1)}`}
            </span>
          </div>
        </div>
      </div>

      {/* Anti-Waste Financial Savings Ticker */}
      <div className="bg-[#131A1F]/80 backdrop-blur-md border border-emerald-500/20 rounded-2xl px-4 py-3 flex items-center justify-between text-xs shadow-[0_4px_20px_rgba(16,185,129,0.05)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 blur-2xl rounded-full -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
            🌱
          </div>
          <div>
            <span className="text-stone-200 font-bold block tracking-wide">{currentText.savingsRadarTitle || "Radar de Ahorro Anti-Desperdicio"}</span>
            <p className="text-[11px] text-stone-400 mt-0.5">
              {language === "es"
                ? "No hay datos de ahorro verificados"
                : language === "bg"
                ? "Няма потвърдени данни за спестявания"
                : "No verified savings data"}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 relative z-10">
          <span className="text-emerald-400 font-extrabold font-['Outfit'] text-base tracking-tight">
            {language === "es" ? "Sin datos" : language === "bg" ? "Няма данни" : "No data"}
          </span>
          <span className="block text-[10px] text-stone-500 font-bold uppercase tracking-wider mt-0.5">{currentText.savingsRadarEstimated || "Ahorrado este mes"}</span>
        </div>
      </div>

      {/* Voice Assistant Shortcut Bar */}
      <div className="bg-gradient-to-r from-[#131A1F] via-[#1A242B] to-[#131A1F] border border-amber-500/20 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-[0_4px_20px_rgba(245,158,11,0.05)] relative overflow-hidden group cursor-pointer hover:border-amber-500/40 transition-colors" onClick={onOpenVoiceTab}>
        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-amber-500/5 to-transparent pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-white tracking-wide">
              {currentText.pantryVoiceTitle}
            </p>
            <p className="text-xs text-stone-400 mt-0.5">
              {currentText.pantryVoiceSay}
            </p>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center text-amber-400 relative z-10 shrink-0">
          <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
        </div>
      </div>

      {/* Search and Add manual item */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            id="pantry-search-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={currentText.searchPantry}
            className="w-full pl-10 pr-4 py-2.5 bg-[#131A1F]/80 backdrop-blur-md border border-white/[0.08] rounded-xl text-sm text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all shadow-inner"
          />
        </div>
        <button
          id="pantry-scan-camera-btn"
          type="button"
          onClick={() => setShowScanModal(true)}
          className="px-4 py-2.5 bg-stone-800/80 hover:bg-stone-700/80 backdrop-blur-md border border-white/[0.08] text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer shrink-0"
          title={currentText.scanCameraBtn || "Escanear Nevera / Ticket"}
        >
          <Camera className="w-4 h-4 text-stone-300" />
          <span className="hidden sm:inline">{currentText.scanCameraBtn || "Escanear"}</span>
        </button>

        <button
          id="pantry-add-item-btn"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-sm font-bold rounded-xl flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{currentText.addItem}</span>
        </button>

        {pantry.length > 0 && (
          <button
            id="pantry-clear-all-btn"
            type="button"
            onClick={handleClearWithConfirm}
            className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 rounded-xl transition-all cursor-pointer shrink-0"
            title={currentText.pantryClearAll}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat.id}
            id={`pantry-cat-${cat.id}`}
            onClick={() => setActiveCategory(cat.id)}
            className={`text-[11px] px-4 py-2 rounded-full font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300 ${
              activeCategory === cat.id
                ? "bg-white text-stone-950 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                : "bg-white/[0.04] text-stone-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.04]"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Item List */}
      {filteredItems.length === 0 ? (
        <div className="bg-[#131A1F]/60 backdrop-blur-md border border-white/[0.04] rounded-3xl p-10 text-center space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-stone-900 to-stone-800 flex items-center justify-center text-stone-500 shadow-inner border border-stone-800/50">
            <Layers className="w-7 h-7" />
          </div>
          <p className="text-sm text-stone-400 max-w-xs mx-auto font-medium">
            {currentText.emptyPantry}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-sm text-emerald-400 hover:text-emerald-300 font-bold tracking-wide transition-colors"
          >
            + {currentText.addItem}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredItems.map((item) => {
            const isExpiring =
              item.expiryDaysLeft !== undefined && item.expiryDaysLeft <= 3;
            const isCritical =
              item.expiryDaysLeft !== undefined && item.expiryDaysLeft <= 1;
              
            const displayName =
              language === "bg" && item.nameBg ? item.nameBg : item.name;

            return (
              <div
                key={item.id}
                id={`pantry-item-${item.id}`}
                className="bg-[#131A1F]/60 hover:bg-[#131A1F]/80 backdrop-blur-md border border-white/[0.06] rounded-2xl p-3.5 flex flex-col justify-between gap-3 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_30px_rgba(16,185,129,0.06)] hover:-translate-y-0.5 group relative overflow-hidden"
              >
                {/* Decorative subtle gradient blob inside card */}
                {isCritical && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 blur-2xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                )}
                {isExpiring && !isCritical && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 blur-2xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                )}
                
                <div className="flex items-start justify-between gap-2 relative z-10">
                  <div>
                    <h2 className="text-base font-bold text-white leading-tight font-['Outfit'] tracking-wide">
                      {displayName}
                    </h2>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-stone-300 font-semibold tracking-wider uppercase">
                        {item.category}
                      </span>
                      {item.expiryDaysLeft !== undefined && (
                        <span
                          className={`text-[10px] flex items-center gap-1 font-bold px-2 py-0.5 rounded-full border ${
                            isCritical 
                              ? "text-rose-400 bg-rose-500/10 border-rose-500/20 animate-pulse" 
                              : isExpiring 
                                ? "text-amber-400 bg-amber-500/10 border-amber-500/20" 
                                : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          {item.expiryIsPartial && (language === "es" ? "Parte del stock: " : language === "bg" ? "Част от запаса: " : "Some stock: ")}
                          {item.expiryDaysLeft} {currentText.shelfLifeDays}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="text-stone-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-all opacity-60 group-hover:opacity-100"
                    title={currentText.delete}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Quantity Controls & Estimated Cost */}
                <div className="flex items-center justify-between border-t border-white/[0.04] pt-2.5 mt-1 text-xs relative z-10">
                  <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-white/[0.04] shadow-inner">
                    <button
                      onClick={() =>
                        onUpdateQuantity(
                          item.id,
                          Math.max(0, item.quantity - (item.unit === "g" ? 50 : 1))
                        )
                      }
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.04] text-stone-400 hover:bg-white/[0.1] hover:text-white transition-colors cursor-pointer"
                      title={language === "es" ? "Reducir cantidad" : language === "bg" ? "Намали количеството" : "Decrease quantity"}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-bold text-white px-2 min-w-[50px] text-center font-['Outfit']">
                      {item.quantity} <span className="text-stone-400 text-xs">{item.unit}</span>
                    </span>
                    <button
                      onClick={() =>
                        onUpdateQuantity(
                          item.id,
                          item.quantity + (item.unit === "g" ? 50 : 1)
                        )
                      }
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.04] text-stone-400 hover:bg-white/[0.1] hover:text-white transition-colors cursor-pointer"
                      title={language === "es" ? "Aumentar cantidad" : language === "bg" ? "Увеличи количеството" : "Increase quantity"}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {item.estimatedCostEUR && (
                    <span className="text-sm font-bold text-emerald-400 font-['Outfit'] pr-1">
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
                <label
                  htmlFor="pantry-item-name"
                  className="block text-[11px] font-semibold text-stone-300 mb-1"
                >
                  {currentText.pantryFormName}{" "}
                  <span className="font-normal text-stone-500">({requiredFieldLabel})</span>
                </label>
                <input
                  id="pantry-item-name"
                  type="text"
                  required
                  aria-required="true"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={currentText.pantryFormPlaceholder}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                    {currentText.qty}{" "}
                    <span className="font-normal text-stone-500">({requiredFieldLabel})</span>
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    required
                    aria-required="true"
                    aria-label={language === "es" ? "Cantidad" : language === "bg" ? "Количество" : "Quantity"}
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                    {currentText.unit}
                  </label>
                  <select
                    required
                    aria-required="true"
                    value={unit}
                    aria-label={`${currentText.unit} (${requiredFieldLabel})`}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="" disabled>
                      {language === "bg" ? "Изберете" : language === "es" ? "Seleccionar" : "Select"}
                    </option>
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
                  <label
                    htmlFor="pantry-category"
                    className="block text-[11px] font-semibold text-stone-300 mb-1"
                  >
                    {currentText.pantryFormCategory}
                  </label>
                  <select
                    id="pantry-category"
                    required
                    aria-required="true"
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as PantryItem["category"])
                    }
                    className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="" disabled>
                      {language === "bg" ? "Изберете" : language === "es" ? "Seleccionar" : "Select"}
                    </option>
                    <option value="Produce">{currentText.categoryProduce || "Produce"}</option>
                    <option value="Dairy">{currentText.categoryDairy || "Dairy"}</option>
                    <option value="Meat/Fish">{currentText.categoryMeat || "Meat/Fish"}</option>
                    <option value="Pantry/Grains">{currentText.categoryPantry || "Pantry/Grains"}</option>
                    <option value="Spices">{currentText.categorySpices || "Spices"}</option>
                    <option value="Other">{currentText.categoryOther || "Other"}</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="pantry-expiry-days"
                    className="block text-[11px] font-semibold text-stone-300 mb-1"
                  >
                    {currentText.pantryFormShelfLife}
                  </label>
                  <input
                    id="pantry-expiry-days"
                    type="number"
                    value={expiryDays}
                    onChange={(e) =>
                    setExpiryDays(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                    className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="pantry-cost"
                  className="block text-[11px] font-semibold text-stone-300 mb-1"
                >
                  {currentText.pantryFormCost}
                </label>
                <input
                  id="pantry-cost"
                  type="number"
                  step="0.1"
                  value={cost}
                  onChange={(e) =>
                    setCost(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {formError && (
                <p
                  role="alert"
                  aria-live="polite"
                  className="text-xs text-red-300"
                >
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-stone-700 text-stone-300 hover:bg-stone-600 text-xs font-semibold cursor-pointer"
                >
                  {currentText.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md cursor-pointer"
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
        title={currentText.pantryClearAll}
        description={currentText.pantryClearConfirm}
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
            (items || []).forEach((item) => onAddItem(item));
          }
        }}
      />
    </div>
  );
};
