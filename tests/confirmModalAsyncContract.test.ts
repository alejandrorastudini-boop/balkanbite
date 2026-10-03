import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/components/ConfirmModal.tsx", import.meta.url),
  "utf8",
);

test("ConfirmModal awaits sync/async confirmation and false keeps review open", () => {
  assert.ok(source.includes(
    "onConfirm: () => void | boolean | Promise<void | boolean>",
  ));
  assert.ok(source.includes(
    "const result = await Promise.resolve(onConfirm())",
  ));
  assert.ok(source.includes("if (result !== false) onClose()"));
});

test("ConfirmModal synchronously guards double confirm and cannot close mid-flight", () => {
  assert.ok(source.includes("const confirmingRef = useRef(false)"));
  assert.ok(source.includes("if (confirmingRef.current) return"));
  assert.ok(source.includes("confirmingRef.current = true"));
  assert.ok(source.includes("if (!confirmingRef.current) onClose()"));
  assert.ok(source.includes("disabled={isConfirming}"));
  assert.ok(source.includes("aria-busy={isConfirming}"));
});

test("rejected confirmation promise stays visible and releases retry lock", () => {
  const catchIndex = source.indexOf('console.error("Confirmation action failed:"');
  const finallyIndex = source.indexOf("finally {", catchIndex);
  assert.ok(catchIndex >= 0 && finallyIndex > catchIndex);
  const finallyBlock = source.slice(finallyIndex, finallyIndex + 220);
  assert.ok(finallyBlock.includes("confirmingRef.current = false"));
  assert.ok(finallyBlock.includes("setIsConfirming(false)"));
  assert.equal(
    source.slice(catchIndex, finallyIndex).includes("onClose()"),
    false,
  );
});
