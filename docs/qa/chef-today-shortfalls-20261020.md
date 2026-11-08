# Chef IA — today's recorded meal shortages (2026-10-20)

## Baseline and bounded product value
- Verified functional Draft #453 base `61ea92d84f9c4e0486fcc4147bd6179c25c2778f`, with both GitHub CI and Firestore Emulator SUCCESS. `main=f6d6133149f585cf416cf5809d6280f6dc5486cd` remains separate from all Draft development. QA branch `qa/chef-today-shortfalls-20261020` must **never** be merged into main or deployed.
- A new exact, conservative ES/EN/BG question action `SHOW_TODAYS_SHORTAGES`: what ingredients are calculated as missing/insufficient **for meals registered on the local calendar day only**. It is different from the existing 0–2 day `SHOW_SHORTAGES` contract. The action reuses the existing deterministic `evaluateShoppingNeeds` engine and full `onGetAuthoritativeWorkspace` guest or server read gate; no model interpretation of quantities, AI payments or automatic shopping mutations.
- A missing plan/empty day explicitly means no meals recorded today to assess, **not** proof of no cooking or full stock. A later-day plan cannot leak into a today-only answer.
- Unknown quantities/units and required expiry review are counted separately rather than announced as verified quantitative deficits. Reported numbers are **calculated shortfalls in the recorded stock for planned recipes**, not confirmed purchases, prices, nutrition or guarantee of food safety. No persisted state is changed by this read-only question.

## Verification
- Unit tests `tests/chefWorkspaceFacts.test.ts`: ES/EN/BG literal phrases; reject compound shopping actions; discriminate today's vs tomorrow's ingredients and empty plan; unsafe units remain uncertain; malformed/duplicate evidence blocks answers.
- Browser test `qa/runtime/guest-pantry-recovery.mjs`: real Chef IA modal with mocked AI endpoint returning 503; checks today-specific shortfall and health/safety disclaimer without writing to pantry/shopping.
- Require exact SHA GitHub `validate` + all six Chromium `runtime-harness`, plus Firestore Emulator owner-isolation, diff review, no Vercel QA deployments before non-force expected-SHA fast-forward into Draft #453. Close temporary QA PR without merge to main and confirm final exact-head CI.
- Hosted Auth/Firestore E2E, Android mic, arbitrary cross-tab localStorage CAS and full Chef action orchestration remain unverified. Do not declare beta ready.
