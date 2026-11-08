# Guest-first: explicit read-only local data download (2026-10-24)

## MVP release gate addressed
Issue #457 allows a private guest-first beta only if limitations are explained and **backup/export local actually works**. The current UI only offered recovery download for a quarantined pantry; a healthy guest could not export the whole local workspace.

## Scoped change
- Add one explicit button in the guest Profile screen, in BG/ES/EN; no automatic export and no uploaded information.
- Download a JSON archive of whitelisted **raw localStorage keys**, including pantry, recipes, weekly menu, shopping, progress, meal logs, chat, local profile, pantry original quarantine and known pending local mutation journals. Each value is a raw string or `null` when absent. No fabricated measurements, unit conversions or normalization. Malformed historical bytes remain verbatim.
- Never include arbitrary localStorage keys, Firebase credentials or authenticated scoped data. The App callback exists only for confirmed guest scope with loading/reset guards.
- Two full reads block obvious changes during capture. Browser localStorage **has no atomic cross-tab snapshot**; a downloaded file may still be inconsistent if tabs change concurrently. The file may contain personal/health data, users must keep it secure.
- **There is no import/restore implementation**. UI and machine-readable export explicitly say so. This does not complete the guest-first backup/recovery release gate; tested import, safety/privacy, multi-tab and real mobile export still remain unverified.

## QA
`tests/guestLocalExport.test.ts`: raw preservation, keys, missing/null, stale second read, restricted storage, auth gating wiring.
Chromium `qa/runtime/guest-pantry-recovery.mjs`: download from real guest profile on local preview; inspect file and compare source bytes, no change to localStorage. Require exact-SHA full CI and Emulator, as always. No main merge, deployment or paid tools.
