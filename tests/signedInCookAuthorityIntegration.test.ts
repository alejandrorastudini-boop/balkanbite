import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const appSource = fs.readFileSync(path.resolve("src/App.tsx"), "utf8");
const syncSource = fs.readFileSync(path.resolve("src/hooks/useFirebaseSync.ts"), "utf8");

describe("signed-in cook authority integration", () => {
  it("passes the stable reviewed confirmation id into the App cook handler", () => {
    expect(appSource).toContain("cookConfirmationId: string");
    expect(appSource).toContain("preparedSignedInCooks.current.get(cookConfirmationId)");
    expect(appSource).toContain("preparedSignedInCooks.current.set(cookConfirmationId, prepared)");
  });

  it("does not optimistically set signed-in pantry after cook dispatch", () => {
    const start = appSource.indexOf("const handleCookRecipe = async");
    const end = appSource.indexOf("const handleAddMissingToShopping", start);
    const handler = appSource.slice(start, end);
    const signedStart = handler.indexOf("let prepared = preparedSignedInCooks");
    expect(signedStart).toBeGreaterThan(0);
    expect(handler.slice(signedStart)).not.toContain("setPantry(");
    expect(handler.slice(signedStart)).toContain("await submitConfirmedCook");
  });

  it("preserves the exact prepared Firestore request across uncertain retries", () => {
    expect(syncSource).toContain("preparedCookConfirmations.current.get(cookId)");
    expect(syncSource).toContain("persistConfirmedCookAtomically");
    expect(syncSource).toContain("Preserve the exact request");
  });

  it("requires server-confirmed remaining quantities and incremented revisions before acceptance", () => {
    expect(syncSource).toContain("inventoryServerConfirmedUser !== uid");
    expect(syncSource).toContain("observed.quantity !== remaining");
    expect(syncSource).toContain("observed.cookRevision !== expected.cookRevision + 1");
    expect(syncSource).toContain("preparedCookConfirmations.current.delete(cookId)");
  });
});
