# Chef IA — signed-in pantry server-echo accuracy (2026-10-17)

## Baseline / scope
- Functional Draft PR #453 base `cd7963c84e5444cedd59d12b2ee100e2ed4db965`, exact-head CI #39014787273 SUCCESS (1,203 main tests, 10 auxiliary, 6 Chromium). `main=f6d6133149f585cf416cf5809d6280f6dc5486cd` and Vercel Production unchanged.
- Branch `qa/chef-signedin-pantry-snapshot-20261017` exists exclusively for local automated QA; DO NOT MERGE INTO MAIN OR DEPLOY.
- Problem: the signed-in Chef pantry read path previously checked `inventoryHydrated && inventoryServerConfirmed` and account scopes, then handed React's `pantry` directly to factual selectors. A server metadata flag alone does not prove React has echoed **the same** newest inventory snapshot. This creates a stale-read window even though ordinary inventory edits use stronger revision/lot validation.

## Bounded fix
- Reuse existing owner-filtered inventory listener and `verifyServerInventoryForEdits` to build a separate **Chef-only server-read witness** from a fully server-confirmed snapshot: no cache/pending writes, every active lot canonical and stock-verifiable.
- Exclude tombstones exactly as the existing UI listener. Require every active row to pass the existing strict pantry shape validation, with no silently dropped legacy demo/duplicate/invalid source. No invented expiration, quantity or household data.
- Require `JSON.stringify(serverVisibleRows) === JSON.stringify(currentReactPantry)`, current Auth uid and listener account scope before returning a factual Chef pantry snapshot. Await the actual UI echo when the server snapshot has changed; never automatically replace old UI with an unreviewed new quantity.
- Revoke witness on cache/pending metadata, listener error, unsubscribe and auth switch. This is **read-only**; does not modify Firestore writes, shopping, nutrition, health, migration rules, billing or AI calls.
- All five existing Chef read-only intents (`SHOW_PANTRY_ITEMS`, `SHOW_EXPIRING`, `SHOW_MENU`, `SHOW_SHORTAGES`, `SHOW_PROGRESS`) now depend on a proven signed-in pantry view, preventing signed-in mixed old-stock/new-menu answers. Guest mode is unchanged.

## Implementation QA — 2026-10-17
- Exact implementation SHA `99bb3a42925fc0926d31a575db39c9377dcea4ff` validated in [CI #39015473385](https://github.com/alejandrorastudini-boop/balkanbite/actions/runs/39015473385): both `validate` and `runtime-harness` SUCCESS, **1,208/1,208** main tests, **10/10** auxiliary, lint/typecheck/build/serverless smoke, **6/6** local Chromium suites.
- Incremental review vs previous verified Draft #453 `cd7963c8`: five files (App, Firebase hook, pure selector, its tests, this QA document); no Firestore rules, permissions, packages, secrets, workflows or billing modifications; no QA branch Vercel deployments.
- Non-forced fast-forward to Draft #453 was completed against expected previous head. Temporary QA PR #480 is to be closed without merging to main. This documentation-only commit advances the final Draft HEAD, which must be revalidated by the exact-SHA CI before checkpoint closure.
- **Important limit:** a green local Chromium suite does not execute a hosted signed-in Firebase Auth session. The signed-in read authority remains implemented and locally tested, but hosted E2E **NOT VERIFIED**.

## Verification requirements
- `tests/chefServerPantryRead.test.ts`: exact server view, stale quantity/name or empty UI refusal, cross-account guards, cache/pending flags, foreign/missing ownership, noncanonical legacy-only stock, malformed fields, confirmed empty/tombstones and hook/App wiring.
- Full GitHub CI `validate` plus all six local Chromium `runtime-harness` suites must pass at exact QA implementation HEAD, then review diff and no deployments. Non-force fast-forward to Draft #453 ONLY, close QA PR without merge, rerun final exact SHA.
- Hosted signed-in Firestore E2E still **NOT VERIFIED**; no hosted write workflow, Production change, Firebase Rules release, paid TinyFish or QA accounts used.
- Existing #459 guest cross-tab WAL and original intermittent Chromium warning timeout remain unresolved; this slice does not claim to fix them.
