# Guest voice receipt coverage in raw local export — 2026-10-24

Baseline functional Draft #453 `e517b1c23239c397e1efc26b4218a961663121a1`.

Code finding: the explicit read-only local export included `balkanbite_guest_voice_removal_intent_v1` but omitted `balkanbite_guest_voice_removal_receipts_v1`, the persisted mutation-ID receipts used to prevent duplicate application of confirmed voice consumption. The exported archive therefore omitted part of the local anti-duplication evidence.

Fix: add the existing receipt key to the raw export allowlist, keeping bytes exactly as stored. Unit tests assert the canonical source constant, byte-exact inclusion and concurrent-read failure. Chromium guest profile download seeds synthetic receipts and verifies archive byte equality and unchanged localStorage. No restore is implemented; export remains best-effort and not a cross-tab atomic snapshot.

Gate: QA-only, exact SHA lint/test/build and 6 Chromium harnesses plus Firestore emulator before expected-SHA non-force fast-forward to Draft #453. Do not merge to main, deploy production or spend money. #459 remains open.
