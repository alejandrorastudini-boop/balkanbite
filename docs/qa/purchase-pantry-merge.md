# Purchase → pantry merge

## Contract

`mergePurchasesIntoPantry` is pure. It combines an acquisition with existing stock only on an exact normalized name or explicit language alias and compatible quantity dimension. It does not equate related foods (e.g. tomato and tomato sauce). Ambiguous aliases and incompatible units create separate stock entries. Existing duplicate stock rows are not migrated or coalesced.

`transferCheckedShoppingItems` returns both next states: only accepted checked shopping lines leave the list. Invalid quantities, absent names/units, duplicate source IDs and overflowing sums do not consume shopping lines. Unchecked lines remain untouched. The App applies the accepted pantry, resynchronizes recipe availability and adapts the menu.

## Metadata and limits

- New shopping transfers do not invent expiry. Unknown categories use `Other`.
- Positive shopping line prices remain **estimates from the shopping list**, not verified paid prices. The helper does not verify upstream AI/manual defaults. Zero is currently the shopping list's unknown-price sentinel.
- Known complete line estimates can be added. If a merged part has unknown cost, the aggregate cost is `null`. Explicit null also overwrites stale Firestore values under merge writes; simply omitting the property would retain the old cloud value.
- `purchaseHistory` retains original acquisition quantities/units, recorded cost, expiry metadata and source. A first merge snapshots the old entry as `pantry_legacy`. This is historical evidence, not a ledger of current lot balances, nutrition, actual spending or consumed value.
- Existing earliest known expiry warning is preserved with `expiryIsPartial: true` and a visible “Some stock” label. It is not assigned to all newly purchased food. Precise expiry dates and lot-level depletion remain follow-up work; existing `expiryDaysLeft` values still do not advance with time.
- Repeating a source ID already recorded in a surviving pantry entry is a no-op. This is not durable transaction-level idempotency after the entire item is removed, and is not a multi-device transaction.
- Authenticated Firestore E2E remains unverified. No production mutation or migration is included.

## Verification

`npm test` executes durable Node tests through the existing tsx dependency. Purchase cases include compatible count additions, kg/g, L/ml, incompatible containers, matching containers, batches, unchanged input objects, repeat confirmation, invalid rows, unknown prices/expiry/categories, exact identity, alias ambiguity, duplicate source IDs and confirmed zero values. Recipe shortfall regressions also run.

Browser acceptance: guest preview with demo Tomate 4 uds, add a checked purchase of 2 uds → one Tomate row with 6 uds; shopping row removed; reload preserves it. Then buy Tomate in g → distinct stock entry, without converting units to mass.
