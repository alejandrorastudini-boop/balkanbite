import assert from "node:assert/strict";
import test from "node:test";
import { getRecipeCookFeedback } from "../src/utils/recipeCookFeedback";

test("successful cook outcomes keep the existing success copy", () => {
  assert.deepEqual(
    getRecipeCookFeedback({ success: true }, "es", "Cocinado"),
    { kind: "success", text: "Cocinado" },
  );
});

test("rejected cook outcomes never produce success feedback", () => {
  const es = getRecipeCookFeedback({ success: false, issueCount: 2 }, "es", "Cocinado");
  const bg = getRecipeCookFeedback({ success: false, issueCount: 1 }, "bg", "Готово");
  const en = getRecipeCookFeedback({ success: false, issueCount: 3 }, "en", "Cooked");

  assert.equal(es.kind, "error");
  assert.match(es.text, /2 ingrediente/);
  assert.equal(bg.kind, "error");
  assert.match(bg.text, /1 съставка/);
  assert.equal(en.kind, "error");
  assert.match(en.text, /3 ingredient/);
});
