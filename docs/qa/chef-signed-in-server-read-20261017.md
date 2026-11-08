# Chef IA — signed-in server read authority (2026-10-17)

## Source and scope
- Base: verified Draft PR #453 head `4de0b028c73d07e47a556057a35a6f13b58138ca`, CI #39004689611 `validate` and `runtime-harness` SUCCESS. `main=f6d6133149f585cf416cf5809d6280f6dc5486cd` remains untouched.
- QA branch `qa/chef-auth-server-read-gate-20261017`; this is not a release and must not be merged into main.
- The existing Chef typed `SHOW_MENU`, `SHOW_SHORTAGES`, `SHOW_PROGRESS` read-only commands may now consult **signed-in** menu/shopping/progression only after strict server-read evidence for **all three** plus the existing server-confirmed inventory gate.
- No independent subscriptions: existing `mealPlans`, `shoppingList` and `progressionEvents` listeners expose optional read evidence. Metadata-only transitions for these listeners are now observed and can invalidate evidence even when the displayed data is unchanged. Guest read flow is unchanged.

## Read rules
- Every source must be observed directly from a Firestore snapshot with `fromCache=false`, `hasPendingWrites=false`, no document-level pending writes, matching owner `userId`, and all structurally valid rows.
- Silent removal of malformed rows, duplicate logical IDs, invalid events, stale account scopes and mixed old/new visible arrays **block Chef** rather than producing a partial answer. Confirmed empty snapshots are allowed; unconfirmed/absent snapshots are NOT empty evidence.
- Owner/session changes reset all read evidence. Listener errors and cache or local-pending metadata revoke it. UI hydration, a successful build and an optimistic transaction result do not confer read authority.
- Proved serializations must exactly equal current React menu/shopping/progression values at user dispatch time. Pantry is gated separately by existing `getAuthoritativePantryForChef`. If any gate fails, Chef reports that it cannot verify the composite workspace; it does not invent numbers.
- Read-only selectors do not write food, shopping, finance, nutrition or medical data, create no AI API call and do not weaken existing Firestore transaction guards.

## Tests and evidence
- `tests/chefServerReadAuthority.test.ts`: covers owner scope, server metadata, local pending writes, invalid/duplicate rows, confirmed empty, composite exact UI equality, cross-account contamination and progression completeness.
- `tests/chefSignedInReadWiring.test.ts`: source integration/revocation guards.
- Existing guest Chromium harnesses test local modal facts and second-tab stale/corrupt data. **Hosted signed-in Auth/Firestore E2E and real Android microphone are NOT VERIFIED by these tests**. No claim of REAL E2E production behavior.
- Full QA GitHub CI `validate` + `runtime-harness` must pass at exact implementation SHA, then diff reviewed, no Vercel deployments, and only non-force fast-forward to Draft #453. Re-run full CI on final Draft HEAD before closure.

## Open
- Firestore hosted user-account isolation, UI/eventual consistency and listener behavior must be tested in a controlled hosted QA environment before beta.
- Guests still have best-effort localStorage WAL and no atomic cross-tab CAS (#459).
- Full conversational operator actions, health and beta release gates remain open (#452/#457/#474).
