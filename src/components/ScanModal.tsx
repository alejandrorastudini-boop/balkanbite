import React, { useState, useRef } from "react";
import {
  Camera,
  Upload,
  Receipt,
  Barcode,
  Sparkles,
  Check,
  X,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { Language, Currency, PantryItem } from "../types";
import { t } from "../utils/translations";

interface ScannedItem {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  category?: "Produce" | "Dairy" | "Meat/Fish" | "Pantry/Grains" | "Spices" | "Other";
  estimatedDaysUntilExpiry?: number;
  approximateCostEUR?: number;
  confidence?: "high" | "medium" | "low";
  selected: boolean;
}

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  currency: Currency;
  onAddItems: (items: Array<Omit<PantryItem, "id" | "addedAt">>) => void;
}

export const ScanModal: React.FC<ScanModalProps> = ({
  isOpen,
  onClose,
  language,
  currency,
  onAddItems,
}) => {
  const currentText = t[language];
  const [scanMode, setScanMode] = useState<"fridge" | "receipt" | "barcode">("fridge");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      runAiScan(base64, file.type);
    };
    reader.readAsDataURL(file);
  };

  const runAiScan = async (base64Image: string, mimeType: string) => {
    setIsScanning(true);
    setErrorMsg(null);
    setScannedItems([]);
    try {
      const res = await fetch("/api/ai/scan-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Image,
          mimeType,
          scanType: scanMode,
          language,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to analyze image");
      }

      const data = await res.json();
      const detected = (Array.isArray(data.items) ? data.items : [])
        .filter((item: any) => typeof item?.name === "string" && item.name.trim().length > 0)
        .map((item: any, index: number) => {
        let cat: "Produce" | "Dairy" | "Meat/Fish" | "Pantry/Grains" | "Spices" | "Other" = "Pantry/Grains";
        const rawCat = (item.category || "").toLowerCase();
        if (rawCat.includes("produce") || rawCat.includes("fruit") || rawCat.includes("veg")) cat = "Produce";
        else if (rawCat.includes("dairy") || rawCat.includes("cheese") || rawCat.includes("milk")) cat = "Dairy";
        else if (rawCat.includes("meat") || rawCat.includes("fish")) cat = "Meat/Fish";
        else if (rawCat.includes("spice") || rawCat.includes("herb")) cat = "Spices";
        else if (rawCat.includes("pantry") || rawCat.includes("grain") || rawCat.includes("bake")) cat = "Pantry/Grains";

        return {
          id: `scanned-${Date.now()}-${index}`,
          name: item.name || (language === "es" ? "Ingrediente" : language === "bg" ? "Продукт" : "Ingredient"),
          quantity: item.quantity || 1,
          unit: item.unit || (language === "es" ? "uds" : language === "bg" ? "бр." : "pcs"),
          category: cat,
          estimatedDaysUntilExpiry: item.estimatedDaysUntilExpiry || 7,
          approximateCostEUR: item.approximateCostEUR || 1.5,
          confidence: item.confidence || "high",
          selected: true,
        };
      });

      if (detected.length === 0) {
        setErrorMsg(
          language === "es"
            ? "No se han detectado alimentos con claridad. Intenta con una foto más iluminada o introduce los datos manualmente."
            : language === "bg"
            ? "Не бяха разпознати ясно хранителни продукти. Моля, опитайте с по-добро осветление или въведете данните ръчно."
            : "Could not clearly identify food items. Please try with better lighting or enter them manually."
        );
      } else {
        setScannedItems(detected);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        language === "es"
          ? "Error de conexión con el escáner de IA. Inténtalo de nuevo."
          : language === "bg"
          ? "Грешка при връзка с AI скенера. Моля, опитайте отново."
          : "Error connecting to AI vision scanner. Please try again."
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleBarcodeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    setIsScanning(true);
    setErrorMsg(null);
    setScannedItems([]);
    try {
      const res = await fetch(`/api/barcode/${encodeURIComponent(barcodeInput.trim())}?lang=${language}`);
      if (!res.ok) {
        throw new Error("Barcode not found");
      }

      const data = await res.json();
      if (typeof data?.name !== "string" || !data.name.trim()) {
        throw new Error("Barcode result has no product name");
      }

      let cat: "Produce" | "Dairy" | "Meat/Fish" | "Pantry/Grains" | "Spices" | "Other" = "Pantry/Grains";
      const rawCat = (data.category || "").toLowerCase();
      if (rawCat.includes("produce")) cat = "Produce";
      else if (rawCat.includes("dairy")) cat = "Dairy";
      else if (rawCat.includes("meat")) cat = "Meat/Fish";

      const newItem: ScannedItem = {
        id: `barcode-${Date.now()}`,
        name: data.name.trim(),
        quantity: data.quantity || 1,
        unit: data.unit || "pcs",
        category: cat,
        estimatedDaysUntilExpiry: data.estimatedDaysUntilExpiry || 14,
        approximateCostEUR: 1.8,
        confidence: "high",
        selected: true,
      };

      setScannedItems((prev) => [newItem, ...prev]);
      setBarcodeInput("");
    } catch (err) {
      setErrorMsg(
        language === "es"
          ? "Error buscando el código de barras."
          : language === "bg"
          ? "Грешка при търсене на баркода."
          : "Error looking up barcode."
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleToggleItem = (id: string) => {
    setScannedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleRemoveItem = (id: string) => {
    setScannedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveToPantry = () => {
    const selected = scannedItems.filter((i) => i.selected);
    if (selected.length === 0) return;

    const payload = selected.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      expiryDaysLeft: item.estimatedDaysUntilExpiry,
      estimatedCostEUR: item.approximateCostEUR,
    }));

    onAddItems(payload);
    handleResetModal();
    onClose();
  };

  const handleResetModal = () => {
    setImagePreview(null);
    setScannedItems([]);
    setErrorMsg(null);
    setBarcodeInput("");
  };

  const selectedCount = scannedItems.filter((i) => i.selected).length;

  return (
    <div
      id="scan-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-850/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-sm">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-['Outfit'] flex items-center gap-2">
                {currentText.scanCameraModalTitle || (language === "es" ? "Escáner Visual con IA" : language === "bg" ? "AI Визуален скенер" : "AI Visual Scanner")}
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                  AI Vision
                </span>
              </h2>
              <p className="text-xs text-stone-400 line-clamp-1">
                {currentText.scanCameraModalSubtitle || (language === "es" ? "Detecta ingredientes desde tu cámara o ticket" : language === "bg" ? "Разпознайте продукти с камерата или от касова бележка" : "Detect ingredients from camera or receipt")}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleResetModal();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="p-3 border-b border-stone-800 bg-stone-900/60 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setScanMode("fridge");
              handleResetModal();
            }}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              scanMode === "fridge"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-stone-800/80 text-stone-400 hover:text-stone-200"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{currentText.scanModeFridge || (language === "es" ? "Nevera / Despensa" : language === "bg" ? "Хладилник / Килер" : "Fridge / Pantry")}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setScanMode("receipt");
              handleResetModal();
            }}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              scanMode === "receipt"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-stone-800/80 text-stone-400 hover:text-stone-200"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>{currentText.scanModeReceipt || (language === "es" ? "Ticket de Súper" : language === "bg" ? "Касова бележка" : "Supermarket Receipt")}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setScanMode("barcode");
              handleResetModal();
            }}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              scanMode === "barcode"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-stone-800/80 text-stone-400 hover:text-stone-200"
            }`}
          >
            <Barcode className="w-3.5 h-3.5" />
            <span>{currentText.scanModeBarcode || (language === "es" ? "Código de Barras" : language === "bg" ? "Баркод" : "Barcode")}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Barcode Mode View */}
          {scanMode === "barcode" ? (
            <div className="space-y-3">
              <form onSubmit={handleBarcodeSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder={
                      language === "es"
                        ? "Introduce código EAN (ej: 8480000100412)..."
                        : language === "bg"
                        ? "Въведете EAN баркод (напр. 8480000100412)..."
                        : "Enter EAN barcode (e.g. 8480000100412)..."
                    }
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isScanning || !barcodeInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Barcode className="w-4 h-4" />}
                  <span>{language === "es" ? "Buscar" : language === "bg" ? "Търси" : "Search"}</span>
                </button>
              </form>

              {/* Quick Barcode Examples */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] text-stone-400">
                  {language === "es" ? "Probar rápido:" : language === "bg" ? "Бърз тест:" : "Quick try:"}
                </span>
                {[
                  {
                    label: language === "es" ? "Leche Entera" : language === "bg" ? "Прясно мляко" : "Whole Milk",
                    code: "8480000100412",
                  },
                  {
                    label: language === "es" ? "Yogur Búlgaro" : language === "bg" ? "Кисело мляко" : "Bulgarian Yogurt",
                    code: "3800000100123",
                  },
                  {
                    label: language === "es" ? "Huevos L" : language === "bg" ? "Яйца L" : "Eggs L",
                    code: "8410000000123",
                  },
                ].map((sample) => (
                  <button
                    key={sample.code}
                    type="button"
                    onClick={() => {
                      setBarcodeInput(sample.code);
                    }}
                    className="text-[11px] px-2 py-0.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition-colors"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Visual Camera / Upload View */
            <div className="space-y-3">
              {!imagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-stone-700 hover:border-emerald-500/70 bg-stone-850/50 hover:bg-stone-850 rounded-2xl p-8 text-center transition-all cursor-pointer group space-y-3"
                >
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-105 group-hover:bg-emerald-500/20 flex items-center justify-center transition-all">
                    <Camera className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      {scanMode === "fridge"
                        ? language === "es"
                          ? "Hacer foto de la nevera o despensa"
                          : language === "bg"
                          ? "Снимка на хладилника или килера"
                          : "Take photo of fridge or pantry"
                        : language === "es"
                        ? "Fotografiar ticket de supermercado"
                        : language === "bg"
                        ? "Снимка на касова бележка"
                        : "Take photo of supermarket receipt"}
                    </p>
                    <p className="text-xs text-stone-400 mt-1">
                      {language === "es"
                        ? "Haz clic para abrir tu cámara o subir una imagen"
                        : language === "bg"
                        ? "Натиснете, за да отворите камерата или качите снимка"
                        : "Click to open camera or upload an image"}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {language === "es"
                        ? "Seleccionar archivo o disparar cámara"
                        : language === "bg"
                        ? "Изберете файл или снимайте"
                        : "Select file or snap photo"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-stone-750 bg-stone-950">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full max-h-48 object-cover opacity-80"
                  />
                  {isScanning && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                      <span className="text-xs font-bold text-white font-['Outfit'] animate-pulse">
                        {currentText.scanAnalyzing || (language === "es" ? "Analizando alimentos con IA..." : language === "bg" ? "Анализиране на храни с AI..." : "Analyzing items with AI...")}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setScannedItems([]);
                    }}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black/90 text-white text-[11px] font-semibold backdrop-blur-sm transition-colors cursor-pointer"
                  >
                    {language === "es" ? "Cambiar foto" : language === "bg" ? "Смени снимката" : "Change photo"}
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {/* Scanned Items Results */}
          {scannedItems.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-stone-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white font-['Outfit'] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  {currentText.scanFoundItems || (language === "es" ? "Alimentos detectados" : language === "bg" ? "Разпознати продукти" : "Detected items")} ({scannedItems.length})
                </span>
                <span className="text-[11px] text-stone-400">
                  {selectedCount} {language === "es" ? "seleccionados" : language === "bg" ? "избрани" : "selected"}
                </span>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {scannedItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                      item.selected
                        ? "bg-emerald-950/20 border-emerald-500/40 text-white"
                        : "bg-stone-850/50 border-stone-800 text-stone-400"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleItem(item.id)}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                          item.selected
                            ? "bg-emerald-600 border-emerald-500 text-white"
                            : "border-stone-600 hover:border-stone-500"
                        }`}
                      >
                        {item.selected && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <div className="min-w-0">
                        <span className="text-xs font-semibold block truncate">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                          <span>
                            {item.quantity} {item.unit}
                          </span>
                          <span>•</span>
                          <span className="text-emerald-400">{item.category}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Calendar className="w-2.5 h-2.5" />
                            ~{item.estimatedDaysUntilExpiry}d
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1 rounded-lg text-stone-500 hover:text-red-400 hover:bg-stone-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-stone-800 bg-stone-850/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              handleResetModal();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            {currentText.cancel || "Cancel"}
          </button>

          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={handleSaveToPantry}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {currentText.addScannedToPantry || (language === "es" ? "Añadir a mi despensa" : language === "bg" ? "Добави към килера" : "Add to pantry")} ({selectedCount})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
