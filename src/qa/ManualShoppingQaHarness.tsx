import React, { useState } from "react";
import { ShoppingView } from "../components/ShoppingView";
import type { ShoppingItem } from "../types";
import {
  runtimeQaDeploymentId,
  runtimeQaDeploymentSha,
  runtimeQaSourceFingerprint,
} from "./runtimeQaGate";

export const ManualShoppingQaHarness: React.FC = () => {
  const [items, setItems] = useState<ShoppingItem[]>([]);

  return (
    <main
      data-testid="qa-manual-shopping-root"
      data-deployment-sha={runtimeQaDeploymentSha()}
      data-deployment-id={runtimeQaDeploymentId()}
      data-source-fingerprint={runtimeQaSourceFingerprint()}
      className="min-h-screen bg-[#0B0F12] text-stone-100"
    >
      <span data-testid="qa-manual-shopping-count" className="sr-only">
        {String(items.length)}
      </span>
      <span data-testid="qa-manual-shopping-last-quantity" className="sr-only">
        {items.length > 0 ? String(items.at(-1)?.quantity ?? "") : ""}
      </span>
      <span data-testid="qa-manual-shopping-last-unit" className="sr-only">
        {items.at(-1)?.unit ?? ""}
      </span>
      <span data-testid="qa-manual-shopping-last-category" className="sr-only">
        {items.at(-1)?.category ?? ""}
      </span>

      <ShoppingView
        shoppingList={items}
        onToggleItem={(id) =>
          setItems((current) =>
            current.map((item) =>
              item.id === id ? { ...item, checked: !item.checked } : item,
            ),
          )
        }
        onDeleteItem={(id) =>
          setItems((current) => current.filter((item) => item.id !== id))
        }
        onAddItem={(item) =>
          setItems((current) => [
            ...current,
            {
              ...item,
              id: `qa-shopping-${current.length + 1}`,
              checked: false,
            },
          ])
        }
        onTransferToPantry={() => {}}
        onGenerateAiShopping={async () => {}}
        onClearList={() => setItems([])}
        isLoadingAi={false}
        language="en"
        currency="EUR"
      />
    </main>
  );
};
