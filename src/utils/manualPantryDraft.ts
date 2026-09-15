export type ManualPantryDraft = {
  name: string;
  quantity: string;
  unit: string;
  category: string;
  expiryDate: string;
  cost: string;
};

export const createEmptyManualPantryDraft = (): ManualPantryDraft => ({
  name: "",
  quantity: "",
  unit: "",
  category: "",
  expiryDate: "", // Optional: unknown expiry remains blank.
  cost: "",
});

export const hasRequiredManualPantryFields = (
  draft: ManualPantryDraft,
): boolean =>
  draft.name.trim().length > 0 &&
  draft.quantity.trim().length > 0 &&
  Number.isFinite(Number(draft.quantity)) &&
  Number(draft.quantity) > 0 &&
  draft.unit.trim().length > 0 &&
  (draft.cost.trim().length === 0 ||
    (Number.isFinite(Number(draft.cost)) && Number(draft.cost) >= 0));
