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

## Date-sensitive WAL regression discovered on 2026-10-17

- Initial QA PR #476 CI #39001626610: TypeScript/lint SUCCESS, but 3 historical guest WAL fault-injection tests failed because their staged shopping projection became unchanged after the historical meal date (2026-10-16) moved outside the advisor's upcoming 0–2 day window. Runtime harness was not run.
- Reliability root cause: `guestCookDerivedIntent` and `guestVoiceRemovalIntent` called `evaluateShoppingNeeds` without the `now` argument, meaning validation/recovery recomputed persisted journals relative to the **current wall clock** rather than the immutable command's `occurredAt`. Day rollover could invalidate an otherwise valid historical WAL.
- Fix scope: pass `new Date(occurredAt)` in both WAL derivations and the corresponding App projections; anchor both test expectations to the same recorded operation time. Each affected fixture now asserts shopping **actually changes**, so a future calendar rollover cannot silently neuter its fault test.
- This is a guest consistency fix, not authorization for cross-tab atomicity. Must pass full CI and Chromium on the new exact SHA before integrating into Draft #453. No Production release.

## Verified checkpoint — 2026-10-17

- Exact implementation SHA `88a1f61f7631a9741e2f4ec803dbdccbc266ba99` on temporary QA Draft PR #476: [GitHub Actions #39002066179](https://github.com/alejandrorastudini-boop/balkanbite/actions/runs/39002066179) **SUCCESS** for both `validate` and `runtime-harness`.
- Main tests **1,190/1,190 PASS**, auxiliary 7+3 PASS, lint/typecheck, Vite build, serverless smoke, **six local Chromium harnesses PASS**. Real Chef modal facts displayed with mocked AI unavailable and two browser tabs; no paid AI, Android mic or hosted Firestore proof.
- Earlier #39001626610 failed 3 historical tests due to date-dependent projections; this exposed a real WAL verification stability issue and was fixed by anchoring advisor time to immutable `occurredAt` in guest cook/voice journal derivations, their callers and test expectations.
- #39001809465 passed unit/build but failed a newly written Chromium assertion that incorrectly expected `recorded date passed` for a product expiring *tomorrow*. QA was corrected to assert “in 1 day”, with ES/EN/BG singular inflections covered by unit tests.
- Incremental diff against prior #453 checkpoint spans 11 files, no Firestore Rules, dependencies, GitHub workflow, billing or secret edits; candidate branch had no Vercel deployment at inspection.
- The verified implementation was non-force fast-forwarded to Draft #453. This documentation-only commit will advance the Draft head and **requires exact-SHA CI again**. `main`/Production remain unchanged; #452/#457/#459 not closed.

## Deferred
- No general intent planner or fuzzy LLM mapping, no multi-step autonomous execution, no persistent assistant overlay across tabs yet.
- Additional grounded query contracts for shortages/menu/progression require separate authority gates.
- localStorage multi-tab CAS remains unresolved (#459). Hosted Firestore, account isolation, Android speech and beta gates remain open (#457).
