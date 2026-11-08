# Shopping advisor — unknown coverage and no invented trip date (2026-10-21)

## Verified code issue
At functional Draft #453 base `211f500548cbfb43abfd183d39d2011f9051b4c8`, `evaluateShoppingNeeds([], [], [])` could return the unqualified ES/EN/BG statement that the pantry covers the next meals, the `Pantry Well Stocked` status and an arbitrary four-day future trip recommendation. An empty recorded menu is not evidence of food sufficiency; a stored recipe with zero ingredient requirements is not evaluable.

## Bounded correction
- Identify whether scheduled meals in the actual 0–2-day advisor evaluation window have any recorded ingredient requirements. For none, the zero-signal answer is **unknown coverage**, not full inventory. For evaluable plans without detected shortages, the message says **no calculated shortages**, not a guarantee of complete stock.
- Preserve existing positive shopping signals: confirmed quantitative deficits and pending shopping checklist still drive urgent/recommended actions. Missing, incompatible units and expiry review are still separate.
- If no shopping trip is recommended, represent timing as `daysUntilNextTripNeeded=null`, **not** four days. The modal shows a neutral help state, no artificial green check/progress percentage, and 'No recommended date' in BG/ES/EN.
- No changes to actual pantry, shopping, meals, prices or health values. No AI or hosted writes. Existing urgency heuristics for actual deficits are unchanged.

## Required verification and limitations
- `tests/shoppingAdvisorNoFalseCoverage.test.ts`: empty menu/pantry, zero-ingredient recipe, enough known stock, urgent shortage, pending shopping, ES/EN/BG and rendered modal.
- GitHub QA branch must pass exact-SHA CI validate/lint/tests/build and all six Chromium harnesses. No Firestore authority logic changed; existing emulator CI for Draft #453 remains gate where appropriate.
- Does **not** establish nutrition adequacy, exact future purchasing dates, food-safety guarantee, stock truth for unrecorded foods, or hosted Android/Firebase E2E.
- QA PR stays Draft, no merge to main, no Production, no paid integrations. Non-force expected-SHA promotion only after checks pass; close QA PR without merge.
