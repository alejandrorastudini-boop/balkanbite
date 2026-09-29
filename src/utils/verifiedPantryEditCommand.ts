import type {
  InventoryAdjustment,
  InventoryAdjustmentOutcome,
  VerifiedStockExpectation,
} from "./inventoryAdjustmentFirestore";
import {
  capturePantryEditIntent,
  type InventoryEditAuthority,
  type ViewedPantryLot,
} from "./pantryEditIntentCapture";

/**
 * Candidate event-time command boundary, deliberately NOT connected to App.
 * The old useFirebaseSync all-row inventory writer must be retired or
 * coordinated before this command may mutate the signed-in live UI.
 *
 * The caller must provide real server-verified snapshot evidence and the
 * actual user-visible lot from the instant the user initiates an edit.
 */
export interface VerifiedPantryEditCommand {
  authority: InventoryEditAuthority;
  viewed: ViewedPantryLot;
  adjustment: InventoryAdjustment;
  getCurrentUserId: () => string | null;
  persist: (
    userId: string,
    expected: VerifiedStockExpectation,
    adjustment: InventoryAdjustment,
  ) => Promise<InventoryAdjustmentOutcome>;
}

export type VerifiedPantryEditCommandResult =
  | InventoryAdjustmentOutcome
  | {
      outcome: "needs-review";
      reason: "unverified-authority" | "missing-stock" | "stale-local-view" |
        "account-changed";
    };

const validQuantity = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/**
 * An edit can only proceed with the exact quantity, unit and revision that
 * were in the verified owner snapshot AND still visible at click time.
 * No fallback to an unverified local row or a newer substituted baseline.
 * The actual persister must independently re-read/validate server stock in
 * its Firestore transaction and rely on Firestore rules for authorization.
 */
export async function submitVerifiedPantryEdit(
  command: VerifiedPantryEditCommand,
): Promise<VerifiedPantryEditCommandResult> {
  const userId = command.getCurrentUserId();
  if (!userId) {
    return { outcome: "needs-review", reason: "unverified-authority" };
  }
  const captured = capturePantryEditIntent(
    command.authority, userId, command.viewed,
  );
  if (captured.outcome !== "captured") {
    return { outcome: "needs-review", reason: captured.reason };
  }

  const adjustment = command.adjustment;
  if (!adjustment || (
    adjustment.kind !== "remove" && adjustment.kind !== "set-quantity"
  ) || (
    adjustment.kind === "set-quantity" && !validQuantity(adjustment.quantity)
  )) {
    return { outcome: "needs-review", reason: "invalid-request" };
  }
  if (adjustment.kind === "set-quantity" &&
      adjustment.quantity === captured.observedBeforeEdit.quantity) {
    return { outcome: "needs-review", reason: "no-change" };
  }

  // Auth may change between rendering the edit control and dispatching the
  // command. Abort before ever starting a write if the session did change.
  if (command.getCurrentUserId() !== userId) {
    return { outcome: "needs-review", reason: "account-changed" };
  }

  // This asynchronous operation may still be invalidated by a later logout;
  // the persister and Firestore rules must enforce ownership again at commit.
  // Errors (including offline/permission failures) propagate to the caller:
  // do not return "updated" unless the transaction actually commits.
  return command.persist(
    userId, { ...captured.observedBeforeEdit }, adjustment,
  );
}
