import type { Language, MealPlanDay, PantryItem, Recipe, ShoppingItem } from "../types";
import { GUEST_PANTRY_KEY, inspectGuestPantry, writeGuestPantrySafely } from "./guestPantry";
import type { CookIntentStorage } from "./guestConfirmedCookIntent";
import {
  hasPendingGuestMutationJournal,
  hasConflictingGuestMutationJournal,
} from "./guestJournalExclusivity";
import {
  deductVoiceItemsFromPantry,
  type VoiceRemovalItem,
} from "./pantryConsumption";
import type { DeterministicRemovalPurpose } from "./deterministicRemovalIntent";
import { syncRecipesWithPantry } from "./menuAutoPlanner";
import { evaluateShoppingNeeds } from "./shoppingAdvisor";
import { reconcileDerivedShortageShoppingItems } from "./derivedShortageShopping";
import { isValidProgressionTimestamp } from "./progressionLedger";
import { parseStoredRecipeCache } from "./storedRecipeValidation";
import { parseStoredMealPlanCache } from "./storedMealPlanValidation";
import { parseStoredShoppingCache } from "./storedShoppingValidation";

export const GUEST_VOICE_INTENT_KEY = "balkanbite_guest_voice_removal_intent_v1";
export const GUEST_VOICE_RECEIPTS_KEY = "balkanbite_guest_voice_removal_receipts_v1";
const RECIPES = "balkanbite_recipes";
const PLAN = "balkanbite_mealplan";
const SHOPPING = "balkanbite_shopping";
const KEYS = [GUEST_PANTRY_KEY, RECIPES, PLAN, SHOPPING, GUEST_VOICE_RECEIPTS_KEY] as const;
type Snapshots = [string, string, string, string, string];

interface VoiceRemoval {
  name: string;
  quantity: number;
  unit: string;
}
export interface VoiceRemovalReceipt {
  version: 1;
  mutationId: string;
  purpose: DeterministicRemovalPurpose;
  items: VoiceRemoval[];
}
interface GuestVoiceIntentV1 {
  version: 1;
  mutationId: string;
  purpose: DeterministicRemovalPurpose;
  occurredAt: string;
  language: Language;
  items: VoiceRemoval[];
  before: Snapshots;
  after: Snapshots;
}
export interface GuestVoiceCommand {
  mutationId: string;
  purpose: DeterministicRemovalPurpose;
  occurredAt: string;
  language: Language;
  items: readonly VoiceRemovalItem[];
  expectedPantry: readonly PantryItem[];
  expectedRecipes: readonly Recipe[];
  expectedPlan: readonly MealPlanDay[];
  expectedShopping: readonly ShoppingItem[];
  nextPlan: readonly MealPlanDay[];
  nextRecipes: readonly Recipe[];
  nextShopping: readonly ShoppingItem[];
}
export type GuestVoiceWrite =
  | { status: "saved" | "saved-pending-cleanup" | "already-applied" }
  | { status: "blocked"; reason:
      "unresolved-intent" | "invalid-input" | "mutation-conflict" |
      "stale-snapshot" | "storage-unavailable" | "pantry-write-failed" |
      "derived-write-failed" };
export type GuestVoiceRecovery =
  | { status: "none" | "unapplied" | "already-complete" | "completed-derived-writes" }
  | { status: "blocked"; reason: "invalid-intent" | "conflict" | "storage-unavailable" };

const idOk = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const purposeOk = (v: unknown): v is DeterministicRemovalPurpose =>
  v === "food-use" || v === "discard";
const languageOk = (v: unknown): v is Language =>
  v === "en" || v === "es" || v === "bg";

function normalizeItems(values: readonly VoiceRemovalItem[]): VoiceRemoval[] | null {
  if (!Array.isArray(values) || values.length === 0 || values.length > 60) return null;
  const parsed: VoiceRemoval[] = [];
  for (const item of values) {
    if (!item || typeof item !== "object" ||
        typeof item.name !== "string" || !item.name.trim() ||
        typeof item.unit !== "string" || !item.unit.trim()) return null;
    const quantity = typeof item.quantity === "number"
      ? item.quantity
      : typeof item.quantity === "string" && item.quantity.trim()
      ? Number(item.quantity) : NaN;
    if (!Number.isFinite(quantity) || quantity <= 0) return null;
    parsed.push({ name: item.name.trim(), quantity, unit: item.unit.trim() });
  }
  return parsed;
}
function arrayExactly<T>(raw: string, parse: (s: string) => T[] | null): T[] | null {
  try {
    const original: unknown = JSON.parse(raw);
    if (!Array.isArray(original)) return null;
    const accepted = parse(raw);
    return accepted && accepted.length === original.length ? accepted : null;
  } catch { return null; }
}
function validPantry(raw: string): PantryItem[] | null {
  return arrayExactly(raw, value => {
    const checked = inspectGuestPantry(value);
    return checked.requiresRecovery ? null : checked.items;
  });
}
function validRecipes(raw: string): Recipe[] | null {
  const items = arrayExactly(raw, parseStoredRecipeCache);
  return items && new Set(items.map(x => x.id)).size === items.length ? items : null;
}
function validPlan(raw: string): MealPlanDay[] | null {
  return arrayExactly(raw, parseStoredMealPlanCache);
}
function validShopping(raw: string): ShoppingItem[] | null {
  const items = arrayExactly(raw, parseStoredShoppingCache);
  return items && new Set(items.map(x => x.id)).size === items.length ? items : null;
}
function receiptOk(x: unknown): x is VoiceRemovalReceipt {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const r = x as Record<string, unknown>;
  return Object.keys(r).length === 4 && r.version === 1 &&
    idOk(r.mutationId) && purposeOk(r.purpose) &&
    Array.isArray(r.items) && r.items.length > 0 &&
    normalizeItems(r.items) !== null &&
    JSON.stringify(normalizeItems(r.items)) === JSON.stringify(r.items);
}
export function parseGuestVoiceReceipts(raw: string | null): VoiceRemovalReceipt[] | null {
  if (raw === null) return null;
  try {
    const result: unknown = JSON.parse(raw);
    if (!Array.isArray(result) || result.length > 10000 || !result.every(receiptOk)) return null;
    const receiptArray = result as VoiceRemovalReceipt[];
    return new Set(receiptArray.map(x => x.mutationId)).size === receiptArray.length
      ? receiptArray : null;
  } catch { return null; }
}
function validSnapshots(raw: readonly string[]): boolean {
  return raw.length === 5 && validPantry(raw[0]) !== null &&
    validRecipes(raw[1]) !== null && validPlan(raw[2]) !== null &&
    validShopping(raw[3]) !== null && parseGuestVoiceReceipts(raw[4]) !== null;
}
function derive(
  before: Snapshots,
  cmd: Pick<GuestVoiceIntentV1,"mutationId"|"purpose"|"occurredAt"|"language"|"items">,
  nextPlan: MealPlanDay[],
): Snapshots | null {
  if (!idOk(cmd.mutationId) || !purposeOk(cmd.purpose) ||
      !languageOk(cmd.language) || !isValidProgressionTimestamp(cmd.occurredAt) ||
      !validSnapshots(before) || validPlan(JSON.stringify(nextPlan)) === null) return null;
  const prior = parseGuestVoiceReceipts(before[4])!;
  if (prior.some(r => r.mutationId === cmd.mutationId)) return null;
  const normalized = normalizeItems(cmd.items);
  if (!normalized || JSON.stringify(normalized) !== JSON.stringify(cmd.items)) return null;
  const deducted = deductVoiceItemsFromPantry(
    validPantry(before[0])!, normalized, new Date(cmd.occurredAt),
  );
  if (deducted.issues.length !== 0 || deducted.deductions.length === 0 ||
      !validPantry(JSON.stringify(deducted.pantry))) return null;
  const nextRecipes = syncRecipesWithPantry(
    validRecipes(before[1])!, deducted.pantry, new Date(cmd.occurredAt),
  );
  const nextShopping = reconcileDerivedShortageShoppingItems(
    validShopping(before[3])!,
    evaluateShoppingNeeds(
      deducted.pantry, nextPlan, validShopping(before[3])!, cmd.language,
      new Date(cmd.occurredAt),
    ).itemsToAddToShoppingList,
  ).next;
  const receipt: VoiceRemovalReceipt = {
    version: 1, mutationId: cmd.mutationId, purpose: cmd.purpose, items: normalized,
  };
  const after: Snapshots = [
    JSON.stringify(deducted.pantry),
    JSON.stringify(nextRecipes),
    JSON.stringify(nextPlan),
    JSON.stringify(nextShopping),
    JSON.stringify([...prior, receipt]),
  ];
  return after[0] !== before[0] && validSnapshots(after) ? after : null;
}
function validateIntent(raw: string): GuestVoiceIntentV1 | null {
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const r = v as Record<string, unknown>;
    const keys = ["version", "mutationId", "purpose", "occurredAt", "language", "items", "before", "after"];
    if (Object.keys(r).length !== keys.length || keys.some(key => !(key in r)) ||
      r.version !== 1 || !idOk(r.mutationId) || !purposeOk(r.purpose) ||
      !languageOk(r.language) || !isValidProgressionTimestamp(r.occurredAt) ||
      !Array.isArray(r.before) || !Array.isArray(r.after) ||
      r.before.length !== 5 || r.after.length !== 5 ||
      !r.before.every(x => typeof x === "string") ||
      !r.after.every(x => typeof x === "string") ||
      !Array.isArray(r.items)) return null;
    const intent = v as GuestVoiceIntentV1;
    const plan = validPlan(intent.after[2]);
    if (!plan) return null;
    const recomputed = derive(intent.before, intent, plan);
    return recomputed && JSON.stringify(recomputed) === JSON.stringify(intent.after)
      ? intent : null;
  } catch { return null; }
}
function cleanup(storage: CookIntentStorage, raw: string): boolean {
  if (storage.getItem(GUEST_VOICE_INTENT_KEY) !== raw) return false;
  storage.removeItem(GUEST_VOICE_INTENT_KEY);
  return storage.getItem(GUEST_VOICE_INTENT_KEY) === null;
}
/**
 * A confirmed user voice action is an inventory removal, NOT automatically a
 * meal/nutrition or progression event. The receipt is only idempotency proof.
 * LocalStorage checks are best-effort, not a cross-tab atomic mutex.
 */
export function commitGuestVoiceRemoval(
  storage: CookIntentStorage,
  command: GuestVoiceCommand,
): GuestVoiceWrite {
  try {
    if (hasPendingGuestMutationJournal(storage))
      return { status: "blocked", reason: "unresolved-intent" };
    const normalized = normalizeItems(command.items);
    if (!idOk(command.mutationId) || !purposeOk(command.purpose) ||
        !languageOk(command.language) ||
        !isValidProgressionTimestamp(command.occurredAt) || !normalized)
      return { status: "blocked", reason: "invalid-input" };
    const existingReceipt = storage.getItem(GUEST_VOICE_RECEIPTS_KEY);
    // New internal metadata may be initialized to an empty list, but historical
    // invalid metadata may NEVER be replaced by a fabricated clean list.
    if (existingReceipt === null) {
      storage.setItem(GUEST_VOICE_RECEIPTS_KEY, "[]");
      if (storage.getItem(GUEST_VOICE_RECEIPTS_KEY) !== "[]")
        return { status: "blocked", reason: "storage-unavailable" };
    }
    const previousReceipts = parseGuestVoiceReceipts(storage.getItem(GUEST_VOICE_RECEIPTS_KEY));
    if (!previousReceipts) return { status: "blocked", reason: "invalid-input" };
    const receipt = previousReceipts.find(r => r.mutationId === command.mutationId);
    if (receipt) return receipt.purpose === command.purpose &&
      JSON.stringify(receipt.items) === JSON.stringify(normalized)
      ? { status: "already-applied" }
      : { status: "blocked", reason: "mutation-conflict" };
    const retrieved = KEYS.map(key => storage.getItem(key));
    if (retrieved.some(x => x === null)) return { status: "blocked", reason: "invalid-input" };
    const before = retrieved as Snapshots;
    if (!validSnapshots(before)) return { status: "blocked", reason: "invalid-input" };
    const expected = [
      command.expectedPantry, command.expectedRecipes, command.expectedPlan,
      command.expectedShopping,
    ].map(x => JSON.stringify(x));
    if (JSON.stringify(before.slice(0,4)) !== JSON.stringify(expected))
      return { status: "blocked", reason: "stale-snapshot" };
    const after = derive(before, { ...command, items: normalized }, [...command.nextPlan]);
    if (!after || after[1] !== JSON.stringify(command.nextRecipes) ||
        after[3] !== JSON.stringify(command.nextShopping))
      return { status: "blocked", reason: "invalid-input" };
    const entry: GuestVoiceIntentV1 = {
      version: 1, mutationId: command.mutationId, purpose: command.purpose,
      occurredAt: command.occurredAt, language: command.language,
      items: normalized, before, after,
    };
    const raw = JSON.stringify(entry);
    storage.setItem(GUEST_VOICE_INTENT_KEY, raw);
    if (storage.getItem(GUEST_VOICE_INTENT_KEY) !== raw)
      return { status: "blocked", reason: "storage-unavailable" };
    const commit = writeGuestPantrySafely(
      storage, JSON.parse(after[0]) as PantryItem[], command.expectedPantry,
    );
    if (!commit.saved) return { status: "blocked", reason: "pantry-write-failed" };
    for (let i=1;i<KEYS.length;i++) {
      if (storage.getItem(GUEST_VOICE_INTENT_KEY) !== raw ||
          KEYS.some((key,index) =>
            storage.getItem(key) !== (index < i ? after[index] : before[index])))
        return { status: "blocked", reason: "stale-snapshot" };
      storage.setItem(KEYS[i], after[i]);
      if (storage.getItem(KEYS[i]) !== after[i])
        return { status: "blocked", reason: "derived-write-failed" };
    }
    return cleanup(storage, raw)
      ? { status: "saved" } : { status: "saved-pending-cleanup" };
  } catch { return { status: "blocked", reason: "storage-unavailable" }; }
}
/** Never re-run deduction on recovery. Only replay exact after-snapshots. */
export function recoverGuestVoiceRemoval(storage: CookIntentStorage): GuestVoiceRecovery {
  try {
    const raw = storage.getItem(GUEST_VOICE_INTENT_KEY);
    if (raw === null) return { status: "none" };
    const j = validateIntent(raw);
    if (!j) return { status: "blocked", reason: "invalid-intent" };
    if (hasConflictingGuestMutationJournal(storage, GUEST_VOICE_INTENT_KEY))
      return { status: "blocked", reason: "conflict" };
    const current = KEYS.map(key => storage.getItem(key));
    let pending = -1;
    for (let i=0;i<KEYS.length;i++) {
      if (current[i] !== j.before[i] && current[i] !== j.after[i])
        return { status: "blocked", reason: "conflict" };
      if (j.before[i] === j.after[i]) continue;
      if (current[i] === j.before[i]) {
        if (pending === -1) pending = i;
      } else if (pending !== -1) return { status: "blocked", reason: "conflict" };
    }
    if (pending === 0) return cleanup(storage, raw)
      ? { status: "unapplied" } : { status: "blocked", reason: "storage-unavailable" };
    if (pending === -1) return cleanup(storage, raw)
      ? { status: "already-complete" } : { status: "blocked", reason: "storage-unavailable" };
    const expected = [...current];
    for (let i=pending;i<KEYS.length;i++) {
      if (storage.getItem(GUEST_VOICE_INTENT_KEY) !== raw ||
          KEYS.some((key,index) => storage.getItem(key) !== expected[index]))
        return { status: "blocked", reason: "conflict" };
      if (expected[i] !== j.after[i]) {
        storage.setItem(KEYS[i], j.after[i]);
        if (storage.getItem(KEYS[i]) !== j.after[i])
          return { status: "blocked", reason: "storage-unavailable" };
        expected[i] = j.after[i];
      }
    }
    return cleanup(storage, raw)
      ? { status: "completed-derived-writes" } : { status: "blocked", reason: "storage-unavailable" };
  } catch { return { status: "blocked", reason: "storage-unavailable" }; }
}
