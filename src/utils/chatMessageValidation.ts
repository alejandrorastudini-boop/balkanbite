import type { ChatActionType, ChatMessage } from "../types";
import { isStoredRecipeStructurallyValid } from "./storedRecipeValidation";
import { sanitizeStoredMealLog } from "./verifiedMealLog";

export const CHAT_ACTION_TYPES = new Set<ChatActionType>([
  "MEAL_LOG",
  "RECIPE_RECOMMENDATION",
  "ADD_ITEMS",
  "REMOVE_ITEMS",
  "ADD_SHOPPING",
  "ANSWER",
]);

type ChatItemsAffected = NonNullable<ChatMessage["itemsAffected"]>;

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function asChatActionType(value: unknown): ChatActionType | undefined {
  return typeof value === "string" &&
    CHAT_ACTION_TYPES.has(value as ChatActionType)
    ? (value as ChatActionType)
    : undefined;
}

function sanitizeItemsAffected(value: unknown): ChatItemsAffected | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;

  const sanitized: ChatItemsAffected = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return undefined;
    }

    const record = item as Record<string, unknown>;
    if (
      !nonBlank(record.name) ||
      typeof record.quantity !== "number" ||
      !Number.isFinite(record.quantity) ||
      record.quantity <= 0 ||
      !nonBlank(record.unit)
    ) {
      return undefined;
    }

    sanitized.push({
      name: record.name.trim(),
      quantity: record.quantity,
      unit: record.unit.trim(),
    });
  }

  return sanitized;
}

export function sanitizeChatActionMetadata(
  actionType: unknown,
  itemsAffected: unknown,
): Pick<ChatMessage, "actionType" | "itemsAffected"> {
  const safeActionType = asChatActionType(actionType);
  const safeItemsAffected = sanitizeItemsAffected(itemsAffected);

  return {
    ...(safeActionType ? { actionType: safeActionType } : {}),
    ...(safeItemsAffected ? { itemsAffected: safeItemsAffected } : {}),
  };
}

/**
 * Sanitizes local chat history without turning optional model metadata into
 * authority. The conversational text survives when its required identity is
 * valid; malformed optional metadata is simply omitted.
 */
export function sanitizeStoredChatMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  if (
    !nonBlank(record.id) ||
    (record.sender !== "user" && record.sender !== "assistant") ||
    !nonBlank(record.text) ||
    !nonBlank(record.timestamp)
  ) {
    return null;
  }

  const actionMetadata = sanitizeChatActionMetadata(
    record.actionType,
    record.itemsAffected,
  );

  const suggestedRecipe = isStoredRecipeStructurallyValid(record.suggestedRecipe)
    ? record.suggestedRecipe
    : undefined;
  const loggedMeal =
    record.loggedMeal === undefined
      ? null
      : sanitizeStoredMealLog(record.loggedMeal);

  return {
    id: record.id.trim(),
    sender: record.sender,
    text: record.text,
    timestamp: record.timestamp,
    ...actionMetadata,
    ...(suggestedRecipe ? { suggestedRecipe } : {}),
    ...(loggedMeal ? { loggedMeal } : {}),
  };
}

export function parseChatMessageCache(raw: string | null): ChatMessage[] {
  if (raw === null) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((value) => {
      const sanitized = sanitizeStoredChatMessage(value);
      return sanitized ? [sanitized] : [];
    });
  } catch {
    return [];
  }
}
