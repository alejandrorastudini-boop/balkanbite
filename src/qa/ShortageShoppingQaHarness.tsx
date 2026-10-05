import React, { useState } from "react";
import type { ShoppingItem } from "../types";
import { reconcileDerivedShortageShoppingItems } from "../utils/derivedShortageShopping";
import { runtimeQaDeploymentSha } from "./runtimeQaGate";

const manual: ShoppingItem = {
  id: "manual-coffee",
  name: "Coffee",
  quantity: 1,
  unit: "pack",
  category: "Other",
  checked: false,
  amountOrigin: "user_entered",
  purchaseAmountConfirmed: false,
};

const candidate = (quantity: number) => ({
  name: "Milk",
  quantity,
  unit: "l",
  category: "Dairy",
  amountOrigin: "deterministic_shortfall" as const,
  purchaseAmountConfirmed: false,
  reason: "Needed for QA plan",
});

export const ShortageShoppingQaHarness: React.FC = () => {
  const [rows, setRows] = useState<ShoppingItem[]>([manual]);
  const apply = (quantity: number | null) => {
    setRows(current =>
      reconcileDerivedShortageShoppingItems(
        current,
        quantity === null ? [] : [candidate(quantity)],
      ).next
    );
  };
  const derived = rows.find(item => item.id.startsWith("shortage-v1:"));

  return <main
    data-testid="qa-shortage-shopping-root"
    data-deployment-sha={runtimeQaDeploymentSha()}
    className="min-h-screen bg-[#0B0F12] text-white p-4"
  >
    <span data-testid="qa-shortage-count">{rows.filter(item => item.id.startsWith("shortage-v1:")).length}</span>
    <span data-testid="qa-shortage-quantity">{derived?.quantity ?? "none"}</span>
    <span data-testid="qa-manual-count">{rows.filter(item => item.id === manual.id).length}</span>
    <span data-testid="qa-purchase-confirmed">{String(derived?.purchaseAmountConfirmed ?? false)}</span>
    <button type="button" onClick={() => apply(1)}>Set shortage 1L</button>
    <button type="button" onClick={() => apply(0.5)}>Update shortage 0.5L</button>
    <button type="button" onClick={() => apply(null)}>Resolve shortage</button>
  </main>;
};
