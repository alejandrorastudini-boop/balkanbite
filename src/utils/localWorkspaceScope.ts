export type LocalWorkspaceKey =
  | "balkanbite_meallogs"
  | "balkanbite_chat_messages";

export function getUserLocalWorkspaceKey(
  baseKey: LocalWorkspaceKey,
  userId: string,
): string {
  return `${baseKey}_user_${encodeURIComponent(userId)}`;
}

export function parseArrayCache<T>(raw: string | null): T[] | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}
