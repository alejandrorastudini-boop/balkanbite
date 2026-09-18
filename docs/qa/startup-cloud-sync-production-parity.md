# Startup cloud-sync production parity

## Scope

This release candidate is limited to removing the blocking startup cloud-sync gate while retaining the inventory safety boundaries already covered by `tests/startupCloudSyncRuntime.test.ts`.

User-provided mobile evidence from 2026-09-18 shows that production at main SHA `9acd20764e37d2fb16750634cb52c4c7b31ee86f` displays the full-screen “Sincronizando con la nube…” state for roughly 34–36 seconds. This evidence supersedes the earlier protected-preview result for production status.

## Required acceptance contract

A release candidate is acceptable only when all of the following are true:

1. The application shell can render while initial cloud inventory hydration is pending.
2. Pending inventory is visibly provisional/unknown rather than presented as authoritative empty inventory.
3. Cloud inventory writes remain disabled until hydration has completed.
4. Reset/sign-out transitions cannot write provisional inventory to the cloud.
5. The deterministic startup acceptance harness passes:

   ```text
   node --import tsx --test tests/startupCloudSyncRuntime.test.ts
   ```

6. Type checking and the production build pass:

   ```text
   npm run lint
   npm run build
   ```

## Runtime verification

Before publication, test the exact candidate in a protected preview using a mobile-sized viewport and a deliberately delayed initial inventory response:

- Confirm navigation and non-inventory shell content become usable without waiting for the delayed response.
- Confirm inventory is marked as pending/provisional until hydration resolves.
- Attempt an inventory change before hydration; confirm no cloud write occurs.
- Allow hydration to resolve; confirm authoritative inventory replaces the provisional state and subsequent writes use hydrated state.
- Capture the candidate commit SHA and the preview result.

After any explicitly owner-authorized production publication, repeat the delayed-response check against production and record the deployed SHA. Local tests, builds, and preview behavior do **not** establish production closure.

## Release gate

Production publication is owner-gated. Do not deploy, merge to main, or alter hosted Firebase as part of this procedure without explicit authorization. Until the exact candidate passes protected-preview runtime verification and the published production SHA passes the same check, the production regression remains **NOT VERIFIED**.
