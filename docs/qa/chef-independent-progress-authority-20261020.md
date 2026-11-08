# Chef IA — independent verified progression history (2026-10-20)

## Problem and scope
SHOW_PROGRESS previously required healthy inventory/menu/shopping sources despite counting only deterministic progression events. Invalid unrelated rows could block valid counts.

- ES/EN/BG standalone read-only answers from complete valid unique recorded events; purchases applied and pantry-deducting cooks only. No nutrition, diet, budget, price, total purchases or inferred habit claims.
- Guest: correct session and scope, no recovery/journal; full canonical event array matches the current React ledger, with unchanged raw localStorage verification and no silently filtered events.
- Signed-in: actual Firebase Auth UID + session UID, server-confirmed unfiltered progression subcollection witness and exact UI echo, without unrelated collection gates. No new listener.
- Invalid, duplicate, cached, pending or stale evidence fails closed; no automatic writes or paid model API calls.

## Tests and limitations
- tests/chefIndependentProgressAuthority.test.ts covers labels, duplication, unverified events, owner/session, stale UI and wiring.
- qa/security/chef-read-authority-emulator.mjs adds SDK-based owner isolation, unrelated shopping/menu invalidity, invalid progression and offline revocation.
- qa/runtime/guest-pantry-recovery.mjs exercises real guest Chef modal with AI endpoint unavailable, corrupt shopping but intact progression and invalid source rejection.
- Require exact-SHA CI and emulator SUCCESS before non-force fast-forward into functional Draft #453, then close temporary QA PR without merge.
- NOT verified: hosted Firebase multi-user E2E, real Android microphone, cross-tab CAS, complete conversational operator. main and Production unchanged.
