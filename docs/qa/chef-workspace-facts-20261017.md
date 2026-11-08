# Chef IA grounded workspace facts — QA checkpoint (2026-10-17)

## Scope
- Base: Draft PR #453 `c9052abe34f4d8157612d739319ca62e8595cd40` (CI #39002421326 both jobs SUCCESS). `main=f6d6133149f585cf416cf5809d6280f6dc5486cd` remains unchanged.
- QA branch: `qa/chef-workspace-facts-20261017`, not authorized for merge to main or any deployment.
- Three bounded, exact ES/EN/BG text/recognized-voice commands: `SHOW_MENU` (actual recorded meals next 7 local days, not consumption); `SHOW_SHORTAGES` (deterministic advisor missing/insufficient quantities for planned meals today through +2 days, with unverified and expiry-review counted separately, without invented prices); `SHOW_PROGRESS` (valid event ledger counts only, not nutrition score).
- **Guest-only factual authority** in this slice. An App-level read callback requires a verified pantry plus complete saved, non-filtered, unchanged mealPlan/shopping/progression JSON matching React state; rejects pending guest WAL, source races, corrupt legacy records. Signed-in composite queries refuse to assert facts until a combined account-scoped server confirmation exists for all relevant modules.
- Read queries do not write or call AI. Fail-closed messages are explicit and localized. A future conversational operator must use typed actions and confirmations rather than claiming its generative answer is a persisted state.

## Gates / verification
- `tests/chefWorkspaceFacts.test.ts`: 3-language closed phrases, compound mutation rejection, seven-day menu limits, deterministic verified shortfall vs unit uncertainty, no fabricated financial/health values, event counts, invalid/colliding records.
- Existing runtime `qa/runtime/guest-pantry-recovery.mjs`: browser Chef modal with failed mocked AI; verifies menu, shortage and progress answers; another tab contaminates persisted progression and ensures query refuses to answer while preserving unverified bytes and pantry.
- CI MUST pass `validate` (main tests, auxiliary, lint/typecheck/build/serverless smoke) and `runtime-harness` (six local Chromium suites) at exact QA SHA. Review file diff and Vercel deployment list.
- Only then non-force fast-forward Draft #453 and rerun CI at its new head. Close temporary QA PR without merging main.

## Verified QA and integration checkpoint — 2026-10-17
- Implementation QA SHA `514c0db18006eebd808b120692575b782f1f6a9b` passed [GitHub Actions #39004424099](https://github.com/alejandrorastudini-boop/balkanbite/actions/runs/39004424099): `validate` SUCCESS (**1,196/1,196** main tests + ten auxiliary; lint/typecheck, build, real serverless smoke) and `runtime-harness` SUCCESS (all six local Chromium suites, including the new guest Chef workspace scenario).
- Exact diff from prior PR #453 HEAD `c9052abe`: seven files, no workflow, package, Firestore Rules, secrets or billing changes. Zero Vercel deployments recorded for QA branch.
- Fast-forward to existing Draft #453 performed non-forcibly with exact expected head. Temporary QA PR #477 must be closed without merging to `main`. No Production release.
- This documentation-only checkpoint itself advances Draft HEAD. A fresh exact-SHA `validate` and `runtime-harness` SUCCESS is required before considering the new Draft checkpoint fully validated.

## Open risks
- localStorage no atomic cross-tab CAS; validation is best-effort and cannot guarantee arbitrary interleavings (#459).
- Signed-in multi-module query authority is **NOT IMPLEMENTED**, not silently approximated by React caches.
- Real Android microphone, hosted Firestore Auth isolation, health safety, beta gates and full Chef app control remain open (#452/#457/#474).
