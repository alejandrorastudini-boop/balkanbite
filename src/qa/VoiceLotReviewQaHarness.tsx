import React, { useRef, useState } from "react";
import { VoiceLotReviewModal } from "../components/VoiceLotReviewModal";
import type { PantryItem } from "../types";
import { buildVoiceLotEvidence, type VoiceLotReviewSelection } from "../utils/voiceLotEvidenceAdapter";
import { planVoiceLotReview, type VoiceLotReviewPlan } from "../utils/voiceLotReviewPlanner";
import type { DeterministicRemovalPurpose } from "../utils/deterministicRemovalIntent";
import { runtimeQaDeploymentSha } from "./runtimeQaGate";

const reviewedOn = "2026-10-05";
const pantry: PantryItem[] = [{
  id: "qa-rice",
  name: "QA Rice",
  quantity: 1,
  unit: "kg",
  category: "Pantry/Grains",
  addedAt: "2026-10-01",
  lotState: {
    version: 1,
    unallocatedQuantity: 0,
    activeLots: [
      { id: "lot-a", source: "shopping_list", sourceId: "a", acquiredAt: "2026-10-01", initialQuantity: 0.4, remainingQuantity: 0.4, expiryDaysAtAcquisition: 30 },
      { id: "lot-b", source: "shopping_list", sourceId: "b", acquiredAt: "2026-10-02", initialQuantity: 0.6, remainingQuantity: 0.6, expiryDaysAtAcquisition: 30 },
    ],
  },
}, {
  id: "qa-yogurt",
  name: "QA Yogurt",
  quantity: 0.5,
  unit: "kg",
  category: "Dairy",
  addedAt: "2026-09-20",
  lotState: {
    version: 1,
    unallocatedQuantity: 0,
    activeLots: [
      { id: "lot-expired", source: "shopping_list", sourceId: "c", acquiredAt: "2026-09-20", initialQuantity: 0.5, remainingQuantity: 0.5, expiryDaysAtAcquisition: 5 },
    ],
  },
}];

function planFor(purpose: DeterministicRemovalPurpose): VoiceLotReviewPlan {
  const item = purpose === "discard" ? pantry[1] : pantry[0];
  const quantity = purpose === "discard" ? 0.2 : 0.7;
  return planVoiceLotReview(pantry, [{
    pantryItemId: item.id,
    ingredientName: item.name,
    consumedQuantity: quantity,
    unit: "kg",
  }], purpose, reviewedOn);
}

export const VoiceLotReviewQaHarness: React.FC = () => {
  const [purpose, setPurpose] = useState<DeterministicRemovalPurpose>("food-use");
  const [open, setOpen] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [successes, setSuccesses] = useState(0);
  const [lastOutcome, setLastOutcome] = useState("none");
  const [lastEvidence, setLastEvidence] = useState("none");
  const busyRef = useRef(false);
  const plan = planFor(purpose);

  const confirm = async (selections: VoiceLotReviewSelection) => {
    if (busyRef.current || plan.outcome !== "review") return false;
    busyRef.current = true;
    setAttempts(value => value + 1);
    setLastOutcome("pending");
    const built = buildVoiceLotEvidence(plan, selections, purpose, reviewedOn);
    setLastEvidence(built.outcome === "exact"
      ? JSON.stringify(built.lotEvidence)
      : built.outcome);
    await new Promise(resolve => setTimeout(resolve, 180));
    const ok = built.outcome === "exact" || built.outcome === "aggregate";
    if (ok) {
      setSuccesses(value => value + 1);
      setLastOutcome(built.outcome);
    } else {
      setLastOutcome("invalid");
    }
    busyRef.current = false;
    return ok;
  };

  return <main data-testid="qa-voice-lot-root" data-deployment-sha={runtimeQaDeploymentSha()} className="min-h-screen bg-[#0B0F12] text-white p-4">
    <span data-testid="qa-voice-lot-attempts" className="sr-only">{attempts}</span>
    <span data-testid="qa-voice-lot-successes" className="sr-only">{successes}</span>
    <span data-testid="qa-voice-lot-outcome" className="sr-only">{lastOutcome}</span>
    <span data-testid="qa-voice-lot-evidence" className="sr-only">{lastEvidence}</span>
    <button type="button" onClick={() => { setPurpose("food-use"); setOpen(true); }}>Review food use</button>
    <button type="button" onClick={() => { setPurpose("discard"); setOpen(true); }}>Review discard</button>
    {open && plan.outcome === "review" ? <VoiceLotReviewModal
      plan={plan}
      pantry={pantry}
      language="en"
      onClose={() => setOpen(false)}
      onConfirm={confirm}
    /> : null}
  </main>;
};
