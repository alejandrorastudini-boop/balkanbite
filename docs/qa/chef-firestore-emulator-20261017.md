# Chef IA — Firestore Emulator authenticated read gate (2026-10-17)

## Authority, intent and isolation
- Baseline: functional Draft PR #453 at `906435e33374868c936dd445fec6e362fb097dbc`; validated full CI #39015733044, 1,208 primary tests, 10 auxiliary tests and six local Chromium harnesses passed. `main=f6d6133149f585cf416cf5809d6280f6dc5486cd`, Production unchanged.
- Temporary branch `qa/chef-auth-firestore-emulator-20261017` uses **only the local Firestore Emulator** and synthetic owner/foreign UID. Never use an actual project URL, hosted credentials, Vercel deployment, named production DB or paid browser.
- Purpose: exercise the *real Firebase SDK* snapshots, metadata and owner-filtered rules — a stronger layer than passing literal metadata objects to pure functions, but still **not an Auth/Firestore hosted E2E or Android runtime proof**.
- No application runtime data mutations or Firestore rules change. One emulator probe is appended to the existing `firestore-rules.yml` job, not an extra paid service or hosted write workflow.

## Deterministic checks
- Seed synthetic owner inventory, meal-plan day, shopping row and one verified progress event using **emulator-only** security-rules-disabled fixture (not a hosted bypass).
- Subscribe using owner-authenticated Firestore SDK to inventory, mealPlans and shoppingList filtered by userId with metadata updates; subscribe to progression via the same `subscribeProgressionEvents` code path used by the app.
- Require server-confirmed sources, correct owner, exact React-shaped rows, no outstanding writes before producing pantry/composite Chef read witnesses.
- Refuse cross-account read attempts and a mismatched displayed inventory/shopping view, even if server data is valid.
- Add an invalid shopping row in the emulator; verify listener receives it and Chef denies the *entire* composite answer rather than silently omitting it; remove row and confirm authority recovers.
- Disable the local Firestore network; cached rows may continue to display but metadata must revoke read witnesses. Restore network, verify server-confirmed evidence returns.
- Tests do **not** prove atomicity across collections or genuine signed-in app UI interaction; cannot be used to claim beta readiness.

## Automatic regression trigger — follow-up
- The Firestore emulator workflow now watches the Chef authority selector, shared inventory edit verification, progression subscription, and the Firebase synchronization hook. Subsequent pull requests changing these files must run the authenticated SDK emulator, not only the ordinary unit/Chromium suite.
- `tests/chefEmulatorWorkflowCoverage.test.ts` ensures the workflow paths, emulator target guard and invoked QA script cannot be accidentally dropped without making normal CI red.
- This change affects CI configuration only: no application code, Firestore Rules publication, hosted writes, deployment or paid connector activation.

## Follow-up: real Firestore state transitions (2026-10-17)
- Additional isolated QA changes on branch `qa/chef-firestore-transition-matrix-20261017` exercise transitions beyond the initial static owner/foreign snapshot check. Still local emulator only.
- Inject a malformed progression event through emulator-only fixture; the actual app subscription's visible array may filter it, but strict Chef evidence must become unavailable until removed. This prevents declaring a partial event history complete.
- Inject a second physical Firestore mealPlans document carrying the same logical day. The query listener must reject duplicate logical keys, not accept the canonical/legacy UI deduplication as authoritative.
- Update owner inventory on the emulated **server** to a newer quantity/revision and reject an explicitly stale old React view; this checks the real listener-to-view echo boundary.
- Disable the SDK network; assert all relevant sources lose server authority. Queue a synthetic owner inventory update offline and assert actual `hasPendingWrites` metadata plus absence of Chef read authority; reconnect, await the permitted revisioned write and fresh confirmed listener echoes before allowing reads again.
- Keep all test writes inside `demo-balkanbite-chef-read` Firestore Emulator, no hosted project, no actual users, no production code/rules mutation. This is stronger SDK integration QA, **not** hosted Auth/Firestore E2E, not multi-collection atomic snapshot proof.
- Require both GitHub CI and Firestore emulator success on exact QA commit, then safe Draft #453 fast-forward and repeat exact-head gate; root cause of guest browser intermittency #459 remains open.

## Gate and next work
- Require GitHub `owner-isolation` emulator job SUCCESS and normal `validate` / six local Chromium harnesses SUCCESS on the exact SHA.
- Review changed files, zero QA Vercel deployments, preserve existing rules, maintain Draft PR #453; close temporary QA PR without merging to main.
- Hosted signed-in two-account E2E (#457), cross-tab guest CAS (#459), physical microphone, typed actions/approval (#474) remain OPEN.
