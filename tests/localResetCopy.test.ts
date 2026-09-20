import assert from "node:assert/strict";
import test from "node:test";

import { getLocalResetCopy } from "../src/utils/localResetCopy";

test("signed-in reset copy explicitly says cloud data is not deleted", () => {
  const en = getLocalResetCopy("en", true);
  const es = getLocalResetCopy("es", true);
  const bg = getLocalResetCopy("bg", true);

  assert.match(en.buttonLabel, /local/i);
  assert.match(en.description, /cloud account is not deleted/i);
  assert.match(es.description, /cuenta sincronizada en la nube no se eliminan/i);
  assert.match(bg.description, /облачен акаунт не се изтриват/i);
  assert.doesNotMatch(en.confirmText, /all/i);
  assert.doesNotMatch(es.confirmText, /todo/i);
});

test("guest reset copy stays local-only and does not imply account deletion", () => {
  for (const language of ["en", "es", "bg"] as const) {
    const copy = getLocalResetCopy(language, false);
    assert.ok(copy.buttonLabel.length > 0);
    assert.ok(copy.description.length > 0);
    assert.ok(copy.confirmText.length > 0);
  }

  assert.match(
    getLocalResetCopy("en", false).description,
    /does not delete data from any cloud account/i,
  );
});
