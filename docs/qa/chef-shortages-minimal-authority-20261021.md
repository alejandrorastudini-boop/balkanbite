# Chef IA — authoritative pantry + menu shortage read (2026-10-21)

## Baseline
- Draft PR #453 at `91cfc82ca38a29d29406995769f044e582dbbd83`, general CI #39407037237 and Firestore Emulator #39407037319 SUCCESS.
- Production main `f6d6133149f585cf416cf5809d6280f6dc5486cd` is separate; this is a temporary QA slice. No Production changes authorized.

## Product problem and minimal dependencies
SHOW_SHORTAGES (today–two days) and SHOW_TODAYS_SHORTAGES previously demanded complete pantry, menu, shopping AND progression evidence. But `evaluateShoppingNeeds(...).missingMealIngredients` is determined by pantry inventory and recorded meal-plan recipe requirements; shopping rows only affect suggested new checklist candidates and shopping urgency. The Chef shortage answer does not use those candidates or urgency. A corrupt optional progression event or unrelated shopping item must not block a valid read.

## Change and guardrails
- `describeVerifiedChefShortages` takes **only authoritative pantry and meal-plan sources**, reusing the exact pre-existing deterministic shortage semantics and complete row validation via `describeChefWorkspaceQuery`.
- The empty shopping/progression arguments passed to the shared calculator are intentionally **not claims that those modules are empty**. The answer does not assert pending purchases, prices, consumed food or full household stock; unknown units and expiry remain uncertain.
- Guest: existing strict pantry and menu cache/UI selectors and all recovery/WAL gates; additional before-and-after raw pantry + plan key comparison plus journal recheck. Still **not an atomic CAS** across tabs.
- Signed-in: existing Firestore server-confirmed pantry and meal-plan witnesses, owner/current session checks and exact visible React echoes, no new listeners. Not a multi-collection atomic server snapshot.
- No AI calls, write operations, new paid service or changed pricing.

## Verification requirements
- `tests/chefIndependentShortageAuthority.test.ts`: ES/EN/BG equality with old complete-snapshot answer, malformed/duplicate inputs, unknown units and wiring.
- `qa/runtime/guest-pantry-recovery.mjs`: local Chromium guest Chef modal continues to answer shortages with unrelated shopping/progression corruption but refuses an invalid menu; no paid AI call.
- `qa/security/chef-read-authority-emulator.mjs`: actual Firestore SDK owner snapshots; unrelated invalid shopping/progression cannot suppress pantry-menu read; duplicate menu and offline revoke.
- Require exact QA SHA validate/lint/tests/build + all six Chromium runners and Firestore Emulator SUCCESS. Review diff, non-force expected-SHA fast-forward to #453, close QA PR without merge to main and repeat exact Draft head CI.

## Outstanding boundaries
- Hosted Auth/Firestore two-account E2E, mobile Android mic, and guest cross-tab CAS remain NOT VERIFIED; release gates #452/#457/#459/#474 remain open.
