import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  Bot,
  User,
  Check,
  Plus,
  Minus,
  ChefHat,
  Volume2,
  VolumeX,
  Trash2,
  UtensilsCrossed,
  X
} from "lucide-react";
import { ChatMessage, Language, PantryItem, MealLog } from "../types";
import { t } from "../utils/translations";
import { parseDeterministicRemovalIntent } from "../utils/deterministicRemovalIntent";

interface VoiceChefViewProps {
  pantry: PantryItem[];
  mealLogs?: MealLog[];
  chatMessages: ChatMessage[];
  onUpdateChatMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  onClearChat: () => void;
  onAddItemsToPantry: (items: any[]) => void;
  onDeductItemsFromPantry: (items: any[]) => void;
  onNavigateToRecipes: (query?: string) => void;
  onLogMeal: (log: any) => void;
  language: Language;
}

export const VoiceChefView: React.FC<VoiceChefViewProps> = ({
  pantry,
  mealLogs = [],
  chatMessages,
  onUpdateChatMessages,
  onClearChat,
  onAddItemsToPantry,
  onDeductItemsFromPantry,
  onNavigateToRecipes,
  onLogMeal,
  language,
}) => {
  const currentText = t[language];
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [speechSynthesisEnabled, setSpeechSynthesisEnabled] = useState(true);
  const [pendingPantryItems, setPendingPantryItems] = useState<any[] | null>(null);

  // Initialize welcome message when language changes if no messages exist
  useEffect(() => {
    if (chatMessages.length === 0) {
      onUpdateChatMessages([
        {
          id: "msg-welcome",
          sender: "assistant",
          text:
            language === "bg"
              ? "Здравейте! Аз съм вашият AI кулинарен асистент BalkanBite. Можете да ми диктувате какво сте купили (за да го добавя в килера), какво сте сготвили или изяли днес, или да ме попитате какво да сготвите за вечеря."
              : language === "es"
              ? "¡Hola! Soy tu Chef IA de BalkanBite. Puedes decirme qué has desayunado o comido hoy, los ingredientes que has comprado para tu despensa, o preguntarme qué cenar según tus ingredientes disponibles."
              : "Hello! I am your BalkanBite AI Chef. Tell me what you ate today, what ingredients you bought for your pantry, or ask what to cook for dinner based on your available items.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [language, chatMessages.length]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const lastProcessedIndexRef = useRef(-1);

  // Sync ref with state for use in event listeners
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isProcessing, pendingPantryItems]);

  // Setup Web Speech API for voice dictation
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
          setInputText((prev) => {
            const trimmedPrev = prev.trim();
            const trimmedNew = newFinalText.trim();
            return trimmedPrev ? trimmedPrev + " " + trimmedNew : trimmedNew;
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === 'no-speech' || event.error === 'audio-capture' || event.error === 'not-allowed') {
          isListeningRef.current = false;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        // Reset processed index for the next session
        lastProcessedIndexRef.current = -1;

        // If we're still supposed to be listening but the browser stopped it (silence timeout etc), restart it.
        // We add a longer delay to prevent the "machine gun" restart effect (choppiness)
        if (isListeningRef.current) {
          setTimeout(() => {
            if (isListeningRef.current) {
              try {
                recognition.start();
              } catch (e) {
                // Ignore "already started" errors
              }
            }
          }, 1500);
        }
      };

      recognitionRef.current = recognition;
    }
  }, [language]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert(
        language === "bg"
          ? "Гласовото разпознаване не се поддържа в този браузър. Моля, напишете командата в полето."
          : "Speech recognition is not supported in this browser. Please type your command below."
      );
      return;
    }

    if (isListening) {
      isListeningRef.current = false;
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        isListeningRef.current = true;
        recognitionRef.current.lang = language === "bg" ? "bg-BG" : language === "es" ? "es-ES" : "en-US";
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Error starting speech recognition:", err);
      }
    }
  };

  const speakText = (text: string) => {
    if (!speechSynthesisEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === "bg" ? "bg-BG" : language === "es" ? "es-ES" : "en-US";
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error", e);
    }
  };

  const pendingPantryItemsAreComplete = Boolean(
    pendingPantryItems?.length &&
      pendingPantryItems.every((item) => {
        if (!item || typeof item !== "object") return false;
        const name = typeof item.nameEn === "string" && item.nameEn.trim()
          ? item.nameEn.trim()
          : typeof item.name === "string"
          ? item.name.trim()
          : "";
        return Boolean(
          name &&
            typeof item.quantity === "number" &&
            Number.isFinite(item.quantity) &&
            item.quantity > 0 &&
            typeof item.unit === "string" &&
            item.unit.trim()
        );
      })
  );

  const confirmPendingPantryItems = () => {
    if (!pendingPantryItems || !pendingPantryItemsAreComplete) return;
    const confirmedItems = pendingPantryItems;
    const summary = confirmedItems
      .map((item) => `${item.quantity} ${item.unit} ${item.nameEn || item.name}`)
      .join(", ");

    setPendingPantryItems(null);
    onAddItemsToPantry(confirmedItems);

    const confirmationText =
      language === "bg"
        ? `Потвърдено. Добавих в килера: ${summary}.`
        : language === "es"
        ? `Confirmado. Añadí a la despensa: ${summary}.`
        : `Confirmed. Added to the pantry: ${summary}.`;

    onUpdateChatMessages((prev) => [
      ...prev,
      {
        id: `ai-confirm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sender: "assistant",
        text: confirmationText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    speakText(confirmationText);
  };

  const cancelPendingPantryItems = () => {
    setPendingPantryItems(null);
    const cancellationText =
      language === "bg"
        ? "Отменено. Не записах тези продукти в килера."
        : language === "es"
        ? "Cancelado. No guardé esos productos en la despensa."
        : "Cancelled. I did not save those items to the pantry.";
    onUpdateChatMessages((prev) => [
      ...prev,
      {
        id: `ai-cancel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sender: "assistant",
        text: cancellationText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isProcessing) return;

    // A new message supersedes any unconfirmed extraction. Nothing pending is persisted.
    setPendingPantryItems(null);

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    onUpdateChatMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsProcessing(true);

    try {
      const res = await fetch("/api/ai/parse-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: text,
          currentPantry: pantry,
          mealLogs,
          conversationHistory: chatMessages.slice(-6).map((m) => ({ sender: m.sender, text: m.text })),
          language,
        }),
      });

      const data = await res.json();
      const deterministicRemoval =
        !data.actionType || data.actionType === "ANSWER"
          ? parseDeterministicRemovalIntent(text, pantry)
          : null;
      const effectiveActionType = deterministicRemoval?.actionType || data.actionType;
      const effectiveItems = deterministicRemoval?.items || data.items;

      let replyText =
        data.spokenFeedback ||
        data.message ||
        (language === "bg"
          ? "Разбрах! Обработих вашето запитване."
          : language === "es"
          ? "¡Entendido! He procesado tu consulta."
          : "Got it! Processed your request.");

      if (deterministicRemoval) {
        const summary = deterministicRemoval.items
          .map((item) => `${item.quantity} ${item.unit} ${item.name}`)
          .join(", ");
        replyText =
          language === "bg"
            ? `Разбрах. Приспаднах от килера: ${summary}.`
            : language === "es"
            ? `Entendido. He descontado de tu despensa: ${summary}.`
            : `Got it. Deducted from your pantry: ${summary}.`;
      }

      // ADD_ITEMS is staged for explicit user confirmation. AI extraction is never
      // promoted directly into authoritative pantry inventory.
      const isPendingPantryAdd =
        effectiveActionType === "ADD_ITEMS" &&
        Array.isArray(effectiveItems) &&
        effectiveItems.length > 0;

      if (isPendingPantryAdd) {
        setPendingPantryItems(effectiveItems);
        replyText =
          language === "bg"
            ? "Разпознах продуктите по-долу. Проверете количеството и мерната единица и потвърдете, преди да ги запиша в килера."
            : language === "es"
            ? "He detectado los productos de abajo. Revisa la cantidad y la unidad y confirma antes de guardarlos en la despensa."
            : "I detected the items below. Review the quantity and unit, then confirm before I save them to the pantry.";
      } else if (effectiveActionType === "REMOVE_ITEMS" && Array.isArray(effectiveItems) && effectiveItems.length > 0) {
        onDeductItemsFromPantry(effectiveItems);
      } else if (
        effectiveActionType === "MEAL_LOG" &&
        data.mealLog?.nutritionVerified === true
      ) {
        onLogMeal(data.mealLog);
      } else if (effectiveActionType === "MEAL_LOG") {
        replyText =
          language === "bg"
            ? `${replyText} Не записах хранителни стойности, защото все още няма проверен източник за това изчисление.`
            : language === "es"
            ? `${replyText} No he guardado valores nutricionales porque todavía no hay una fuente verificada para ese cálculo.`
            : `${replyText} I did not save nutrition values because there is not yet a verified source for that calculation.`;
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sender: "assistant",
        text: replyText,
        actionType: isPendingPantryAdd ? undefined : effectiveActionType,
        itemsAffected: isPendingPantryAdd ? undefined : effectiveItems,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      onUpdateChatMessages((prev) => [...prev, aiMsg]);
      speakText(replyText);
    } catch (err) {
      console.error("Failed to parse intent:", err);
      const errorMsg: ChatMessage = {
        id: `ai-err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sender: "assistant",
        text:
          language === "bg"
            ? "Извинявайте, възникна малка грешка при обработката. Моля, опитайте отново."
            : language === "es"
            ? "Lo siento, he tenido un pequeño problema al procesar eso. Por favor, inténtalo de nuevo."
            : "Sorry, I had a brief issue processing that. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      onUpdateChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const samplePrompts = [
    currentText.voicePrompt1,
    currentText.voicePrompt2,
    currentText.voicePrompt3,
  ];

  return (
    <div id="voice-chef-view" className="flex flex-col flex-1 h-full min-h-0">
      {/* Mini Header - More compact for mobile */}
      <div className="flex items-center justify-between px-1 pb-3 shrink-0 border-b border-stone-800/60 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1">
            <ChefHat className="w-3.5 h-3.5 text-emerald-400" />
            {currentText.voiceTitle}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSpeechSynthesisEnabled(!speechSynthesisEnabled)}
            className={`p-1.5 rounded-lg transition-colors border ${
              speechSynthesisEnabled
                ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-400"
                : "bg-stone-900 border-stone-800 text-stone-600"
            }`}
            title={
              speechSynthesisEnabled
                ? language === "es"
                  ? "Voz activada"
                  : language === "bg"
                  ? "Гласът е включен"
                  : "Voice enabled"
                : language === "es"
                ? "Voz desactivada"
                : language === "bg"
                ? "Гласът е изключен"
                : "Voice muted"
            }
          >
            {speechSynthesisEnabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
          </button>
          
          <button
            onClick={onClearChat}
            className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-rose-400 hover:border-rose-900/50 transition-colors"
            title={language === "es" ? "Borrar conversación" : language === "bg" ? "Изчисти разговора" : "Clear conversation"}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area - Takes full remaining space */}
      <div className="flex-1 overflow-y-auto space-y-4 px-1 pr-2 no-scrollbar pb-4">
        {chatMessages.map((msg) => {
          const isAi = msg.sender === "assistant";
          return (
            <div
              key={msg.id}
              className={`flex w-full ${isAi ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`flex gap-2.5 max-w-[88%] ${
                  isAi ? "flex-row" : "flex-row-reverse"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${
                    isAi
                      ? "bg-stone-800 text-emerald-400 border border-stone-700"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  {isAi ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                {/* Bubble */}
                <div className="space-y-1">
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                      isAi
                        ? "bg-white/[0.04] border border-white/[0.08] text-white rounded-tl-none shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
                        : "bg-emerald-500 text-stone-950 font-bold rounded-tr-none shadow-[0_4px_20px_rgba(16,185,129,0.3)]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {/* Action metadata if exists */}
                    {msg.itemsAffected && msg.itemsAffected.length > 0 && (
                      <div className={`mt-2 pt-2 border-t space-y-1 ${isAi ? "border-white/[0.1]" : "border-stone-950/20"}`}>
                        <span className={`text-[9px] font-bold uppercase tracking-wider block ${isAi ? "text-emerald-400" : "text-stone-950/80"}`}>
                          {msg.actionType === "ADD_ITEMS"
                            ? language === "es"
                              ? "✓ Añadido a despensa:"
                              : language === "bg"
                              ? "✓ Добавено в килера:"
                              : "✓ Added to pantry:"
                            : language === "es"
                            ? "✓ Descontado:"
                            : language === "bg"
                            ? "✓ Извадено:"
                            : "✓ Deducted:"}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.itemsAffected.map((item, idx) => (
                            <span
                              key={idx}
                              className={`text-[10px] px-2 py-0.5 rounded-md border ${isAi ? "bg-white/[0.04] text-white border-white/[0.1]" : "bg-stone-950/10 text-stone-950 border-stone-950/20"}`}
                            >
                              {item.quantity} {item.unit} {item.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Button to jump to Recipes tab if recipe recommendation */}
                    {msg.actionType === "RECIPE_RECOMMENDATION" && (
                      <button
                        onClick={() => onNavigateToRecipes(msg.text)}
                        className="mt-2.5 w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                        {language === "es"
                          ? "Ver recetas completas paso a paso"
                          : language === "bg"
                          ? "Виж пълните рецепти стъпка по стъпка"
                          : "View step-by-step recipes"}
                      </button>
                    )}
                  </div>
                  
                  <span className={`text-[9px] block ${isAi ? "text-stone-500 text-left" : "text-stone-500 text-right"}`}>
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {pendingPantryItems && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-3">
            <div>
              <p className="text-xs font-bold text-amber-300">
                {language === "bg"
                  ? "Потвърдете преди запис"
                  : language === "es"
                  ? "Confirma antes de guardar"
                  : "Confirm before saving"}
              </p>
              <p className="text-[11px] text-stone-400 mt-1">
                {language === "bg"
                  ? "Това са данни, извлечени от AI. Нищо още не е записано в килера."
                  : language === "es"
                  ? "Estos datos han sido extraídos por IA. Todavía no se ha guardado nada en la despensa."
                  : "These values were extracted by AI. Nothing has been saved to the pantry yet."}
              </p>
            </div>

            <div className="space-y-1.5">
              {pendingPantryItems.map((item, idx) => {
                const name = item?.nameEn || item?.name || "?";
                const quantity = typeof item?.quantity === "number" ? item.quantity : "?";
                const unit = typeof item?.unit === "string" && item.unit.trim() ? item.unit : "?";
                return (
                  <div key={idx} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
                    <span className="text-xs text-white font-medium truncate">{name}</span>
                    <span className="text-xs text-amber-200 font-bold whitespace-nowrap">{quantity} {unit}</span>
                  </div>
                );
              })}
            </div>

            {!pendingPantryItemsAreComplete && (
              <p className="text-[11px] text-rose-300">
                {language === "bg"
                  ? "Липсва количество или мерна единица. Отменете и ги посочете изрично."
                  : language === "es"
                  ? "Falta cantidad o unidad. Cancela e indícalas de forma explícita."
                  : "Quantity or unit is missing. Cancel and provide it explicitly."}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelPendingPantryItems}
                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-bold text-stone-300 hover:bg-white/[0.08]"
              >
                {language === "bg" ? "Отказ" : language === "es" ? "Cancelar" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={!pendingPantryItemsAreComplete}
                onClick={confirmPendingPantryItems}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-center gap-1.5 ${
                  pendingPantryItemsAreComplete
                    ? "bg-emerald-500 text-stone-950 hover:bg-emerald-400"
                    : "bg-white/[0.04] text-stone-600 cursor-not-allowed"
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                {language === "bg" ? "Потвърди" : language === "es" ? "Confirmar" : "Confirm"}
              </button>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="flex gap-2.5 items-center">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-full px-4 py-1.5 text-[11px] text-stone-400 flex items-center gap-2 shadow-inner">
                <div className="flex gap-0.5">
                  <div className="w-1 h-1 rounded-full bg-emerald-500/80 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 h-1 rounded-full bg-emerald-500/80 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 h-1 rounded-full bg-emerald-500/80 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="font-medium tracking-wide">{currentText.aiThinking}</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="space-y-2 shrink-0 px-1 py-2 border-t border-white/[0.04]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-tight">
            {currentText.voiceTryThese}
          </span>
          <span className="text-[9px] text-stone-600 italic">
            {language === "es" ? "Toca para editar" : language === "bg" ? "Докоснете за редакция" : "Tap to edit"}
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {samplePrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputText(prompt);
                document.getElementById("voice-text-input")?.focus();
              }}
              className="text-[11px] font-medium px-3 py-1.5 rounded-xl bg-white/[0.02] hover:bg-emerald-500/10 hover:text-emerald-400 text-stone-400 border border-white/[0.04] hover:border-emerald-500/30 whitespace-nowrap transition-all"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Voice and Text Input Control Bar */}
      <div className="shrink-0 bg-[#0B0F12]/80 backdrop-blur-xl border border-white/[0.04] p-3 rounded-3xl flex items-center gap-2.5 shadow-[0_4px_30px_rgba(0,0,0,0.5)] mb-2">
        <button
          id="voice-mic-main-btn"
          onClick={toggleListening}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
            isListening
              ? "bg-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.5)]"
              : "bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          }`}
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <div className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl border transition-all relative ${
          isListening 
            ? "bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_20px_-5px_rgba(16,185,129,0.2)]" 
            : inputText.trim() 
              ? "bg-white/[0.04] border-emerald-500/30 text-white" 
              : "bg-white/[0.02] border-white/[0.04] text-stone-400"
        }`}>
          {isListening && (
            <div className="absolute -top-7 left-2 flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-extrabold text-red-400 uppercase tracking-widest">
                {language === "es" ? "Grabando..." : language === "bg" ? "Записване..." : "Recording..."}
              </span>
            </div>
          )}
          <input
            id="voice-text-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder={isListening ? currentText.voiceListening : currentText.voicePlaceholder}
            className="w-full bg-transparent text-[13px] text-white placeholder-stone-500 focus:outline-none"
          />
          {inputText && (
            <button onClick={() => setInputText("")} className="p-1.5 text-stone-500 hover:text-stone-300 rounded-lg hover:bg-white/[0.04] transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          id="voice-send-btn"
          disabled={!inputText.trim() || isProcessing}
          onClick={() => handleSend()}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
            inputText.trim() && !isProcessing
              ? "bg-emerald-500 text-stone-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              : "bg-white/[0.04] text-stone-600 border border-white/[0.02]"
          }`}
        >
          {isProcessing ? <Sparkles className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};