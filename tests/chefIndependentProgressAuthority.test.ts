import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ProgressionEventV1 } from "../src/utils/progressionLedger";
import { describeVerifiedChefProgress } from "../src/utils/chefWorkspaceFacts";
import { selectCompleteChefServerProgress } from "../src/utils/chefServerReadAuthority";
const events: ProgressionEventV1[] = [
  { version: 1, eventId: "purchase:qa", type: "confirmed_purchase_applied", occurredAt: "2026-10-20T08:00:00Z", evidence: "deterministic_state_transition", evidenceCount: 1 },
  { version: 1, eventId: "cook:qa", type: "recipe_cook_inventory_applied", occurredAt: "2026-10-20T10:00:00Z", evidence: "deterministic_state_transition", evidenceCount: 1 },
];
test("standalone progress facts ES EN BG count only complete recorded events", () => {
  assert.match(describeVerifiedChefProgress(events, "es")!, /2 eventos verificados/);
  assert.match(describeVerifiedChefProgress(events, "en")!, /1 applied purchases/);
  assert.match(describeVerifiedChefProgress(events, "bg")!, /2 потвърдени събития/);
  assert.match(describeVerifiedChefProgress([], "en")!, /0 verified events/);
  assert.equal(describeVerifiedChefProgress([events[0], events[0]], "en"), null);
  assert.equal(describeVerifiedChefProgress([{...events[0], evidenceCount: 0}], "en"), null);
  assert.equal(describeVerifiedChefProgress([{...events[0], type: "unknown" as never}], "en"), null);
  assert.doesNotMatch(describeVerifiedChefProgress(events, "en")!, /€|EUR|calories|kcal/);
});
test("server progress only checks event witness for account/session and exact visible state", () => {
  const evidence = { userId: "owner", serialized: JSON.stringify(events) };
  assert.deepEqual(selectCompleteChefServerProgress("owner", "owner", evidence, events), events);
  assert.equal(selectCompleteChefServerProgress("stranger", "stranger", evidence, events), null);
  assert.equal(selectCompleteChefServerProgress("owner", "stranger", evidence, events), null);
  assert.equal(selectCompleteChefServerProgress("owner", "owner", undefined, events), null);
  assert.equal(selectCompleteChefServerProgress("owner", "owner", evidence, []), null);
});
test("both Chef surfaces route SHOW_PROGRESS to narrowly scoped progression authority", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const hook = readFileSync(new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8");
  const voice = readFileSync(new URL("../src/components/VoiceChefView.tsx", import.meta.url), "utf8");
  const modal = readFileSync(new URL("../src/components/ChefIaModal.tsx", import.meta.url), "utf8");
  assert.match(voice, /workspaceQuery === "SHOW_PROGRESS"/);
  assert.match(voice, /const events = onGetAuthoritativeProgress\(\)/);
  assert.match(voice, /describeVerifiedChefProgress\(events, language\)/);
  assert.match(app, /const getAuthoritativeChefProgress = /);
  assert.match(app, /JSON\.stringify\(decoded\) !== JSON\.stringify\(parsed\)/);
  assert.match(hook, /getServerConfirmedChefProgress =/);
  assert.match(hook, /chefServerReadEvidence\.current\.progression, visibleProgression/);
  assert.match(modal, /onGetAuthoritativeProgress=\{onGetAuthoritativeProgress\}/);
});
