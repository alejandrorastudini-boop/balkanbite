# BalkanBite — Chef IA operator capability map (QA checkpoint, 2026-10-16)

This file is **operational QA evidence**, not a permanent architecture decision or proof of release readiness.

Tracking issue for the full conversational operator: [#474](https://github.com/alejandrorastudini-boop/balkanbite/issues/474).

## Verified code baseline
- Base: Draft PR #453 at `8e44d1054728c68383555833303e29de366713ef`.
- Production/main remains `f6d6133149f585cf416cf5809d6280f6dc5486cd`.
- This checkpoint lives **only** on `qa/guest-cross-tab-interleavings-20261016`; the branch has not been merged.
- Existing baseline CI (prior to this QA branch): functional #38948022613 and independent QA #38947417963, both SUCCESS on the base commit.
- No CI, Android microphone, hosted Firestore E2E or preview runtime verification may be inferred for the new branch unless separately recorded.

## Chef IA implemented scope BEFORE this QA slice

| Capability | Reality | Evidence / limitation |
|---|---|---|
| Visible floating assistant/modal and text input | PARCIAL | `ChefIaFloatingButton`, `ChefIaModal`, `VoiceChefView` exist and are wired in `App`; UI is not a full operator. |
| Speech recognition | NO VERIFICADO | `VoiceChefView` uses browser SpeechRecognition/webkitSpeechRecognition; no real Android mic QA in this checkpoint. |
| Voice/text interpretation | PARCIAL | `POST /api/ai/parse-intent` uses six intents: `MEAL_LOG`, `RECIPE_RECOMMENDATION`, `ADD_ITEMS`, `REMOVE_ITEMS`, `ADD_SHOPPING`, `ANSWER`; this is not a typed whole-app action planner. |
| Guest confirmed removal | REAL E2E LOCAL (specific path) | Existing Chromium harness exercises Chef modal with mocked parser, user confirmation, signed mutation receipt, WAL fault/recovery. Not free speech or whole-app navigation. |
| Pantry or shopping addition after review | PARCIAL | Explicit confirmation callbacks exist; cross-tab concurrency and hosted behavior not fully verified. |
| Navigate to recipes from a recommendation | PARCIAL | `onNavigateToRecipes` switches tab, may generate AI recipes. No general navigation action contract. |
| General tab navigation by conversation | NO IMPLEMENTADO in base | No `NAVIGATE_TAB` in prior action union or Chef callbacks. |
| Weekly menu modification / changing meal | NO IMPLEMENTADO as Chef operator | No typed Chef action execution or confirmation contract for this mutation. |
| Budget modification by speech | NO IMPLEMENTADO as Chef operator | No budget action contract; financial numbers must never be inferred. |
| Display expiry, shortfalls, progress from authoritative state | NO IMPLEMENTADO as typed Chef query | General `ANSWER` text is not sufficient proof of a grounded domain query. |
| Persist nutrition from free-form meal description | NOT ENABLED | Server intentionally strips `mealLog` for AI `MEAL_LOG` until verified deterministic nutrition inputs exist. |
| App-wide navigation/action plan and visual step lifecycle | NO IMPLEMENTADO | No permissioned general planner/executor, view actions, scoped multi-step confirmation or progress UI. |

## New QA-only slice (implementation exists, validation pending)

- `src/utils/chefNavigationIntent.ts`: small finite `NAVIGATE_TAB` contract, six read-only destinations (pantry, shopping, mealPlan, recipes, home, profile). Explicit phrase matching in ES/EN/BG. Rejects compound and mutating utterances. No IA call needed for recognized phrases.
- `VoiceChefView`, `ChefIaModal`, `App`: send a grounded navigation feedback message, change active tab and close the covering modal to reveal destination. This **is not** persistent hands-free control over the entire app.
- `VoiceChefView`: reject HTTP errors/`success:false` from parser instead of presenting a generic processed-success reply.
- SpeechRecognition cleanup: abort the browser recognizer on component unmount or language change; Chromium QA uses a synthetic recognizer to assert abort on visible navigation. This does **not** verify the Android physical microphone.
- `tests/chefNavigationIntent.test.ts`: positive/negative read-only parser contract.
- `qa/runtime/guest-pantry-recovery.mjs`: Chef local navigation and explicit 503 browser scenario.
- Tests are not considered passing until their full run on the exact QA SHA completes.

## Guest cross-tab concurrency

Five guest WAL keys share best-effort preflight exclusion. `writeGuestPantrySafely` also rejects a stale expected snapshot. There is **no atomic compare-and-swap or mutex** around the cross-key transaction. No claim of serializability/atomicity is justified.

New QA-only tests:
1. `tests/guestCrossTabInterleavings.test.ts` uses two independent storage adapters on shared bytes. Staging hooks force *purchase wins before voice marker is published*, and *voice wins before purchase marker is published*. Expected: losing operation is blocked, no invented receipt or progression, stale staged journal remains explicit for review.
2. `qa/runtime/guest-pantry-recovery.mjs` exercises two **real Chromium tabs** sharing localStorage. One voice removal is paused by a silent receipt write failure; another tab must refuse the purchase. Reload completes receipt recovery without re-deducting, and the refreshed purchase is then expected to apply exactly once.

These scenarios verify selected interleavings only; they **do not** eliminate the gap between snapshot preflight and writes. A successful test cannot prove arbitrary cross-tab atomicity. Require a separate design for cross-tab coordination (for example Web Locks with capability/fallback policy) before treating simultaneous mutations as safe. Keep recoverability and legacy browsers in scope.

## Next gates, in order

1. Run `npm test` on the exact QA head. Investigate any type, recipe-cache, shopping or progression fixture disagreements; do not weaken expectations to force green.
2. Run `npm run lint`, `npm run build`, serverless smoke, and six Chromium harnesses, including injected two-tab failure. Save run URL, SHA and evidence.
3. Review branch diff, no production secrets or data, no Firestore rules/billing/deployment changes, and all warnings/recovery behavior.
4. Only after validation, fast-forward the Draft PR #453 branch using a non-forced update with exact expected head; rerun CI on that exact PR SHA. Keep `main` unchanged.
5. Separately design persistent visible conversational operator: read-only grounded queries -> typed action plan with versions and scoped permissions -> confirmation of risky mutations -> deterministic domain writes -> UI progress/receipt -> recoverable failure. Do not promote `NAVIGATE_TAB` into whole-app agent marketing.

## Strict exclusions
No Production deployment, Firestore Rules edit, paid AI/browser automation, new commercial plans, account or health data guessing, automatic cross-tab conflict repair or silent journal deletion.
