# Chef IA — grounded recorded shopping list (2026-10-17)

## Purpose and authority
- Source base: functional Draft #453 `e3bb19146780cec5a4ed6016d6934fe644d8652b`, the prior Firestore transition-matrix implementation. Production/main remain unchanged.
- New action `SHOW_SHOPPING_LIST` recognizes a small exact ES/EN/BG phrase set for **what is on the recorded shopping checklist**, deliberately different from `SHOW_SHORTAGES` (a deterministic comparison of pantry vs planned recipes).
- Existing `VoiceChefView` read-only path and App-level `onGetAuthoritativeWorkspace` gate remain unchanged. A snapshot is usable only if **all guest persisted caches** are complete and match UI with no pending journal, or signed-in Firestore sources and owner-scoped UI are server-confirmed (including inventory). No separate model call, price lookup, purchase or pantry mutation.
- The answer returns the names of unchecked checklist rows (up to six, with an explicit remainder count) and the count of checked rows. **No checked item is represented as purchased**; even `purchaseAmountConfirmed` is not equivalent to a completed pantry application. No recorded quantity, unit, price or AI estimated amount is asserted as purchase-verified by this query.
- A list with zero unchecked rows means exactly *no pending items on the recorded list*, not *no food is missing* or a completed shop. Any duplicate ID, malformed amount or incomplete cache aborts the entire answer. Compound instructions such as "what's on my list and buy it" are not recognized as safe read intents.
- Current scope: literal conservative phrases; free-form conversational planning, automatic shopping updates and fully autonomous Chef mutations are NOT IMPLEMENTED by this slice.

## Automated gates
- `tests/chefWorkspaceFacts.test.ts`: ES/EN/BG exact read intent; compound/mutating phrasing refused; pending vs checked; no AI-estimated quantity nor financial claims; empty list; truncation; malformed/duplicate source fail-closed.
- `qa/runtime/guest-pantry-recovery.mjs`: browser Chef modal answers recorded pending list even with deliberately failed AI endpoint, does not claim checked entries as purchases or change persisted shopping; second tab corrupts progression source, both progress and shopping query must refuse results and preserve persisted bytes.
- Full CI `validate` + six local Chromium harnesses and Firestore Emulator read authority gate must pass at the candidate SHA and after controlled non-force FF into Draft #453.
- **No hosted Auth/Firestore E2E**, production merge, deployment, paid tools or Android physical microphone test. Guest cross-tab CAS and original intermittent warning QA issue #459 remain open.
