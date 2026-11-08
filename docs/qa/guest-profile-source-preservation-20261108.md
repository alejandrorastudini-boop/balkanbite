# Guest profile / HealthProfile raw-source preservation — checkpoint 2026-11-08

## Scope
Source is functional Draft #453 at validated SHA `c1e8c514893a3992da24f63ce7d7bef2f8d6474d`. Work in this isolated branch addresses #519 only; it is not yet promoted to Draft or to production.

Guest `parseGuestProfileCache` sanitizes a stored object, removes unrecognized keys, normalizes preferences and health data, while `App.tsx` previously wrote the sanitized React view to `balkanbite_profile` on hydration. This can silently overwrite legacy raw bytes and health/allergen evidence that the current schema cannot represent. Actual user loss is **not verified**.

## Proposed code
- `guestProfileCacheIsLossless` compares each originally present field (including nested HealthProfile data) with its sanitized representation using order-independent JSON object keys. Missing fields are valid; unknown/normalized-away values, legacy top-level body metrics, unsupported status/provenance metadata, and malformed caches are held for review. No defaults or clinical values are invented.
- `guestProfileCacheMatchesSnapshot` rejects a different but otherwise valid profile source before guest writes.
- Existing guest profile updates are persist-first and readback verified; only then does React state change or the UI claim success. Effect-based hydration writers are also gated.
- Other-tab `storage` events and bulk clear latch a guest-only warning (BG/ES/EN); signed-in profile Firestore owner path is unchanged.
- Unit tests use fake QA values and explicit `unknown`/`prefer_not_to_say` health states; local Chromium QA verifies exact legacy raw bytes survive reload and complete current HealthProfile does not warn.

## Safety and limitations
- Source-preservation alone does **not** provide a guided restore/migration UI, cross-tab compare-and-swap, atomic multi-key writes, or certification of medical/nutritional advice.
- The UI may present sanitized display values while original legacy source is held; allergy-sensitive recommendations must not be presented as medically safe. No guarantee about possible legacy health meaning can be made.
- No real health data, account secrets, AI calls, paid providers, hosted Firebase, Vercel or production writes in test fixtures.
- `main`, Draft #453 and QA backup branch remain unchanged until exact SHA gates pass.

## QA gate
Run `npm run lint`, `npm test`, `npm run build`, six local Chromium scripts (including added profile scenario) and offline Firestore Emulator on the exact commit. Static source checks are not a replacement. If QA passes, compare the delta to Draft #453, preserve reversible checkpoint and advance Draft by expected-SHA fast-forward only. Hosted/Android E2E remain #457.

## CI execution request
Draft QA PR into `main` is for running the public-repository free GitHub Actions gates only. Vercel automatic deployments for `fix/**` are disabled in `vercel.json`. Do not merge or release this branch from the QA PR.
