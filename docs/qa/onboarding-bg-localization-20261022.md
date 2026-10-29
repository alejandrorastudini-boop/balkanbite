# Bulgarian first-run onboarding copy — QA 2026-10-22

## Verified source finding
The four-step `OnboardingModal` on functional Draft #453 `8b032ced62bc30727683a6f4a69d16a3d190cd19` partially showed Spanish/English text even when `language="bg"`: progress "Paso", household/name prompts, culinary diet labels, all "Atrás" back buttons, cooking speed, appliance descriptions, and monthly budget heading. This impedes Bulgaria-first usability; it does not mean the backend or user data is broken.

## Scoped change
- Localize the remaining four-step culinary UI into BG while retaining ES and EN paths.
- Deliberately preserve **legacy appliance keys** `Airfryer`, `Horno`, `Thermomix / Robot`, `Microondas`, `Sartén / Vitro` in the persisted `selectedAppliances` array; Bulgarian `Фурна` is only a display label, **not** a new storage key.
- Maintain explicit household size, diet preference and cooking speed selection; blank budget stays absent, never zero or estimated.
- Keep legacy allergy/intolerance and restrictive diet capture disabled and show the existing tri-lingual food-safety notice; no medical/allergen-safety claims and no new sensitive data.
- The isolated fresh-guest QA harness accepts `?lang=bg` only on its test route, with EN default unchanged. In 390px Chromium startup acceptance, a Bulgarian first-run journey verifies all steps, the saved legacy appliance key, no default budget, and modal closure. Screenshot files are separate.

## Gates
Require QA branch exact SHA lint/tests/build, all six Chromium browser harnesses, and Firestore emulator SUCCESS before non-force expected-SHA FF into Draft #453. Does NOT prove physical Android, hosted Firebase, every page localization or broader GDPR safety gate.
No Production, `main`, paid tooling or new provider integration. MVP gate #457 remains open.
