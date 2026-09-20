import assert from "node:assert/strict";
import test from "node:test";

import { clearBalkanBiteLocalStorage } from "../src/utils/localDataReset";

class FakeStorage {
  private data = new Map<string, string>();

  constructor(entries: Array<[string, string]>) {
    entries.forEach(([key, value]) => this.data.set(key, value));
  }

  get length() {
    return this.data.size;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  has(key: string): boolean {
    return this.data.has(key);
  }
}

test("local reset removes only BalkanBite-owned keys", () => {
  const storage = new FakeStorage([
    ["balkanbite_profile", "{}"],
    ["balkanbite_user_123_pantry", "[]"],
    ["firebase:authUser:test", "keep"],
    ["another_app_setting", "keep"],
  ]);

  const removed = clearBalkanBiteLocalStorage(storage);

  assert.deepEqual(removed.sort(), [
    "balkanbite_profile",
    "balkanbite_user_123_pantry",
  ]);
  assert.equal(storage.has("balkanbite_profile"), false);
  assert.equal(storage.has("balkanbite_user_123_pantry"), false);
  assert.equal(storage.has("firebase:authUser:test"), true);
  assert.equal(storage.has("another_app_setting"), true);
});
