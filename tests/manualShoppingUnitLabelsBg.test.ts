import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/components/ShoppingView.tsx", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../qa/runtime/guest-pantry-recovery.mjs", import.meta.url), "utf8");

test("Bulgarian manual shopping quantities label all six canonical units without changing IDs", () => {
  for (const [id, bg] of [
    ["uds", "Бройки (бр.)"], ["kg", "Килограми (kg)"],
    ["g", "Грамове (g)"], ["packs", "Пакети (пак.)"],
    ["manojos", "Връзки"], ["l", "Литри (l)"],
  ]) {
    assert.ok(source.includes(`value="${id}"`), `canonical unit ${id} is unchanged`);
    assert.ok(source.includes(bg), `Bulgarian display text for ${id} is present`);
  }
  assert.match(source, /onAddItem\(\{/);
  assert.match(runtime, /runBulgarianManualShoppingUnits\(\)/);
  assert.match(runtime, /bulgarian-390px-manual-shopping-units-canonical-ids-and-reload/);
});
