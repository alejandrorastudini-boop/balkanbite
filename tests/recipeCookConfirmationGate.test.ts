import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/components/RecipeView.tsx", import.meta.url),
  "utf8",
);

test("recipe card and drawer only stage a cook confirmation", () => {
  assert.ok(source.includes(
    "onClick={() => requestCookConfirmation(recipe)}",
  ));
  assert.ok(source.includes(
    "onClick={() => requestCookConfirmation(selectedRecipe)}",
  ));
  assert.equal(source.includes("onClick={() => handleCook(recipe)}"), false);
  assert.equal(source.includes("handleCook(selectedRecipe);"), false);
});

test("one stable cookConfirmationId is created when review begins, not on retry", () => {
  assert.ok(source.includes("const createCookConfirmationId = () =>"));
  assert.ok(source.includes("if (pendingCook) return"));
  assert.ok(source.includes(
    "cookConfirmationId: createCookConfirmationId()",
  ));
  const confirmStart = source.indexOf("const confirmPendingCook = async");
  const renderStart = source.indexOf("return (", confirmStart);
  assert.ok(confirmStart >= 0 && renderStart > confirmStart);
  const confirm = source.slice(confirmStart, renderStart);
  assert.ok(confirm.includes("pending.cookConfirmationId"));
  assert.equal(confirm.includes("createCookConfirmationId()"), false);
});

test("confirmation awaits App result and failure keeps review/drawer open", () => {
  assert.ok(source.includes(
    "onCookRecipe: (recipe: Recipe, cookConfirmationId: string) => RecipeCookOutcome | Promise<RecipeCookOutcome>",
  ));
  assert.ok(source.includes(
    "outcome = await Promise.resolve(",
  ));
  assert.ok(source.includes(
    "onCookRecipe(recipe, cookConfirmationId)",
  ));

  const confirmStart = source.indexOf("const confirmPendingCook = async");
  const renderStart = source.indexOf("return (", confirmStart);
  const confirm = source.slice(confirmStart, renderStart);
  assert.ok(confirm.includes("if (!outcome.success) return false"));
  assert.ok(confirm.includes("setSelectedRecipe(null)"));
  assert.ok(confirm.includes("return true"));
  assert.equal(confirm.includes("setPendingCook(null)"), false);
});

test("explicit confirmation modal owns cancellation and closes only through async modal contract", () => {
  assert.ok(source.includes("isOpen={pendingCook !== null}"));
  assert.ok(source.includes("onClose={() => setPendingCook(null)}"));
  assert.ok(source.includes("onConfirm={confirmPendingCook}"));
  assert.ok(source.includes("Have you cooked this recipe?"));
  assert.ok(source.includes("Yes, deduct"));
});

test("latest failed cook stays visible inside an open recipe drawer", () => {
  assert.ok(source.includes(
    "const cookFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)",
  ));
  const handleStart = source.indexOf("const handleCook = async");
  const requestStart = source.indexOf("const requestCookConfirmation", handleStart);
  const handle = source.slice(handleStart, requestStart);
  assert.ok(handle.includes("clearTimeout(cookFeedbackTimerRef.current)"));
  assert.ok(handle.includes("cookFeedbackTimerRef.current = setTimeout"));

  assert.ok(source.includes('cookFeedback?.kind === "error"'));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("{cookFeedback.text}"));
});
