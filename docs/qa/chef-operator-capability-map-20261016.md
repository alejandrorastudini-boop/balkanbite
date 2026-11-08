# BalkanBite — Chef IA operator capability map (QA checkpoint, 2026-10-16)

This file is **operational QA evidence**, not a permanent architecture decision or proof of release readiness.

Tracking issue for the full conversational operator: [#474](https://github.com/alejandrorastudini-boop/balkanbite/issues/474).

## Verified code baseline
- Base: Draft PR #453 at `8e44d1054728c68383555833303e29de366713ef`.
- Production/main remains `f6d6133149f585cf416cf5809d6280f6dc5486cd`.
- The implementation was validated on QA branch `qa/guest-cross-tab-interleavings-20261016` at `d2a36819eac0319afa5fd4d441feae4d23c89ed7` and fast-forwarded **without force** onto Draft PR #453. `main` has not changed.
- Existing baseline CI (prior to this QA branch): functional #38948022613 and independent QA #38947417963, both SUCCESS on the base commit.
- QA [CI #38957101825](https://github.com/alejandrorastudini-boop/balkanbite/actions/runs/38957101825) on `d2a36819` completed SUCCESS for `validate` and `runtime-harness`: 1,181/1,181 main tests, auxiliary tests, lint/typecheck/build, serverless smoke, all six local Chromium harnesses. Physical Android microphone, hosted Firestore and whole-app operator remain **NOT VERIFIED**.

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

## Incremental read-only Chef slice — LOCAL CHROMIUM VERIFIED, not Production

- `src/utils/chefNavigationIntent.ts`: small finite `NAVIGATE_TAB` contract, six read-only destinations (pantry, shopping, mealPlan, recipes, home, profile). Explicit phrase matching in ES/EN/BG. Rejects compound and mutating utterances. No IA call needed for recognized phrases.
- `VoiceChefView`, `ChefIaModal`, `App`: send a grounded navigation feedback message, change active tab and close the covering modal to reveal destination. This **is not** persistent hands-free control over the entire app.
- `VoiceChefView`: reject HTTP errors/`success:false` from parser instead of presenting a generic processed-success reply.
- SpeechRecognition cleanup: abort the browser recognizer on component unmount or language change; Chromium QA uses a synthetic recognizer to assert abort on visible navigation. This does **not** verify the Android physical microphone.
- `tests/chefNavigationIntent.test.ts`: positive/negative read-only parser contract.
- `qa/runtime/guest-pantry-recovery.mjs`: Chef local navigation and explicit 503 browser scenario.
- The exact QA SHA `d2a36819` passed full GitHub Actions CI and all six local Chromium harnesses, including real modal navigation/recognizer abort and two-tab WAL recovery. These checks use a simulated `/api/ai/parse-intent` response where applicable; no real microphone/paid IA E2E was performed.

## Guest cross-tab concurrency

Five guest WAL keys share best-effort preflight exclusion. `writeGuestPantrySafely` also rejects a stale expected snapshot. There is **no atomic compare-and-swap or mutex** around the cross-key transaction. No claim of serializability/atomicity is justified.

New QA-only tests:
1. `tests/guestCrossTabInterleavings.test.ts` uses two independent storage adapters on shared bytes. Staging hooks force *purchase wins before voice marker is published*, and *voice wins before purchase marker is published*. Expected: losing operation is blocked, no invented receipt or progression, stale staged journal remains explicit for review.
2. `qa/runtime/guest-pantry-recovery.mjs` exercises two **real Chromium tabs** sharing localStorage. One voice removal is paused by a silent receipt write failure; another tab must refuse the purchase. Reload completes receipt recovery without re-deducting, and the refreshed purchase is then expected to apply exactly once.

These scenarios verify selected interleavings only; they **do not** eliminate the gap between snapshot preflight and writes. A successful test cannot prove arbitrary cross-tab atomicity. Require a separate design for cross-tab coordination (for example Web Locks with capability/fallback policy) before treating simultaneous mutations as safe. Keep recoverability and legacy browsers in scope.

## Verification and checkpoint — 2026-10-16

- Initial QA CI [#38956546391](https://github.com/alejandrorastudini-boop/balkanbite/actions/runs/38956546391) passed full `validate` but failed one **new QA harness assertion**. The second real Chromium tab legitimately attempted eager voice journal recovery on detecting a pending WAL; the test incorrectly expected the marker to remain pending after that attempt.
- Fixed the test by injecting the same silent **receipt write failure in both tabs**, preventing early successful recovery while the test verifies purchase exclusion. No production persistence code was weakened or changed to satisfy the test.
- Rerun [#38957101825](https://github.com/alejandrorastudini-boop/balkanbite/actions/runs/38957101825) on **exact QA commit `d2a36819eac0319afa5fd4d441feae4d23c89ed7`**: both jobs SUCCESS; **1,181/1,181** main tests, 10 auxiliary tests, lint/typecheck, build, serverless smoke, six browser harnesses (including guest two-tab recovery and Chef navigation).
- Additional local isolated reproduction (pure navigation parser only): three tests PASS and TypeScript PASS, mirrored source `git hash-object` matched GitHub blob SHA `64396fc02b1222cc3bc2a1e6e41d6379cbab4cd8`. Full CI supersedes this narrow precheck.
- Exact incremental diff to former Draft #453 HEAD `8e44d105`: eight files. No changes to Firestore Rules, dependencies, CI workflow or secrets. QA PR [#475](https://github.com/alejandrorastudini-boop/balkanbite/pull/475) exists only as a temporary CI trigger; do NOT merge it into `main`.
- Draft #453 was non-force fast-forwarded to the already-verified `d2a36819`. **The documentation update itself requires a new CI at the latest Draft HEAD** before considering the Draft checkpoint validated. Production/main remains `f6d6133149f585cf416cf5809d6280f6dc5486cd`.
- Six Chromium harnesses verify selected local UI/storage paths, not arbitrary simultaneous cross-tab atomicity, real STT quality on Android, full conversational autonomy or hosted identity isolation.

## Next gates

1. Confirm the latest exact Draft PR #453 SHA (including this documentation-only commit) has `validate` + `runtime-harness` SUCCESS.
2. Close temporary QA PR #475 **without merging into main** once evidence is preserved.
3. Keep #452, #457 and #459 open. Address the remaining guest concurrency guarantee (localStorage has no CAS), historical data gaps and hosted Auth/Firestore tests separately.
4. For Chef IA issue #474, next smallest valuable capability is grounded read-only questions (what is in pantry, expiry/shortage, plan/progress) backed by deterministic selectors, not LLM-fabricated state. Then typed multi-step proposals with explicit confirmation, robust UI progress and audited mutations.
5. Never label the full app conversationally controllable until mobile/hosted E2E and risk gates are met.

## Strict exclusions
No Production deployment, Firestore Rules edit, paid AI/browser automation, new commercial plans, account or health data guessing, automatic cross-tab conflict repair or silent journal deletion.
