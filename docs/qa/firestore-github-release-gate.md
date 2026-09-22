# GitHub-managed Firebase Rules — one-time setup and release gate

## Status

This runbook describes a staged workflow, **not** a completed hosted publication.
Tracked rules were emulator-tested in PR #209. Production serves the named
BalkanBite client, but hosted Firestore rules were last observed deny-all.

Target Firebase project: `gen-lang-client-0319723351`.
Only target database:
`ai-studio-balkanbite-9bd2735f-15da-4be1-a327-f9c6d29866b6`.

## One-time credential connection

Use a **new, dedicated** Google Cloud service account, such as
`balkanbite-rules-deployer`, in that project. Grant it ONLY the predefined
**Firebase Rules Admin** (`roles/firebaserules.admin`) role. Do not grant Owner,
Editor, Firebase Admin, Datastore Owner or permission to read application data.
This role is project-wide for rules management; the checked-in workflow restricts
itself to the named BalkanBite release, not the other named databases.

When using a JSON key, create exactly one key for this dedicated account and
store its **entire original JSON** as the GitHub Actions repository secret
`FIREBASE_RULES_SA_JSON`. Never commit it, paste it into chat, attach it to
issues or share screenshots showing its private key. Keep only the necessary
credential copy; revoke the key in Google Cloud if it is ever exposed.
If key creation is prohibited, use GitHub OIDC Workload Identity Federation
instead; it requires a separate setup and workflow change before use.

Google Cloud service accounts:
https://console.cloud.google.com/iam-admin/serviceaccounts?project=gen-lang-client-0319723351

GitHub repository secrets:
https://github.com/alejandrorastudini-boop/balkanbite/settings/secrets/actions

## Execution and protection

Workflow: `.github/workflows/firestore-release.yml`.
It is restricted to `main` and has no pull-request or routine push
deployment trigger. It starts via manual `workflow_dispatch` (default
`inspect`) or a change to `ops/firebase-rules-release-request.json` on
`main`. The release-request file is deliberately NOT committed initially.

It runs the offline two-user Firebase emulator test on the exact checkout
BEFORE accessing Google. It then uses the Google-provided auth action and
the official Firebase Rules management REST API (not the Admin SDK's
default-database-only release helper).

`inspect` reads the named release and ruleset and captures a backup.
It makes **no hosted changes**.

`publish` additionally requires the committed request file to contain
`mode: publish`, the fixed project ID, the fixed named database ID, and
the SHA-256 of exactly the current `firestore.rules` file. It will only
replace an existing unmistakable **deny-all** release, or return successfully
if the current rules already match the checked-in source. Any unfamiliar
rules, changed source, missing named release or project mismatch stops
publication rather than overwriting user state.

Before patching, it stores the prior release metadata and source in a
GitHub Actions artifact retained for 30 days. The release API target is
`projects/gen-lang-client-0319723351/releases/cloud.firestore/ai-studio-balkanbite-9bd2735f-15da-4be1-a327-f9c6d29866b6`.
An immutable ruleset is created with the full Firebase project number as
attachment point. Only this named release is updated. The workflow GETs
the published release and source and demands an exact source match; if
that verification fails after a successful release update, it tries to
restore the original ruleset. A successful REST verification does not
prove that the change has finished propagating to clients.

After publication, separately run PR #206's approved hosted synthetic A/B
E2E and verify document cleanup and cross-user isolation before classifying
cloud sync as REAL E2E. If an actual isolation failure is observed,
restore the original release ruleset via the secure process and
retest. A GitHub Actions green build is not proof of hosted functionality.

## Required publish request (example, do not copy with a placeholder hash)

```json
{
  "mode": "publish",
  "projectId": "gen-lang-client-0319723351",
  "databaseId": "ai-studio-balkanbite-9bd2735f-15da-4be1-a327-f9c6d29866b6",
  "rulesSha256": "<sha256 of current firestore.rules bytes>"
}
```

Do not create the publish request before a read-only `inspect` run has
confirmed Google connectivity and recovered the expected live baseline.
A future request can instead say `mode: inspect` to trigger a read-only
inspection from an authorized GitHub commit.

## Rollback

The artifact contains the prior immutable ruleset name and exact source.
Use the Firebase Rules releases PATCH API on the specific named release
with `rulesetName` set to the backup's prior ruleset. Verify the live
release afterwards. Do not delete existing rulesets during rollback;
a rollback changes policy, not user documents. Any irreversible operations,
extra spending, or broader IAM grants require a separate decision.
