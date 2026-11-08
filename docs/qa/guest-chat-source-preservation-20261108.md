# Guest Chef chat source preservation — QA checkpoint (2026-11-08)

## Code finding
In functional Draft #453 `a6fa920d0d4c04c3495173290859f59ed166d3ff`, `parseChatMessageCache` filters invalid historical rows and removes malformed/unknown metadata. The guest `App.tsx` effect previously persisted that sanitized React array back into `balkanbite_chat_messages` without checking whether it was a complete source. This is a **structural risk of historical source loss** on hydration; actual data loss in Production remains **NO VERIFICADO**.

## Isolated proposed fix
Branch `fix/guest-chat-history-source-preservation-20261108` starts from unchanged Draft #453.

- `guestChatCacheIsLossless(raw)` accepts missing/fully valid JSON histories, but rejects non-arrays, malformed rows, duplicate IDs, stripped optional metadata, or unknown legacy fields. Semantic equality ignores object key order; it does not fabricate chat contents.
- The guest-only history writer checks both the persisted original and the proposed next array, commits and reads back exact bytes before treating storage as confirmed; on failure it preserves original local data and latches a **BG/ES/EN** warning. The UI does not promise unsaved new messages are durable.
- External `storage` event for chat, or global `localStorage.clear()`, latches review in the other guest tab. No automatic merge or rollback; originating tab should not falsely warn.
- Both Chef IA "Clear conversation" entrypoints now use a **persist-first** guest clear: check complete/unchanged current source, commit `[]`, verify exact readback, and only then clear React. On failure, keep the visible history and explain that deletion was not confirmed. Signed-in clear behavior is unchanged.
- Local Chromium harness scenarios: malformed legacy metadata retained on hydration and reload; valid source has no false warning; external tab changes produce proactive stale warning without overwriting newer chat bytes; reload can rehydrate complete source.
- Unit and wiring tests cover complete/malformed/duplicate/unknown sources event listener registration/cleanup, and persist-first clear wiring for both UI entrypoints.
- No AI calls, voice authority change, Firestore writes, pricing, or authenticated schema change.

## Validation boundary
Static source/diff inspection completed. **NOT RUN:** `npm test`, lint/typecheck, build, six Chromium harnesses, emulator, Android or hosted auth. This branch is **NOT VALIDATED** for runtime, has no merge into Draft #453/main, and must not trigger PR/Vercel deployments or paid tools until the exact SHA validation plan is approved. `[skip ci]` used on branch commits.

## Remaining scope and dependency
History export includes raw chat bytes through `src/utils/guestLocalExport.ts`, but restoration/review UI is still absent. This change does not make localStorage atomic; simultaneous interleaving between the final source read and write remains a bounded race. Browser QA is required for quota/lost-write clear failures as well. Separate guest profile/HealthProfile legacy-source normalization deserves a dedicated non-destructive audit before modifying sensitive data. Exact-HEAD CI + browser QA and manual Android review remain release gates (#457).
