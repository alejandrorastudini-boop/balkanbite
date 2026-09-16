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
} from "lucide-react";
import { Language, Currency, PantryItem } from "../types";
import { t } from "../utils/translations";
import {
  isCandidateReadyForPantry,
  normalizeScanCandidate,
  toPantryPayload,
  type SafeScanCandidate,
} from "../utils/safeScanCandidate";

interface ScannedItem extends SafeScanCandidate {
  id: string;
  selected: boolean;
  /** Capture results are review candidates, never authoritative pantry records. */
  captureSource: "ai-suggestion" | "barcode-suggestion";
  quantityConfirmed: boolean;
  unitConfirmed: boolean;
}

const isScannedItemConfirmed = (item: ScannedItem) =>
  item.quantityConfirmed && item.unitConfirmed && isCandidateReadyForPantry(item);

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
  currency: _currency,
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
  // Only the latest capture request may publish candidates or failure state.
  const captureRequestIdRef = useRef(0);

  if (!isOpen) return null;

  const confirmationText =
    language === "es"
      ? "Cada campo rellenado es una sugerencia revisable del análisis de imagen con IA o de la consulta de código de barras. El nombre, la categoría, el coste y la caducidad siguen sin estar verificados incluso después de confirmar la cantidad y la unidad; los valores desconocidos permanecen vacíos. Confirma la cantidad y la unidad por separado antes de añadir el alimento."
      : language === "bg"
      ? "Всяко попълнено поле е предложение за преглед от анализа на изображението с ИИ или справката по баркод. Името, категорията, цената и срокът на годност остават непроверени дори след потвърждаване на количеството и мерната единица; неизвестните стойности остават празни. Потвърдете количеството и мерната единица поотделно, преди да добавите продукта."
      : "Every populated field is a reviewable suggestion from AI image analysis or barcode lookup. Product name, category, cost, and expiry remain unverified even after quantity and unit are confirmed; unknown values stay blank. Confirm quantity and unit separately before adding the item.";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // A new capture invalidates every previous candidate immediately, including while the file is being read.
    const readRequestId = ++captureRequestIdRef.current;
    setScannedItems([]);
    setImagePreview(null);
    setIsScanning(true);
    setErrorMsg(null);

    const handleReadFailure = () => {
      if (readRequestId !== captureRequestIdRef.current) return;
      ++captureRequestIdRef.current;
      setScannedItems([]);
      setImagePreview(null);
      setIsScanning(false);
      setErrorMsg(
        language === "es"
          ? "No se pudo leer la imagen. Selecciona otro archivo e inténtalo de nuevo."
          : language === "bg"
          ? "Изображението не можа да бъде прочетено. Изберете друг файл и опитайте отново."
          : "The image could not be read. Please choose another file and try again."
      );
    };

    const reader = new FileReader();
    reader.onload = (event) => {
      if (readRequestId !== captureRequestIdRef.current) return;
      const base64 = event.target?.result;
      if (typeof base64 !== "string" || !base64) {
        handleReadFailure();
        return;
      }
      setImagePreview(base64);
      runAiScan(base64, file.type);
    };
    reader.onerror = handleReadFailure;
    reader.onabort = handleReadFailure;
    reader.readAsDataURL(file);
  };

  const runAiScan = async (base64Image: string, mimeType: string) => {
    const requestId = ++captureRequestIdRef.current;
    setIsScanning(true);
    setErrorMsg(null);
    setScannedItems([]);
    try {
      const res = await fetch("/api/ai/scan-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image, mimeType, scanType: scanMode, language }),
      });

      if (requestId !== captureRequestIdRef.current) return;
      if (!res.ok) throw new Error("Failed to analyze image");

      const data = await res.json();
      if (requestId !== captureRequestIdRef.current) return;
      if (data?.error || data?.success === false || data?.available === false) {
        throw new Error("Scanner returned a failure result");
      }
      const detected = (Array.isArray(data.items) ? data.items : [])
        .map((item: unknown, index: number) => {
          const candidate = normalizeScanCandidate(item);
          if (!candidate) return null;
          return {
            ...candidate,
            id: `scanned-${Date.now()}-${index}`,
            selected: false,
            captureSource: "ai-suggestion",
            quantityConfirmed: false,
            unitConfirmed: false,
          } satisfies ScannedItem;
        })
        .filter((item: ScannedItem | null): item is ScannedItem => item !== null);

      if (detected.length === 0) {
        // Empty results are not detections and must not leave a saveable candidate behind.
        setScannedItems([]);
        setErrorMsg(
          language === "es"
            ? "No se han detectado alimentos con claridad. Intenta con una foto más iluminada o introduce los datos manualmente."
            : language === "bg"
            ? "Не бяха разпознати ясно хранителни продукти. Моля, опитайте с по-добро осветление или въведете данните ръчно."
            : "Could not clearly identify food items. Please try with better lighting or enter them manually."
        );
      } else {
        setScannedItems(detected);
        // Keep provenance visible from the moment AI suggestions are shown, not only after a blocked save attempt.
        setErrorMsg(confirmationText);
      }
    } catch (err) {
      if (requestId !== captureRequestIdRef.current) return;
      console.error(err);
      // AI unavailability is a failure, not a detection.
      setScannedItems([]);
      setErrorMsg(
        language === "es"
          ? "Error de conexión con el escáner de IA. Inténtalo de nuevo."
          : language === "bg"
          ? "Грешка при връзка с AI скенера. Моля, опитайте отново."
          : "Error connecting to AI vision scanner. Please try again."
      );
    } finally {
      if (requestId === captureRequestIdRef.current) setIsScanning(false);
    }
  };

  const handleBarcodeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    // A new lookup immediately invalidates any prior suggestion so validation,
    // not-found responses, and request failures can never leave a stale save path.
    // Every lookup attempt, including an empty submission, invalidates an older in-flight result.
    const requestId = ++captureRequestIdRef.current;
    setScannedItems([]);
    if (!barcodeInput.trim()) {
      setIsScanning(false);
      setErrorMsg(null);
      return;
    }

    setIsScanning(true);
    setErrorMsg(null);
    setScannedItems([]);
    try {
      const res = await fetch(`/api/barcode/${encodeURIComponent(barcodeInput.trim())}?lang=${language}`);
      if (requestId !== captureRequestIdRef.current) return;
      if (!res.ok) {
        setScannedItems([]);
        throw new Error("Barcode not found. No pantry candidate is available to review or add.");
      }

      const data = await res.json();
      if (requestId !== captureRequestIdRef.current) return;
      if (data?.error || data?.found === false || data?.success === false) {
        throw new Error("Barcode not found. No pantry candidate is available to review or add.");
      }
      const candidate = normalizeScanCandidate(data);
      if (!candidate) throw new Error("Barcode result has no product name");

      const newItem: ScannedItem = {
        ...candidate,
        id: `barcode-${Date.now()}`,
        selected: false,
        captureSource: "barcode-suggestion",
        quantityConfirmed: false,
        unitConfirmed: false,
      };

      setScannedItems([newItem]);
      // Barcode lookup fields are candidates too; keep their unverified provenance visible during review.
      setErrorMsg(confirmationText);
      setBarcodeInput("");
    } catch (err) {
      if (requestId !== captureRequestIdRef.current) return;
      console.error(err);
      // Failure and not-found states must never expose an authoritative candidate or save path.
      setScannedItems([]);
      setErrorMsg(
        language === "es"
          ? "No se pudo encontrar el código de barras. No hay ningún candidato de despensa disponible para revisar o añadir."
          : language === "bg"
          ? "Баркодът не можа да бъде намерен. Няма налично предложение за преглед или добавяне в килера."
          : "The barcode could not be found. No pantry candidate is available to review or add."
      );
    } finally {
      if (requestId === captureRequestIdRef.current) setIsScanning(false);
    }
  };

  const handleToggleItem = (id: string) => {
    setScannedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (!item.selected && !isScannedItemConfirmed(item)) {
          setErrorMsg(confirmationText);
          return item;
        }
        setErrorMsg(null);
        return { ...item, selected: !item.selected };
      })
    );
  };

  const updateRequiredField = (id: string, field: "quantity" | "unit", rawValue: string) => {
    setErrorMsg(null);
    setScannedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next =
          field === "quantity"
            ? {
                ...item,
                quantity:
                  rawValue.trim() && Number.isFinite(Number(rawValue)) && Number(rawValue) > 0
                    ? Number(rawValue)
                    : undefined,
              }
            : { ...item, unit: rawValue.trim() || undefined };
        const confirmed = {
          ...next,
          quantityConfirmed:
            field === "quantity" ? typeof next.quantity === "number" : item.quantityConfirmed,
          unitConfirmed: field === "unit" ? Boolean(next.unit) : item.unitConfirmed,
        };
        return { ...confirmed, selected: item.selected && isScannedItemConfirmed(confirmed) };
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setScannedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveToPantry = () => {
    const selected = scannedItems.filter((item) => item.selected);
    if (selected.length === 0) return;

    const payload = selected.map(toPantryPayload);
    if (payload.some((item) => item === null)) {
      setErrorMsg(confirmationText);
      return;
    }

    onAddItems(payload as Array<Omit<PantryItem, "id" | "addedAt">>);
    handleResetModal();
    onClose();
  };

  const handleResetModal = () => {
    setImagePreview(null);
    setScannedItems([]);
    setErrorMsg(null);
    setBarcodeInput("");
  };

  const selectedCount = scannedItems.filter((item) => item.selected).length;
  const pendingConfirmationCount = scannedItems.filter((item) => !isScannedItemConfirmed(item)).length;

  return (
    <div id="scan-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-850/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-sm">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-['Outfit'] flex items-center gap-2">
                {currentText.scanCameraModalTitle || (language === "es" ? "Escáner Visual con IA" : language === "bg" ? "AI Визуален скенер" : "AI Visual Scanner")}
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">AI Vision</span>
              </h2>
              <p className="text-xs text-stone-400 line-clamp-1">
                {currentText.scanCameraModalSubtitle || (language === "es" ? "Detecta ingredientes desde tu cámara o ticket" : language === "bg" ? "Разпознайте продукти с камерата или от касова бележка" : "Detect ingredients from camera or receipt")}
              </p>
            </div>
          </div>
          <button onClick={() => { handleResetModal(); onClose(); }} className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 border-b border-stone-800 bg-stone-900/60 flex items-center gap-1.5">
          {(["fridge", "receipt", "barcode"] as const).map((mode) => {
            const Icon = mode === "fridge" ? Camera : mode === "receipt" ? Receipt : Barcode;
            const label = mode === "fridge"
              ? (currentText.scanModeFridge || (language === "es" ? "Nevera / Despensa" : language === "bg" ? "Хладилник / Килер" : "Fridge / Pantry"))
              : mode === "receipt"
              ? (currentText.scanModeReceipt || (language === "es" ? "Ticket de Súper" : language === "bg" ? "Касова бележка" : "Supermarket Receipt"))
              : (currentText.scanModeBarcode || (language === "es" ? "Código de Barras" : language === "bg" ? "Баркод" : "Barcode"));
            return (
              <button key={mode} type="button" onClick={() => { setScanMode(mode); handleResetModal(); }} className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${scanMode === mode ? "bg-emerald-600 text-white shadow-sm" : "bg-stone-800/80 text-stone-400 hover:text-stone-200"}`}>
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {scanMode === "barcode" ? (
            <div className="space-y-3">
              <form onSubmit={handleBarcodeSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <input type="text" value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} placeholder={language === "es" ? "Introduce código EAN..." : language === "bg" ? "Въведете EAN баркод..." : "Enter EAN barcode..."} className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-400 focus:outline-none focus:border-emerald-500" />
                </div>
                <button type="submit" disabled={isScanning || !barcodeInput.trim()} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0">
                  {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Barcode className="w-4 h-4" />}
                  <span>{language === "es" ? "Buscar" : language === "bg" ? "Търси" : "Search"}</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              {!imagePreview ? (
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-stone-700 hover:border-emerald-500/70 bg-stone-850/50 hover:bg-stone-850 rounded-2xl p-8 text-center transition-all cursor-pointer group space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-105 group-hover:bg-emerald-500/20 flex items-center justify-center transition-all"><Camera className="w-7 h-7" /></div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      {scanMode === "fridge" ? (language === "es" ? "Hacer foto de la nevera o despensa" : language === "bg" ? "Снимка на хладилника или килера" : "Take photo of fridge or pantry") : (language === "es" ? "Fotografiar ticket de supermercado" : language === "bg" ? "Снимка на касова бележка" : "Take photo of supermarket receipt")}
                    </p>
                    <p className="text-xs text-stone-400 mt-1">{language === "es" ? "Haz clic para abrir tu cámara o subir una imagen" : language === "bg" ? "Натиснете, за да отворите камерата или качите снимка" : "Click to open camera or upload an image"}</p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{language === "es" ? "Seleccionar archivo o disparar cámara" : language === "bg" ? "Изберете файл или снимайте" : "Select file or snap photo"}</span>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-stone-750 bg-stone-950">
                  <img src={imagePreview} alt="Preview" className="w-full max-h-48 object-cover opacity-80" />
                  {isScanning && <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2"><Loader2 className="w-8 h-8 text-emerald-400 animate-spin" /><span className="text-xs font-bold text-white font-['Outfit'] animate-pulse">{currentText.scanAnalyzing || (language === "es" ? "Analizando alimentos con IA..." : language === "bg" ? "Анализиране на храни с AI..." : "Analyzing items with AI...")}</span></div>}
                  <button type="button" onClick={() => { setImagePreview(null); setScannedItems([]); }} className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black/90 text-white text-[11px] font-semibold backdrop-blur-sm transition-colors cursor-pointer">{language === "es" ? "Cambiar foto" : language === "bg" ? "Смени снимката" : "Change photo"}</button>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
            </div>
          )}

          {scannedItems.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-stone-800">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-white font-['Outfit'] flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-amber-400" />{currentText.scanFoundItems || (language === "es" ? "Alimentos detectados" : language === "bg" ? "Разпознати продукти" : "Detected items")} ({scannedItems.length})</span>
                <span className="text-[11px] text-stone-400">{selectedCount} {language === "es" ? "listos" : language === "bg" ? "готови" : "ready"}</span>
              </div>

              {pendingConfirmationCount > 0 && (
                <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-200 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{confirmationText}</span>
                </div>
              )}

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {scannedItems.map((item) => {
                  const ready = isScannedItemConfirmed(item);
                  return (
                    <div key={item.id} className={`p-3 rounded-xl border transition-all ${item.selected ? "bg-emerald-950/20 border-emerald-500/40 text-white" : ready ? "bg-stone-850/50 border-stone-700 text-stone-300" : "bg-amber-950/10 border-amber-500/30 text-stone-300"}`}>
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <button type="button" onClick={() => handleToggleItem(item.id)} aria-label={ready ? "Toggle item" : "Complete quantity and unit first"} className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${ready ? "cursor-pointer" : "cursor-not-allowed opacity-50"} ${item.selected ? "bg-emerald-600 border-emerald-500 text-white" : "border-stone-600"}`}>
                            {item.selected && <Check className="w-3.5 h-3.5" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold block truncate">{item.name}</span>
                            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-2">
                              <label className="space-y-1">
                                <span className="text-[10px] text-stone-400">{language === "es" ? "Cantidad" : language === "bg" ? "Количество" : "Quantity"}</span>
                                <input type="number" min="0" step="any" inputMode="decimal" value={item.quantity ?? ""} onChange={(e) => updateRequiredField(item.id, "quantity", e.target.value)} placeholder="?" className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[10px] text-stone-400">{language === "es" ? "Unidad" : language === "bg" ? "Единица" : "Unit"}</span>
                                <input type="text" value={item.unit ?? ""} onChange={(e) => updateRequiredField(item.id, "unit", e.target.value)} placeholder={language === "es" ? "kg, g, uds..." : language === "bg" ? "кг, г, бр..." : "kg, g, pcs..."} className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                              </label>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-stone-400">
                              <span className="text-emerald-400">{item.category}</span>
                              <span>•</span>
                              <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{item.estimatedDaysUntilExpiry !== undefined ? `~${item.estimatedDaysUntilExpiry}d` : (language === "es" ? "caducidad desconocida" : language === "bg" ? "неизвестен срок" : "expiry unknown")}</span>
                              <span>•</span>
                              <span>{item.approximateCostEUR !== undefined ? `€${item.approximateCostEUR.toFixed(2)}` : (language === "es" ? "coste desconocido" : language === "bg" ? "неизвестна цена" : "cost unknown")}</span>
                            </div>
                            {!ready && <p className="mt-1.5 text-[10px] text-amber-300">{confirmationText}</p>}
                          </div>
                        </div>
                        <button type="button" onClick={() => handleRemoveItem(item.id)} className="p-1 rounded-lg text-stone-500 hover:text-red-400 hover:bg-stone-800 transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-3.5 border-t border-stone-800 bg-stone-850/80 flex items-center justify-between gap-3">
          <button type="button" onClick={() => { handleResetModal(); onClose(); }} className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition-colors cursor-pointer">{currentText.cancel || "Cancel"}</button>
          <button type="button" disabled={selectedCount === 0} onClick={handleSaveToPantry} className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40 flex items-center gap-1.5 cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
            <span>{currentText.addScannedToPantry || (language === "es" ? "Añadir a mi despensa" : language === "bg" ? "Добави към килера" : "Add to pantry")} ({selectedCount})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
