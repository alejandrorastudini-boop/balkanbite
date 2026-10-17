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

## Gate and next work
- Require GitHub `owner-isolation` emulator job SUCCESS and normal `validate` / six local Chromium harnesses SUCCESS on the exact SHA.
- Review changed files, zero QA Vercel deployments, preserve existing rules, maintain Draft PR #453; close temporary QA PR without merging to main.
- Hosted signed-in two-account E2E (#457), cross-tab guest CAS (#459), physical microphone, typed actions/approval (#474) remain OPEN.
