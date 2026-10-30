# Local guest archive inspection — 2026-10-24

Issue #457 requires practical guest backup and recovery. Functional Draft #453 at `e132060c2532fbea4653a7353f73492568a9f536` can download raw guest data but has **no restore**.

This slice adds an explicit device-local, read-only JSON *structure inspection*, which recognizes only the declared v1 guest format, metadata and all allowlisted string/null keys. Malformed historical bytes inside raw keys are accepted verbatim, not silently corrected. Foreign version/scope, missing fields or extra unexpected keys fail closed.

Picker reads at most 32 MiB to protect resource-constrained devices; larger files are **uninspected, not declared damaged**. No upload, storage write, health inference, credential exposure, auto-import or hidden background restoration. A recognized file does not establish consistency between tabs, cryptographic integrity, completeness, provenance or recoverability.

Unit and Chromium profile download/inspect flows must pass exact-SHA lint/test/build, all six browser harnesses and Firestore Emulator before promotion into Draft #453. No Production/main changes or paid tools. Issue #457/#459 remain OPEN.
