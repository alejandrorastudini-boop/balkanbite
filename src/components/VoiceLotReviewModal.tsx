import React, { useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { Language, PantryItem } from "../types";
import type { VoiceLotReviewPlan } from "../utils/voiceLotReviewPlanner";
import type {
  VoiceLotReviewAllocation,
  VoiceLotReviewSelection,
} from "../utils/voiceLotEvidenceAdapter";

interface Props {
  plan: VoiceLotReviewPlan;
  pantry: readonly PantryItem[];
  language: Language;
  onClose: () => void;
  onConfirm: (selections: VoiceLotReviewSelection) => boolean | Promise<boolean>;
}

export const VoiceLotReviewModal: React.FC<Props> = ({
  plan,
  pantry,
  language,
  onClose,
  onConfirm,
}) => {
  const [selections, setSelections] = useState<
    Record<string, string | "unknown" | VoiceLotReviewAllocation>
  >({});
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  if (plan.outcome !== "review") return null;

  const purpose = plan.prompts[0]?.purpose;
  const text = language === "es"
    ? {
        title: purpose === "discard"
          ? "¿De qué compra tiraste cada alimento?"
          : "¿De qué compra usaste cada alimento?",
        help: "Indica la cantidad real de cada compra. BalkanBite no reparte lotes automáticamente. Si no lo sabes, mantendremos el descuento sin inventar procedencia.",
        unknown: "No lo sé",
        bought: "Comprado",
        remaining: "Quedaban",
        expires: "Caduca",
        expired: "Caducado",
        amount: purpose === "discard" ? "Tirado" : "Usado",
        cancel: "Cancelar",
        confirm: purpose === "discard" ? "Confirmar descarte" : "Confirmar uso",
      }
    : language === "bg"
    ? {
        title: purpose === "discard"
          ? "От коя покупка изхвърлихте всеки продукт?"
          : "От коя покупка използвахте всеки продукт?",
        help: "Посочете реалното количество от всяка покупка. BalkanBite не разпределя партиди автоматично. Ако не знаете, ще запазим приспадането без измислен произход.",
        unknown: "Не знам",
        bought: "Купено",
        remaining: "Оставаха",
        expires: "Годно до",
        expired: "Изтекъл срок",
        amount: purpose === "discard" ? "Изхвърлено" : "Използвано",
        cancel: "Отказ",
        confirm: purpose === "discard" ? "Потвърди изхвърлянето" : "Потвърди използването",
      }
    : {
        title: purpose === "discard"
          ? "Which purchase did you discard each food from?"
          : "Which purchase did you use for each food?",
        help: "Enter the real amount from each purchase. BalkanBite never splits lots automatically. If you do not know, we will keep the deduction without inventing provenance.",
        unknown: "I don't know",
        bought: "Bought",
        remaining: "Remaining",
        expires: "Expires",
        expired: "Expired",
        amount: purpose === "discard" ? "Discarded" : "Used",
        cancel: "Cancel",
        confirm: purpose === "discard" ? "Confirm discard" : "Confirm use",
      };

  const allocationTotal = (pantryItemId: string) => {
    const selection = selections[pantryItemId];
    if (!selection || typeof selection !== "object") return 0;
    return Object.values(selection as VoiceLotReviewAllocation).reduce<number>(
      (sum, quantity) => sum + (Number.isFinite(quantity) ? quantity : 0),
      0,
    );
  };

  const complete = plan.prompts.every(prompt => {
    const selection = selections[prompt.pantryItemId];
    if (selection === "unknown") return true;
    if (!selection || typeof selection !== "object") return false;
    return Math.abs(allocationTotal(prompt.pantryItemId) - prompt.requiredQuantity) <= 1e-9;
  });

  const closeIfIdle = () => {
    if (!busyRef.current) onClose();
  };

  const confirm = async () => {
    if (!complete || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (await onConfirm(selections)) onClose();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const labelFor = (id: string) => {
    const item = pantry.find(candidate => candidate.id === id);
    if (!item) return id;
    if (language === "bg" && item.nameBg) return item.nameBg;
    if (language === "es" && item.nameEs) return item.nameEs;
    return item.name;
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={closeIfIdle}
      aria-busy={busy}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-stone-900 border border-stone-700/80 rounded-2xl p-5 shadow-2xl space-y-4 relative"
        onClick={event => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeIfIdle}
          disabled={busy}
          aria-label={text.cancel}
          className="absolute top-4 right-4 p-1 text-stone-400 hover:text-white disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex gap-3 pr-7">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{text.title}</h3>
            <p className="text-xs text-stone-300 leading-relaxed mt-1">{text.help}</p>
          </div>
        </div>

        <div className="space-y-3">
          {plan.prompts.map(prompt => (
            <fieldset
              key={prompt.pantryItemId}
              className="space-y-2 border border-white/[0.08] rounded-2xl p-3"
            >
              <legend className="px-1 text-sm font-bold text-white">
                {labelFor(prompt.pantryItemId)} · {prompt.requiredQuantity} {prompt.unit}
              </legend>
              <p className="text-[11px] text-stone-400">
                {typeof selections[prompt.pantryItemId] === "object"
                  ? allocationTotal(prompt.pantryItemId)
                  : 0} / {prompt.requiredQuantity} {prompt.unit}
              </p>

              {prompt.choices.map(choice => {
                const selected = selections[prompt.pantryItemId];
                const allocation =
                  typeof selected === "object" && selected ? selected : {};
                return (
                  <label
                    key={choice.lotId}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                  >
                    <span className="flex-1 text-xs text-stone-300">
                      <strong className="text-stone-100">{text.bought}:</strong>{" "}
                      {choice.acquiredAt.slice(0, 10)} ·{" "}
                      <strong className="text-stone-100">{text.remaining}:</strong>{" "}
                      {choice.remainingQuantity} {choice.unit}
                      {choice.expiresOn ? (
                        <> · <strong className="text-stone-100">{text.expires}:</strong>{" "}
                        {choice.expiresOn}</>
                      ) : null}
                      {choice.expired ? (
                        <span className="ml-1.5 font-bold text-rose-300">
                          · {text.expired}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-stone-300">
                      <span>{text.amount}</span>
                      <input
                        type="number"
                        min="0"
                        max={choice.remainingQuantity}
                        step="any"
                        inputMode="decimal"
                        value={allocation[choice.lotId] ?? ""}
                        onChange={event => {
                          const raw = event.target.value;
                          setSelections(current => {
                            const previous = current[prompt.pantryItemId];
                            const next =
                              typeof previous === "object" && previous
                                ? { ...previous }
                                : {};
                            if (raw === "") delete next[choice.lotId];
                            else next[choice.lotId] = Number(raw);
                            return { ...current, [prompt.pantryItemId]: next };
                          });
                        }}
                        className="w-20 rounded-lg bg-stone-950 border border-stone-700 px-2 py-1.5 text-right text-white"
                        aria-label={`${text.amount} ${choice.acquiredAt.slice(0, 10)}`}
                      />
                      <span>{choice.unit}</span>
                    </span>
                  </label>
                );
              })}

              <label className="flex gap-3 p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 cursor-pointer">
                <input
                  type="radio"
                  name={`voice-lot-${prompt.pantryItemId}`}
                  checked={selections[prompt.pantryItemId] === "unknown"}
                  onChange={() =>
                    setSelections(current => ({
                      ...current,
                      [prompt.pantryItemId]: "unknown",
                    }))
                  }
                  className="mt-0.5"
                />
                <span className="text-xs font-semibold text-amber-200">{text.unknown}</span>
              </label>
            </fieldset>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={closeIfIdle}
            disabled={busy}
            className="flex-1 py-2.5 px-3 rounded-xl bg-stone-800 text-stone-300 text-xs font-semibold border border-stone-700 disabled:opacity-40"
          >
            {text.cancel}
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={!complete || busy}
            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {text.confirm}
          </button>
        </div>
      </div>
    </div>
  );
};
