import React, { useEffect, useState, useRef } from "react";
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
  normalizeScanCandidate,
  toPantryPayload,
  type SafeScanCandidate,
} from "../utils/safeScanCandidate";
import { admitSuccessfulScanItems } from "../utils/safeScanResult";
import { isConfirmedScanCandidate } from "../utils/confirmedScanCandidate";

interface ScannedItem extends SafeScanCandidate {
  id: string;
  selected: boolean;
  /** Capture results are review candidates, never authoritative pantry records. */
  captureSource: "ai-suggestion" | "barcode-suggestion";
  quantityConfirmed: boolean;
  unitConfirmed: boolean;
}

const isScannedItemConfirmed = (item: ScannedItem) =>
  isConfirmedScanCandidate(item, item.quantityConfirmed, item.unitConfirmed);

/** A confirmation belongs only to the exact quantity or unit value reviewed. */
const updateCandidateReviewField = <K extends keyof ScannedItem>(
  item: ScannedItem,
  field: K,
  value: ScannedItem[K]
): ScannedItem => {
  const requiredValueChanged =
    (field === "quantity" && value !== item.quantity) ||
    (field === "unit" && value !== item.unit);

  return {
    ...item,
    [field]: value,
    // Editing either required value revokes both the field-specific review and
    // any prior selection, so a stale confirmation can never remain saveable.
    ...(requiredValueChanged ? { selected: false } : {}),
    ...(field === "quantity" && value !== item.quantity ? { quantityConfirmed: false } : {}),
    ...(field === "unit" && value !== item.unit ? { unitConfirmed: false } : {}),
  };
};

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

  useEffect(() => {
    if (isOpen) return;

    // Closing the modal invalidates pending file reads/lookups and removes every
    // review candidate. A late success or a later reopen must not restore a save
    // path from an abandoned capture request.
    ++captureRequestIdRef.current;
    setScannedItems([]);
    setImagePreview(null);
    setIsScanning(false);
    setErrorMsg(null);
    setBarcodeInput("");
  }, [isOpen]);

  if (!isOpen) return null;

  const confirmationText =
    language === "es"
      ? "Cada campo rellenado es una sugerencia revisable del análisis de imagen con IA o de la consulta de código de barras. El nombre, la categoría, el coste y la caducidad siguen sin estar verificados incluso después de confirmar la cantidad y la unidad; los valores desconocidos permanecen vacíos. Cada confirmación se aplica solo al valor de cantidad o unidad que se muestra en ese momento. Confirma ambos por separado antes de añadir el alimento."
      : language === "bg"
      ? "Всяко попълнено поле е предложение за преглед от анализа на изображението с ИИ или справката по баркод. Името, категорията, цената и срокът на годност остават непроверени дори след потвърждаване на количеството и мерната единица; неизвестните стойности остават празни. Всяко потвърждение важи само за показаната в момента стойност за количество или мерна единица. Потвърдете и двете поотделно, преди да добавите продукта."
      : "Every populated field is a reviewable suggestion from AI image analysis or barcode lookup. Product name, category, cost, and expiry are unverified suggestions even after quantity and unit are confirmed; unknown values stay blank. Each confirmation applies only to the quantity or unit value currently shown. You must explicitly confirm both before the item can be added to the pantry.";

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
      // Only an explicitly successful response may publish reviewable candidates.
      // Missing or malformed status is a no-result state, never a detection.
      const detected = admitSuccessfulScanItems<unknown>(data, data?.items)
        .map((item, index) => {
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
          ? "El escaneo con IA falló. No hay ningún candidato de despensa para revisar o añadir y no se puede guardar nada. Inténtalo de nuevo."
          : language === "bg"
          ? "AI сканирането беше неуспешно. Няма предложение за преглед или добавяне в килера и нищо не може да бъде запазено. Моля, опитайте отново."
          : "AI vision scan failed. No pantry candidate is available to review or add, and nothing can be saved. Please try again."
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
      setErrorMsg(
        language === "es"
          ? "Introduce un código de barras para buscar. No hay ningún candidato de despensa para revisar o añadir y no se puede guardar nada."
          : language === "bg"
          ? "Въведете баркод за търсене. Няма предложение за преглед или добавяне в килера и нищо не може да бъде запазено."
          : "Enter a barcode to search. No pantry candidate is available to review or add, and nothing can be saved."
      );
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
        throw new Error("Barcode not found. No pantry candidate is available to review or add, and nothing can be saved.");
      }

      const data = await res.json();
      if (requestId !== captureRequestIdRef.current) return;
      // A barcode candidate requires an explicit `found: true` lookup marker.
      // HTTP success or a generic `success` flag does not establish that a product
      // exists, so missing/malformed/not-found statuses remain authoritative no-result states.
      if (
        !data ||
        typeof data !== "object" ||
        data.error ||
        data.available === false ||
        data.found !== true
      ) {
        throw new Error("Barcode not found. No pantry candidate is available to review or add, and nothing can be saved.");
      }
      const candidate = normalizeScanCandidate(data);
      if (!candidate) {
        throw new Error("Barcode result has no product name. No pantry candidate is available to review or add.");
      }

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
          ? "La consulta del código de barras falló o no encontró el producto. No hay ningún candidato de despensa para revisar o añadir y no se puede guardar nada."
          : language === "bg"
          ? "Справката по баркод беше неуспешна или продуктът не беше намерен. Няма предложение за преглед или добавяне в килера и нищо не може да бъде запазено."
          : "The barcode lookup failed or did not find the product. No pantry candidate is available to review or add, and nothing can be saved."
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
    setErrorMsg(confirmationText);
    setScannedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const value =
          field === "quantity"
            ? rawValue.trim() && Number.isFinite(Number(rawValue)) && Number(rawValue) > 0
              ? Number(rawValue)
              : undefined
            : rawValue.trim() || undefined;
        return updateCandidateReviewField(item, field, value);
      })
    );
  };

  const confirmRequiredField = (id: string, field: "quantity" | "unit") => {
    setScannedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (field === "quantity" && typeof item.quantity === "number") {
          return { ...item, quantityConfirmed: true };
        }
        if (field === "unit" && item.unit) return { ...item, unitConfirmed: true };
        return item;
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setScannedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveToPantry = () => {
    // Treat selection as presentation state only. Recheck both confirmations at
    // the persistence boundary so no stale or future UI path can save a candidate
    // whose quantity and unit were not explicitly reviewed.
    const selected = scannedItems.filter(
      (item) => item.selected && isScannedItemConfirmed(item)
    );
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
    // Resetting or changing capture mode abandons every pending read/lookup.
    // A late response must not recreate candidates after the user cleared them.
    ++captureRequestIdRef.current;
    setImagePreview(null);
    setScannedItems([]);
    setIsScanning(false);
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
                  <input
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => {
                      // Editing the barcode abandons both the displayed candidate and any lookup
                      // still in flight, so an old response cannot restore a stale save path.
                      ++captureRequestIdRef.current;
                      setBarcodeInput(e.target.value);
                      setScannedItems([]);
                      setIsScanning(false);
                      setErrorMsg(null);
                    }}
                    placeholder={language === "es" ? "Introduce código EAN..." : language === "bg" ? "Въведете EAN баркод..." : "Enter EAN barcode..."}
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-400 focus:outline-none focus:border-emerald-500"
                  />
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
                  <button type="button" onClick={handleResetModal} className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black/90 text-white text-[11px] font-semibold backdrop-blur-sm transition-colors cursor-pointer">{language === "es" ? "Cambiar foto" : language === "bg" ? "Смени снимката" : "Change photo"}</button>
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
                          <button type="button" disabled={!ready} onClick={() => handleToggleItem(item.id)} aria-label={ready ? "Toggle item" : "Complete quantity and unit first"} className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${ready ? "cursor-pointer" : "cursor-not-allowed opacity-50"} ${item.selected ? "bg-emerald-600 border-emerald-500 text-white" : "border-stone-600"}`}>
                            {item.selected && <Check className="w-3.5 h-3.5" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold block truncate">{item.name}</span>
                            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-2">
                              <div className="space-y-1">
                                <span className="text-[10px] text-stone-400">{language === "es" ? "Cantidad" : language === "bg" ? "Количество" : "Quantity"}</span>
                                <input aria-label={language === "es" ? "Cantidad" : language === "bg" ? "Количество" : "Quantity"} type="number" min="0" step="any" inputMode="decimal" value={item.quantity ?? ""} onChange={(e) => updateRequiredField(item.id, "quantity", e.target.value)} placeholder="?" className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                                <button type="button" disabled={typeof item.quantity !== "number" || item.quantityConfirmed} onClick={() => confirmRequiredField(item.id, "quantity")} className="w-full rounded-lg border border-emerald-500/40 px-2 py-1 text-[10px] text-emerald-300 disabled:border-stone-700 disabled:text-stone-500">
                                  {item.quantityConfirmed ? (language === "es" ? "Confirmada" : language === "bg" ? "Потвърдено" : "Confirmed") : (language === "es" ? "Confirmar cantidad" : language === "bg" ? "Потвърди количество" : "Confirm quantity")}
                                </button>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] text-stone-400">{language === "es" ? "Unidad" : language === "bg" ? "Единица" : "Unit"}</span>
                                <input aria-label={language === "es" ? "Unidad" : language === "bg" ? "Единица" : "Unit"} type="text" value={item.unit ?? ""} onChange={(e) => updateRequiredField(item.id, "unit", e.target.value)} placeholder={language === "es" ? "kg, g, uds..." : language === "bg" ? "кг, г, бр..." : "kg, g, pcs..."} className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                                <button type="button" disabled={!item.unit || item.unitConfirmed} onClick={() => confirmRequiredField(item.id, "unit")} className="w-full rounded-lg border border-emerald-500/40 px-2 py-1 text-[10px] text-emerald-300 disabled:border-stone-700 disabled:text-stone-500">
                                  {item.unitConfirmed ? (language === "es" ? "Confirmada" : language === "bg" ? "Потвърдено" : "Confirmed") : (language === "es" ? "Confirmar unidad" : language === "bg" ? "Потвърди единица" : "Confirm unit")}
                                </button>
                              </div>
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
          <button type="button" disabled={selectedCount === 0} onClick={() => { if (selectedCount > 0) handleSaveToPantry(); }} className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40 flex items-center gap-1.5 cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
            <span>{currentText.addScannedToPantry || (language === "es" ? "Añadir a mi despensa" : language === "bg" ? "Добави към килера" : "Add to pantry")} ({selectedCount})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
