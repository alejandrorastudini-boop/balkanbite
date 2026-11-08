# Guest source preservation — combined local QA checkpoint (2026-11-08)

## Authority and branch scope
- Source: Draft #453 `a6fa920d0d4c04c3495173290859f59ed166d3ff` (not changed by this work).
- Integrated **isolated** branch: `fix/guest-safe-sources-combined-20261108`, based on derived-source checkpoint `7a42211b4aa8c07399dac9afdf6ad9f307257f71` and selectively transplanting chat-source protection from `fix/guest-chat-history-source-preservation-20261108` checkpoint `415d2849c431eed3f66930dfc4c75d81fd33bfc3`.
- No `main`, no deployment, no paid tooling; all new commits use `[skip ci]`. This is a **review candidate**, not a promoted fix or production guarantee.

## Why the work exists
Before these guard additions, filtered guest hydration for recipes, meal plan, progression or chat could be written back as though it were complete. This can erase unknown legacy rows/metadata. The structural path is demonstrable in source; real user loss **NO VERIFICADO**.
Separately, a valid chat source changed in another tab must not be overwritten by a stale but also valid React view. A silent failed storage clear must not hide existing conversation messages.

## Combined changes
1. Recipes, meal plan, progression: completeness guards at legacy guest effect writers, preserving original bytes and latching a shared consistency warning on invalid/partially filtered sources; BG/ES/EN existing warning.
2. Chat: lossless-source parser, duplicate/unknown metadata rejection, last-committed guest snapshot comparison (semantic object-key order, strict content/order), readback-gated writer, external storage-event latch, BG/ES/EN guest warning.
3. Chat clear: both Chef IA entrypoints now use persist-first clear. Original React list remains visible if a quota/silent storage error prevents confirming deletion. No automated merge, recovery or business/clinical authority from chat content.
4. Regression tests: existing Chromium guest recovery harness extended for (a) legacy recipes/plan/progression reload with exact bytes; (b) malformed and complete chat baseline; (c) two-tab chat staleness; (d) silent lost-write clear; (e) pantry-origin tab must not receive its own cross-tab warning. Added unit and wiring tests for both new helpers and App behavior.

## Static review completed
- GitHub compare against Draft #453: ahead-only, 9 changed files; no files were removed.
- Verified unique chat state, committed ref and effect in combined App; three derived source guards; two Chef IA clear entrypoints; preserved existing pantry browser test; all four new Chromium functions present, each invoked exactly once in harness.
- This is **source/static review only**; it is not an execution of tests or browser behavior.

## Explicit NO VERIFICADO
- `npm test`, `npm run lint`, `npm run build`, Chromium harnesses and Firestore Emulator have **not** run on this combined tree.
- Android physical browser, hosted Auth/Firestore and runtime persistence cannot be certified.
- localStorage offers neither cross-tab atomic CAS nor crash-safe multi-key commit. Preserving bytes is not assisted restore.
- Profile/HealthProfile guest normalization deserves a separate evidence-first audit, especially for sensitive unknown metadata; no changes to that source in this branch.
- Packaging/pricing remains NO DECIDIDO.

## Gate and next safe action
1. In authorized no-surprise test environment, run exact-SHA `npm install --no-audit --no-fund`, `npm run lint`, `npm test`, `npm run build`, six local Chromium harnesses, offline Firestore Emulator.
2. Fix any genuine failing test on the isolated branch and repeat SHA-specific validation.
3. Review diff and confirm no regression in signed-in owner scope, food-loop stock, clinical claims or deleted data; verify Android and hosted boundaries separately.
4. Only then consider non-force expected-SHA promotion to Draft #453, which remains Draft until #457 release gates are satisfied. No merge to `main` or Production here.

## Recovery pointers
- Independent QA origin warning branch: `qa/guest-pantry-origin-warning-20261108` `d63fb7b8cbfa950e3782ab5800419eda232cfbf4`.
- Independent derived guard branch: `fix/guest-derived-source-preservation-20261108` `7a42211b4aa8c07399dac9afdf6ad9f307257f71`.
- Independent chat guard branch: `fix/guest-chat-history-source-preservation-20261108` `415d2849c431eed3f66930dfc4c75d81fd33bfc3`.
- Combined branch is ahead of Draft and deliberately not merged. Preserve all source branches until exact combined acceptance.
