import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Plus,
  ArrowRight,
  ShoppingBag,
  Check,
  Package,
  Layers,
  Clock,
  HelpCircle,
} from "lucide-react";
import { Language, Currency, ShoppingItem, PantryItem } from "../types";
import { translateFoodName, translateCategory, translateUnit } from "../utils/foodTranslator";

interface VoiceShoppingReconcileModalProps {
  isOpen: boolean;
  onClose: () => void;
  shoppingList: ShoppingItem[];
  language: Language;
  currency: Currency;
  onConfirmReconciliation: (result: {
    purchasedItemIds: string[];
    itemsToAddToPantry: Array<Omit<PantryItem, "id" | "addedAt">>;
  }) => void;
}

interface ReconciliationData {
  purchasedItemIds: string[];
  unpurchasedItemIds: string[];
  extraPurchasedItems: Array<{
    name: string;
    nameBg?: string;
    quantity: number;
    unit: string;
    category: string;
    estimatedCostEUR: number;
    expiryDaysLeft: number;
  }>;
  purchasedListItemsDetails: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
    category: string;
    estimatedCostEUR: number;
    expiryDaysLeft: number;
  }>;
  spokenFeedback: string;
}

export const VoiceShoppingReconcileModal: React.FC<VoiceShoppingReconcileModalProps> = ({
  isOpen,
  onClose,
  shoppingList,
  language,
  currency,
  onConfirmReconciliation,
}) => {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [step, setStep] = useState<"input" | "review">("input");
  const [reconciliationResult, setReconciliationResult] = useState<ReconciliationData | null>(null);

  // Editable state during review
  const [selectedPurchasedIds, setSelectedPurchasedIds] = useState<string[]>([]);
  const [selectedExtraItems, setSelectedExtraItems] = useState<Array<any>>([]);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const lastProcessedIndexRef = useRef(-1);

  // Sync ref
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setTranscript("");
      setIsListening(false);
      setIsAnalyzing(false);
      setStep("input");
      setReconciliationResult(null);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Setup Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = language === "bg" ? "bg-BG" : language === "es" ? "es-ES" : "en-US";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let newFinalText = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal && i > lastProcessedIndexRef.current) {
            newFinalText += event.results[i][0].transcript;
            lastProcessedIndexRef.current = i;
          }
        }

        if (newFinalText) {
          setTranscript((prev) => {
            const trimmedPrev = prev.trim();
            const trimmedNew = newFinalText.trim();
            return trimmedPrev ? trimmedPrev + " " + trimmedNew : trimmedNew;
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition notice:", event.error);
        if (["no-speech", "audio-capture", "not-allowed"].includes(event.error)) {
          isListeningRef.current = false;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        lastProcessedIndexRef.current = -1;
        if (isListeningRef.current) {
          setTimeout(() => {
            if (isListeningRef.current) {
              try {
                recognition.start();
              } catch (e) {
                // ignore
              }
            }
          }, 300);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [language]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert(
        language === "es"
          ? "El reconocimiento de voz no está disponible en este navegador. Puedes escribir lo que compraste abajo."
          : "Voice recognition is not available in this browser. You can type what you bought below."
      );
      return;
    }

    if (isListening) {
      isListeningRef.current = false;
      setIsListening(false);
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    } else {
      try {
        lastProcessedIndexRef.current = -1;
        isListeningRef.current = true;
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start speech recognition:", e);
      }
    }
  };

  const handleAnalyze = async (textToAnalyze?: string) => {
    const text = (textToAnalyze || transcript).trim();
    if (!text) return;

    if (isListening) {
      toggleListening();
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/ai/reconcile-shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: text,
          currentShoppingList: shoppingList,
          language,
        }),
      });

      const data: ReconciliationData = await response.json();
      setReconciliationResult(data);
      setSelectedPurchasedIds(data.purchasedItemIds || []);
      setSelectedExtraItems(data.extraPurchasedItems || []);
      setStep("review");
    } catch (err) {
      console.error("Error analyzing shopping reconciliation:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplySamplePhrase = (phrase: string) => {
    setTranscript(phrase);
    handleAnalyze(phrase);
  };

  const handleConfirmAndSave = () => {
    if (!reconciliationResult) return;

    // Collect list items that are selected as purchased
    const listItemsToAdd: Array<Omit<PantryItem, "id" | "addedAt">> = [];

    (shoppingList || []).forEach((shopItem) => {
      if (selectedPurchasedIds.includes(shopItem.id)) {
        listItemsToAdd.push({
          name: shopItem.name,
          quantity: shopItem.quantity || 1,
          unit: shopItem.unit || "pcs",
          category: shopItem.category || "Produce",
          expiryDaysLeft: 7,
          estimatedCostEUR: shopItem.estimatedPriceEUR || 1.5,
        });
      }
    });

    // Add extra items
    const extraItemsToAdd: Array<Omit<PantryItem, "id" | "addedAt">> = selectedExtraItems.map(
      (ext) => ({
        name: ext.name,
        nameBg: ext.nameBg || ext.name,
        quantity: ext.quantity || 1,
        unit: ext.unit || "pcs",
        category: ext.category || "Produce",
        expiryDaysLeft: ext.expiryDaysLeft || 7,
        estimatedCostEUR: ext.estimatedCostEUR || 1.5,
      })
    );

    onConfirmReconciliation({
      purchasedItemIds: selectedPurchasedIds,
      itemsToAddToPantry: [...listItemsToAdd, ...extraItemsToAdd],
    });

    onClose();
  };

  if (!isOpen) return null;

  const samplePhrases =
    language === "es"
      ? [
          "He comprado la pechuga de pollo, tomates y yogur, pero no compré el queso",
          "He comprado todo lo de la lista",
          "Compré todo menos los huevos, y además traje 2 aguacates y plátanos",
        ]
      : language === "bg"
      ? [
          "Купих пилешкото и доматите, но нямаше сирене",
          "Купих всичко от списъка",
          "Купих всичко без яйцата, и взех още банани",
        ]
      : [
          "I bought chicken breast, tomatoes and yogurt, but not feta cheese",
          "I bought everything on the list",
          "Bought everything except eggs, and also got 2 avocados",
        ];

  return (
    <div
      id="voice-shopping-modal-backdrop"
      className="fixed inset-0 z-50 bg-[#0B0F12]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        id="voice-shopping-modal-panel"
        className="w-full max-w-xl bg-[#131A1F] border border-amber-500/20 rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-[#161F26] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-['Outfit'] tracking-wide flex items-center gap-1.5">
                <span>
                  {language === "es"
                    ? "Registrar Compra por Voz"
                    : language === "bg"
                    ? "Гласово отчитане на покупка"
                    : "Voice Shopping Reconciliation"}
                </span>
                <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              </h3>
              <p className="text-[11px] text-stone-400">
                {language === "es"
                  ? "Dicta lo que compraste realmente y la IA actualizará tu despensa"
                  : language === "bg"
                  ? "Кажете какво точно купихте и килерът ще се обнови"
                  : "Dictate what you actually bought to reconcile pantry & list"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/[0.04] text-stone-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {step === "input" ? (
            <>
              {/* Mic Action Box */}
              <div className="bg-gradient-to-b from-white/[0.03] to-white/[0.01] border border-white/[0.06] rounded-2xl p-6 text-center space-y-4 relative overflow-hidden">
                <div className="relative inline-block">
                  {isListening && (
                    <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
                  )}
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 cursor-pointer shadow-lg ${
                      isListening
                        ? "bg-red-500 text-white scale-105 shadow-red-500/30"
                        : "bg-gradient-to-tr from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-stone-950 hover:scale-105 shadow-emerald-500/20"
                    }`}
                  >
                    {isListening ? (
                      <MicOff className="w-8 h-8 animate-pulse" />
                    ) : (
                      <Mic className="w-8 h-8" />
                    )}
                  </button>
                </div>

                <div>
                  <p className="text-sm font-bold text-white">
                    {isListening
                      ? language === "es"
                        ? "🎙️ Escuchando... Habla ahora"
                        : language === "bg"
                        ? "🎙️ Слушам... Говорете сега"
                        : "🎙️ Listening... Speak now"
                      : language === "es"
                      ? "Toca el micrófono para empezar a dictar"
                      : language === "bg"
                      ? "Натиснете микрофона, за да диктувате"
                      : "Tap the microphone to start dictating"}
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    {language === "es"
                      ? "Ej: 'Compré el pollo y los tomates, pero no había queso feta, y traje plátanos extra'"
                      : language === "bg"
                      ? "Напр: 'Купих пилешкото и доматите, но сирене нямаше'"
                      : "Ex: 'Bought chicken and tomatoes, but no cheese, and got extra bananas'"}
                  </p>
                </div>

                {/* Live Transcript / Manual input */}
                <div className="text-left space-y-1.5 pt-2">
                  <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                    {language === "es"
                      ? "Texto reconocido o escrito:"
                      : language === "bg"
                      ? "Разпознат или въведен текст:"
                      : "Recognized or typed text:"}
                  </label>
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    rows={3}
                    placeholder={
                      language === "es"
                        ? "Escribe o dicta aquí lo que compraste..."
                        : language === "bg"
                        ? "Напишете или диктувайте какво купихте..."
                        : "Type or dictate what you purchased..."
                    }
                    className="w-full p-3.5 bg-black/40 border border-white/[0.08] rounded-xl text-sm text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 resize-none font-medium leading-relaxed"
                  />
                </div>
              </div>

              {/* Quick sample chips */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  {language === "es"
                    ? "Ejemplos rápidos para probar:"
                    : language === "bg"
                    ? "Бързи примери:"
                    : "Quick examples to try:"}
                </span>
                <div className="flex flex-col gap-1.5">
                  {samplePhrases.map((phrase, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplySamplePhrase(phrase)}
                      className="text-left text-xs text-stone-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-amber-500/30 rounded-xl p-2.5 transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <span className="line-clamp-1 italic">"{phrase}"</span>
                      <ArrowRight className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-400 shrink-0 ml-2 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Review & Confirmation Step */
            reconciliationResult && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* AI Spoken Feedback */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      {language === "es"
                        ? "Análisis Inteligente de Compra"
                        : language === "bg"
                        ? "AI Анализ на покупката"
                        : "AI Purchase Reconciliation"}
                    </p>
                    <p className="text-xs text-stone-300 leading-relaxed font-medium">
                      {reconciliationResult.spokenFeedback}
                    </p>
                  </div>
                </div>

                {/* Section 1: Purchased Items from List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>
                        {language === "es"
                          ? `Comprados de la lista (${selectedPurchasedIds.length})`
                          : language === "bg"
                          ? `Закупени от списъка (${selectedPurchasedIds.length})`
                          : `Purchased from list (${selectedPurchasedIds.length})`}
                      </span>
                    </span>
                    <span className="text-[11px] text-stone-500">
                      {language === "es" ? "Pasan a tu despensa" : "Moves to pantry"}
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {shoppingList.map((item) => {
                      const isSelected = selectedPurchasedIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedPurchasedIds((prev) =>
                              prev.includes(item.id)
                                ? prev.filter((id) => id !== item.id)
                                : [...prev, item.id]
                            );
                          }}
                          className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? "bg-emerald-500/10 border-emerald-500/30 text-white"
                              : "bg-white/[0.02] border-white/[0.05] text-stone-400 opacity-60"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${
                                isSelected
                                  ? "bg-emerald-500 text-stone-950"
                                  : "border border-stone-600"
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <span className="text-xs font-semibold">
                              {translateFoodName(item.name, language)} ({item.quantity}{" "}
                              {translateUnit(item.unit, language)})
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-400">
                            {currency === "EUR"
                              ? `€${item.estimatedPriceEUR.toFixed(2)}`
                              : `$${(item.estimatedPriceEUR * 1.1).toFixed(2)}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section 2: Extra Spoken Items (Impulse / Not in list) */}
                {selectedExtraItems.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Plus className="w-4 h-4 text-amber-400" />
                        <span>
                          {language === "es"
                            ? `Nuevas compras extra (${selectedExtraItems.length})`
                            : language === "bg"
                            ? `Допълнителни покупки (${selectedExtraItems.length})`
                            : `Extra items purchased (${selectedExtraItems.length})`}
                        </span>
                      </span>
                      <span className="text-[11px] text-amber-500/80">
                        {language === "es" ? "Añadir a despensa" : "Add to pantry"}
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {selectedExtraItems.map((ext, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-amber-400" />
                            <span className="font-semibold text-stone-200">
                              {ext.name} ({ext.quantity} {ext.unit})
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-amber-400">
                            +{currency === "EUR" ? "€" : "$"}
                            {(ext.estimatedCostEUR || 1.5).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 3: Pending in List */}
                {shoppingList.filter((i) => !selectedPurchasedIds.includes(i.id)).length > 0 && (
                  <div className="p-3 bg-stone-900/60 border border-white/[0.06] rounded-xl flex items-center gap-2 text-xs text-stone-400">
                    <Clock className="w-4 h-4 text-stone-500 shrink-0" />
                    <span>
                      {language === "es"
                        ? `${shoppingList.filter((i) => !selectedPurchasedIds.includes(i.id)).length} artículos no comprados se mantendrán en tu lista.`
                        : `${shoppingList.filter((i) => !selectedPurchasedIds.includes(i.id)).length} unpurchased items will remain in your shopping list.`}
                    </span>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-white/[0.06] bg-[#161F26] flex items-center justify-between gap-3 shrink-0">
          {step === "input" ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-stone-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {language === "es" ? "Cancelar" : language === "bg" ? "Отказ" : "Cancel"}
              </button>

              <button
                type="button"
                disabled={!transcript.trim() || isAnalyzing}
                onClick={() => handleAnalyze()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-stone-950 text-xs font-extrabold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] disabled:opacity-50 cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>
                      {language === "es"
                        ? "Analizando con IA..."
                        : language === "bg"
                        ? "Анализиране..."
                        : "Analyzing..."}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {language === "es"
                        ? "Procesar Compra"
                        : language === "bg"
                        ? "Обработи покупката"
                        : "Process Purchase"}
                    </span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep("input")}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-stone-400 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{language === "es" ? "Dictar de nuevo" : "Dictate again"}</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmAndSave}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-extrabold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {language === "es"
                    ? "Confirmar y Pasar a Despensa"
                    : language === "bg"
                    ? "Потвърди и прехвърли в килера"
                    : "Confirm & Move to Pantry"}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
