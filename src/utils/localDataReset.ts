export const BALKANBITE_LOCAL_STORAGE_PREFIX = "balkanbite_";

export interface StorageKeyReader {
  length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

/**
 * Removes only BalkanBite-owned localStorage entries.
 *
 * This deliberately avoids Storage.clear(), which could erase unrelated
 * first-party entries (including auth/session data) stored on the same origin.
 */
export function clearBalkanBiteLocalStorage(storage: StorageKeyReader): string[] {
  const keysToRemove: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(BALKANBITE_LOCAL_STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => storage.removeItem(key));
  return keysToRemove;
}
