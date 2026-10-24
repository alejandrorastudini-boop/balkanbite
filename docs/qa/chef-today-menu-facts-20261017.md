# Chef IA — today's recorded meal plan query (2026-10-17)

## Baseline and scope
- Base functional Draft PR #453 exact SHA `476ed54f024ecb475d21f9de8a9d5ab347bc7566`, validated by GitHub Actions #39021044494 (general CI) and #39021044482 (local Firestore Emulator), both SUCCESS; main and Vercel Production unchanged.
- Temporary QA branch `qa/chef-todays-menu-facts-20261017`; **do not merge to main, deploy or run hosted writes**.
- A finite, localized ES/EN/BG read-only Chef intent `SHOW_TODAYS_MENU` answers exactly which meals are recorded for **today's local calendar date**, labeling breakfast/lunch/dinner. It does not infer ingredients, invent a menu, log consumption or treat unplanned meals as skipped meals.
- Existing `onGetAuthoritativeWorkspace` callback is reused with exact guest validated cache or authenticated server-confirmed inventory/meal plan/shopping/progression, owner-scoped and UI-equal. No extra model request, subscription, database mutation, price or nutrition assumption.
- No plan today: explicitly say only that no meals are recorded today, not that the user will not eat or has no food. Items scheduled tomorrow cannot appear in today's answer. A plan is **not** a confirmed consumption.
- Exact short phrases only. Compound instructions to cook, delete or mark meals eaten do not match this read intent; the existing reviewed Chef mutation flow remains separate.

## Evidence gates
- `tests/chefWorkspaceFacts.test.ts`: ES/EN/BG parser, mutation/compound refusal, deterministic local calendar today vs tomorrow, named meal slots, no fabricated calories/prices or unconfirmed consumption.
- `qa/runtime/guest-pantry-recovery.mjs`: real local Chromium Chef text modal answers today's registered lunch while the AI parser endpoint is mocked down; cross-tab corruption still refuses the workspace.
- Full GitHub `validate` + six local Chromium `runtime-harness` and Firestore Emulator jobs must PASS at exact QA SHA. Only then safe expected-head non-force fast-forward to Draft #453, close temporary QA PR without merging, rerun final exact-head CI.
- Authenticated hosted Firebase UI E2E, real Android microphone, transactional multi-collection snapshot and guest cross-tab atomic CAS are still NOT VERIFIED. Beta gates #452/#457/#459/#474 remain open.
