import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const recipeSource = readFileSync(
  new URL("../src/components/RecipeView.tsx", import.meta.url),
  "utf8",
);
const modalSource = readFileSync(
  new URL("../src/components/ConfirmModal.tsx", import.meta.url),
  "utf8",
);

test("recipe card and drawer only stage cook intent", () => {
  assert.ok(recipeSource.includes(
    "onClick={() => requestCookConfirmation(recipe)}",
  ));
  assert.ok(recipeSource.includes(
    "requestCookConfirmation(selectedRecipe);",
  ));
  assert.equal(
    recipeSource.includes("onClick={() => handleCook("),
    false,
  );
});

test("cook confirmation ID is created once when intent is staged", () => {
  for (const expected of [
    "const [pendingCookIntent, setPendingCookIntent]",
    "const createCookConfirmationId = () =>",
    "globalThis.crypto?.randomUUID",
    "cookMutationSequence.current += 1",
    "cookConfirmationId: createCookConfirmationId()",
  ]) {
    assert.ok(recipeSource.includes(expected), expected);
  }

  const requestStart = recipeSource.indexOf(
    "const requestCookConfirmation = (recipe: Recipe)",
  );
  const confirmStart = recipeSource.indexOf(
    "const confirmPendingCook",
    requestStart,
  );
  assert.ok(requestStart >= 0 && confirmStart > requestStart);
  const requestBlock = recipeSource.slice(requestStart, confirmStart);
  assert.ok(requestBlock.includes("if (pendingCookIntent) return"));
});

test("async cook failure retains same pending recipe and confirmation ID", () => {
  const start = recipeSource.indexOf("const confirmPendingCook");
  const end = recipeSource.indexOf("return (", start);
  assert.ok(start >= 0 && end > start);
  const block = recipeSource.slice(start, end);

  assert.ok(block.includes("const pending = pendingCookIntent"));
  assert.ok(block.includes(
    "pending.cookConfirmationId",
  ));
  assert.ok(block.includes("if (!outcome.success) return false"));
  const failure = block.indexOf("if (!outcome.success) return false");
  const clear = block.indexOf("setPendingCookIntent(null)");
  assert.ok(clear > failure);
  assert.ok(block.includes("setSelectedRecipe(null)"));
});

test("cook callback accepts stable ID and may resolve asynchronously", () => {
  assert.ok(recipeSource.includes(
    "onCookRecipe: (recipe: Recipe, cookConfirmationId: string) => RecipeCookOutcome | Promise<RecipeCookOutcome>;",
  ));
  assert.ok(recipeSource.includes(
    "onCookRecipe(recipe, cookConfirmationId)",
  ));
  assert.ok(recipeSource.includes(
    "await Promise.resolve(",
  ));
});

test("cook modal remains the only confirmation boundary and surfaces retry error", () => {
  assert.ok(recipeSource.includes(
    "isOpen={pendingCookIntent !== null}",
  ));
  assert.ok(recipeSource.includes(
    "onClose={() => setPendingCookIntent(null)}",
  ));
  assert.ok(recipeSource.includes("onConfirm={confirmPendingCook}"));
  assert.ok(recipeSource.includes(
    'feedbackText={cookFeedback?.kind === "error" ? cookFeedback.text : undefined}',
  ));
  assert.ok(recipeSource.includes("Yes, deduct"));
  assert.ok(recipeSource.includes("Sí, descontar"));
  assert.ok(recipeSource.includes("Да, приспадни"));
});

test("generic ConfirmModal awaits async result and false keeps review open", () => {
  for (const expected of [
    "onConfirm: () => void | boolean | Promise<void | boolean>",
    "const [isConfirming, setIsConfirming] = useState(false)",\n    "const isConfirmingRef = useRef(false)",\n    "if (isConfirmingRef.current) return",\n    "isConfirmingRef.current = true",
    "const result = await Promise.resolve(onConfirm())",
    "if (result !== false) onClose()",
    "if (!isConfirmingRef.current) onClose()",
    "disabled={isConfirming}",
    "aria-busy={isConfirming}",
  ]) {
    assert.ok(modalSource.includes(expected), expected);
  }
});

test("generic ConfirmModal catches failure instead of closing as success", () => {
  const start = modalSource.indexOf("const handleConfirm = async");
  const end = modalSource.indexOf("return (", start);
  assert.ok(start >= 0 && end > start);
  const block = modalSource.slice(start, end);
  const close = block.indexOf("if (result !== false) onClose()");
  const catchIndex = block.indexOf("catch (error)");
  assert.ok(close >= 0 && catchIndex > close);
  assert.equal(
    block.slice(catchIndex).includes("onClose()"),
    false,
  );
});
