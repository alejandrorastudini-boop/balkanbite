import React, { useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { Language, PantryItem } from "../types";
import type { CookLotEvidencePlan } from "../utils/cookLotEvidencePlanner";
import type { CookLotReviewAllocation, CookLotReviewSelection } from "../utils/cookLotEvidenceAdapter";

interface Props {
  plan: CookLotEvidencePlan;
  pantry: readonly PantryItem[];
  language: Language;
  onClose: () => void;
  onConfirm: (selections: CookLotReviewSelection) => boolean | Promise<boolean>;
}

export const CookLotReviewModal: React.FC<Props> = ({ plan, pantry, language, onClose, onConfirm }) => {
  const [selections, setSelections] = useState<Record<string, string | "unknown" | CookLotReviewAllocation>>({});
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  if (plan.outcome !== "review") return null;

  const text = language === "es"
    ? { title: "¿De qué compra usaste cada alimento?", help: "Indica la cantidad usada de cada compra. No repartimos nada automáticamente. Si no lo sabes, mantendremos el consumo sin inventar el lote.", unknown: "No lo sé", bought: "Comprado", remaining: "Quedaban", expires: "Caduca", used: "Usado", cancel: "Cancelar", confirm: "Confirmar consumo" }
    : language === "bg"
    ? { title: "От коя покупка използвахте всеки продукт?", help: "Посочете използваното количество от всяка покупка. Не разпределяме автоматично. Ако не знаете, ще запазим консумацията без измислена партида.", unknown: "Не знам", bought: "Купено", remaining: "Оставаха", expires: "Годно до", used: "Използвано", cancel: "Отказ", confirm: "Потвърди консумацията" }
    : { title: "Which purchase did you use for each food?", help: "Choose a purchase only if you recognize it. If you do not know, we will keep the consumption without inventing a lot.", unknown: "I don't know", bought: "Bought", remaining: "Remaining", expires: "Expires", cancel: "Cancel", confirm: "Confirm consumption" };

  const complete = plan.prompts.every(prompt => selections[prompt.pantryItemId] !== undefined);
  const closeIfIdle = () => { if (!busyRef.current) onClose(); };
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={closeIfIdle} aria-busy={busy}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-stone-900 border border-stone-700/80 rounded-2xl p-5 shadow-2xl space-y-4 relative" onClick={event => event.stopPropagation()}>
        <button type="button" onClick={closeIfIdle} disabled={busy} aria-label={text.cancel} className="absolute top-4 right-4 p-1 text-stone-400 hover:text-white disabled:opacity-40"><X className="w-4 h-4" /></button>
        <div className="flex gap-3 pr-7">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/15 text-amber-400 border border-amber-500/30"><AlertTriangle className="w-5 h-5" /></div>
          <div><h3 className="text-sm font-bold text-white">{text.title}</h3><p className="text-xs text-stone-300 leading-relaxed mt-1">{text.help}</p></div>
        </div>
        <div className="space-y-3">
          {plan.prompts.map(prompt => (
            <fieldset key={prompt.pantryItemId} className="space-y-2 border border-white/[0.08] rounded-2xl p-3">
              <legend className="px-1 text-sm font-bold text-white">{labelFor(prompt.pantryItemId)} · {prompt.requiredQuantity} {prompt.unit}</legend>
              {prompt.choices.map(choice => {
                const selected = selections[prompt.pantryItemId];
                const allocation = typeof selected === "object" && selected ? selected : {};
                return (
                  <label key={choice.lotId} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="flex-1 text-xs text-stone-300"><strong className="text-stone-100">{text.bought}:</strong> {choice.acquiredAt.slice(0, 10)} · <strong className="text-stone-100">{text.remaining}:</strong> {choice.remainingQuantity} {choice.unit}{choice.expiresOn ? <> · <strong className="text-stone-100">{text.expires}:</strong> {choice.expiresOn}</> : null}</span>
                    <span className="flex items-center gap-1.5 text-xs text-stone-300">
                      <span>{text.used}</span>
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
                            const next = typeof previous === "object" && previous ? { ...previous } : {};
                            if (raw === "") delete next[choice.lotId];
                            else next[choice.lotId] = Number(raw);
                            return { ...current, [prompt.pantryItemId]: next };
                          });
                        }}
                        className="w-20 rounded-lg bg-stone-950 border border-stone-700 px-2 py-1.5 text-right text-white"
                        aria-label={`${text.used} ${choice.acquiredAt.slice(0, 10)}`}
                      />
                      <span>{choice.unit}</span>
                    </span>
                  </label>
                );
              })}
              <label className="flex gap-3 p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 cursor-pointer">
                <input type="radio" name={`cook-lot-${prompt.pantryItemId}`} checked={selections[prompt.pantryItemId] === "unknown"} onChange={() => setSelections(current => ({ ...current, [prompt.pantryItemId]: "unknown" }))} className="mt-0.5" />
                <span className="text-xs font-semibold text-amber-200">{text.unknown}</span>
              </label>
            </fieldset>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={closeIfIdle} disabled={busy} className="flex-1 py-2.5 px-3 rounded-xl bg-stone-800 text-stone-300 text-xs font-semibold border border-stone-700 disabled:opacity-40">{text.cancel}</button>
          <button type="button" onClick={() => void confirm()} disabled={!complete || busy} className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed">{text.confirm}</button>
        </div>
      </div>
    </div>
  );
};
