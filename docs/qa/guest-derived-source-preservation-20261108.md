# Guest derived source preservation — QA checkpoint (2026-11-08)

## Finding / impact
At functional Draft #453 HEAD `a6fa920d0d4c04c3495173290859f59ed166d3ff`, the guest hydration writers in `src/App.tsx` directly serialize current React recipes, meal plan, and progression ledger. The recipe and plan parsers intentionally filter malformed legacy rows, while the progression reader drops invalid/duplicate events and canonicalizes known fields. Without a complete-source check at those *writers*, the source snapshot can be replaced by a filtered/default view after ordinary hydration. The structural destructive-overwrite path is present in code; an incident involving real production data is **not verified**.

## Bounded proposal (not integrated)
Branch `fix/guest-derived-source-preservation-20261108` starts from Draft #453 via QA origin-warning checkpoint `d63fb7b8cbfa950e3782ab5800419eda232cfbf4`.

- Add `guestRecipeCacheIsComplete` and `guestMealPlanCacheIsComplete`: missing caches are allowed for first use; malformed/non-array or partially filtered existing arrays are not overwritten.
- Add `guestProgressionCacheIsComplete`: reject malformed, duplicate, partially filtered, or legacy-extra-field event sources that a canonicalizing parser would erase.
- In each of the three guest hydration effects, read stored raw before writing. When incomplete, **retain original bytes**, latch the existing derived consistency warning, block that writer, and let the user review. No "repair" by inventing events/recipes/food.
- Explicitly keep signed-in/Firestore code paths, pantry source, shopping source, AI, nutrition, prices, production, and `main` unchanged.
- Unit tests cover valid missing/empty/complete sources and invalid/duplicate/mixed legacy cases, plus writer wiring.
- Chromium local scenario seeds one invalid source at a time, verifies warning and exact-byte retention before and after reload, and checks confirmed pantry quantity remains intact. Existing six browser harnesses stay in workflow.

## Evidence and limits
- GitHub source review identified unguarded writer behavior; compare confirms limited branch changes.
- Static source checks performed against GitHub branch: all three helpers exported, imported and referenced before the affected writes; scenario included and called. **Static check is not a test-suite run.**
- **NOT RUN** in this continuation: full `npm test`, `npm run lint`, `npm run build`, Chromium harness, Firestore Emulator, hosted Firebase/Auth, or physical Android. This environment does not have the full Git checkout or network package installs. Treat runtime as **NO VERIFICADO** until exact-HEAD QA passes.
- No merge, PR-triggered CI, Vercel deploy, paid API or production action authorized/performed.
- Warning still does **not** provide assisted repair/export UI for these three caches; preserving bytes alone is not user-friendly recovery. Multi-key atomicity and true simultaneous cross-tab compare-and-swap remain out of scope and #459 remains OPEN.
- Feature packing / monetization remains not decided.

## Gate / next action
1. Run exact-HEAD lint, tests, build, six local Chromium scenarios and offline Firestore emulator in an authorized zero-surprise execution window; record true PASS/FAIL.
2. Review Chromium for unexpected writes on boot and false-positive warnings with valid existing caches; investigate any failing scenario instead of hiding a failure.
3. Only after green gates and diff review consider expected-SHA non-force promotion to Draft #453. No main merge until #457 release gates.
