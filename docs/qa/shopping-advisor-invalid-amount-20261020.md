# Shopping advisor — invalid and overflowing quantities (2026-10-20)

## Reason for change
- Source is functional Draft #453 on verified SHA `603c95975578d578a426117a80e58544cc935831`; CI and Firestore Emulator are SUCCESS on exact SHA. Production/main remain unchanged.
- In `evaluateShoppingNeeds`, a nonfinite recipe amount previously became `0` before the deterministic assessor; `normalizeQuantity(0, unit)` is structurally valid, so a missing pantry ingredient could be labeled as a quantitatively **verified missing 0 units**, and a stocked ingredient could be silently treated as covered. Neither is acceptable evidence of ingredient quantity.
- Extremely large but finite values (for example `1e308 kg`) can overflow into `Infinity` when converted to base units even though the original number passes `Number.isFinite`. That affects both available pantry and pending shopping comparisons, and can lead to false coverage or masked shortfalls.
- With zero purchase lines, a trip cost of 0 EUR is not sourced from priced items and should remain unknown rather than appearing as verified financial data.

## Narrow deterministic guards
- Reject `requiredAmount <= 0`, nonfinite required amounts and nonfinite or zero base quantity **as unverified**. Preserve the item's literal identity and unit without inventing an alternative amount or buying it.
- Exclude compatible pantry quantities with overflowing base values from verified coverage. Exclude pending shopping rows with nonfinite base quantities from cancelling real missing amounts.
- Keep the existing deterministic valid kg/g, l/ml, pending shopping and expiry behavior; do not weaken shopping-to-pantry purchase confirmation gates.
- Leave `estimatedTotalTripEUR` undefined when no priced trip lines exist.

## QA and boundaries
- `tests/shoppingAdvisorInvalidQuantity.test.ts`: invalid/zero/negative ingredient amount, overflowed required amount, overflowed pantry stock, overflowed pending shopping row, and ordinary valid kg/g shortfall control.
- `tests/shoppingAdvisorUnknownPrice.test.ts`: empty trip must not claim zero-priced shopping.
- Run full GitHub CI `validate`, six Chromium harnesses, and Firestore Emulator on temporary QA branch; verify diff and no Vercel deployment, then optionally non-force FF onto Draft #453 and rerun exact SHA.
- This is a **safety/uncertainty correction** in deterministic calculation, not a hosted application test. Beta #457, cross-tab guest consistency #459, full Chef operator #474 and Android real mic remain unverified.
