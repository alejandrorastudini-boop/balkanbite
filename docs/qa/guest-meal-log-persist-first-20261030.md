# Guest meal history — explicit storage confirmation, no filtered overwrite (2026-10-30)

## Finding
Functional Draft #453 at `67c607eed23d541dc47848f3672c8caa506ea24c` returned success after `setMealLogs` for a new guest meal; the separate effect asynchronously wrote the entire `balkanbite_meallogs` array, caught errors without surfacing them, and could overwrite historical rows that `parseMealLogCache` silently filtered/normalised. This is unsafe for actual consumption history and unverified nutrition.

## Scoped fix
- Guest meal log addition now performs a complete-source check, unique ID check, synchronous `setItem`, exact readback, **then** publishes React and returns success. Silent or thrown quota errors never produce a saved meal.
- Require every existing stored row to be losslessly representable by `sanitizeStoredMealLog`; unknown fields/legacy numeric estimates and malformed rows remain untouched for review. Property order alone does not matter.
- The guest hydration effect now checks source equality instead of rewriting it. An absent, empty guest log stays absent. On mismatch or cross-tab history change, show BG/ES/EN warning and block new log writes until reload/review.
- A meal's identity can be authoritative without nutrition. Never add invented calories, macros, diagnoses, prices or timestamps beyond the existing explicit log action. Authenticated server mutation remains unchanged.

## Boundaries
This does not implement recovery/import of malformed historic rows or atomic CAS across tabs, and does not prove a physical Android/hosted end-to-end log creation. Other guest sources remain controlled by separate gates. #459 and #457 remain open.

## Gate
Exact SHA tests/lint/build with existing six Chromium harnesses and offline Firestore Emulator, diff review, safe FF to Draft #453 only after success, close QA PR without main merge. No deployment, hosted user writes or paid tooling.
