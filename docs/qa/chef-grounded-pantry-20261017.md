# Chef IA — grounded pantry facts QA (2026-10-17)

## Scope and truthful baseline
- Base: Draft #453 at `09ae385f1eede7b3e6959fca00d9847387bc87c2` (both CI jobs SUCCESS on #38957699578). `main=f6d6133149f585cf416cf5809d6280f6dc5486cd`; Production unchanged.
- Work branch: `qa/chef-grounded-pantry-20261017`. **Not a release; do not merge into main.**
- Read-only commands in ES/EN/BG: `SHOW_PANTRY_ITEMS` / `SHOW_EXPIRING`. Exact conservative phrase matching; compound commands do not become authoritative queries.
- Answer source: synchronous domain snapshot callback from `App`, **not** AI transcript or chat history. Guest: journal absent, no recovery/quarantine, local persisted pantry strictly equals React and last committed ref; signed-in: hydrated server-confirmed inventory and correct account/workspace, no sync error. If unverifiable, reply “cannot verify” without inventing empty pantry or quantities.
- Stock response: individual recorded quantities and units; max six displayed plus count of omitted rows; no cross-unit sum, no inferred shopping, nutrition or prices.
- Expiry response: uses existing `derivePantryItemExpiry`, calendar-day evidence; recorded past/within 3 days only, partial/unknown counted explicitly; packaging/safety caveat. Does not assert safe-to-eat, discard instruction, guaranteed expiry or precise lot allocation.
- No writes except conversation history; no new external/paid AI calls; text input and browser-recognized speech share the same deterministic path, but **live Android microphone remains NOT VERIFIED**.

## Gate
- `tests/chefPantryFacts.test.ts`: parsing positive/negative, precision/units, partial expiry, unknown, invalid data and truncation.
- `qa/runtime/guest-pantry-recovery.mjs`: real Chef modal questions with failing mocked API; checks no AI request or pantry/shopping writes, then creates an unresolved WAL from a second browser tab and asserts fail-closed answer and preserved raw marker.
- Full CI `validate` (tests, typecheck, build, serverless) + `runtime-harness` (six Chromium suites) **must pass at exact branch SHA**. Review diffs and protect main/Production.
- Only after QA verification, non-force fast-forward Draft #453 against its exact expected head; rerun its exact CI, close temporary QA PR without merge, record final checkpoint and next steps.

## Deferred
- No general intent planner or fuzzy LLM mapping, no multi-step autonomous execution, no persistent assistant overlay across tabs yet.
- Additional grounded query contracts for shortages/menu/progression require separate authority gates.
- localStorage multi-tab CAS remains unresolved (#459). Hosted Firestore, account isolation, Android speech and beta gates remain open (#457).
