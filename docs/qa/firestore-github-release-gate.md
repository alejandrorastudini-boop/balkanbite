# GitHub-managed Firebase Rules — setup and repeatable release gate

## Status

This runbook describes the guarded workflow for initial publication and successive upgrades. A successful historical publication does not imply that hosted Rules match current `main`; always run a fresh read-only inspection before preparing another release request.

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
the SHA-256 of exactly the current `firestore.rules` file. It will replace a hosted policy only when the release request pins the exact
immutable ruleset name **and** normalized hosted-source SHA recovered by a
fresh read-only inspection, or return successfully if hosted Rules already
match the checked-in source. This supports successive reviewed upgrades without
weakening the fail-closed baseline check. Any changed source, changed hosted
ruleset/hash, missing named release or project mismatch stops publication
rather than overwriting an unreviewed policy.

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
  "rulesSha256": "<sha256 of current firestore.rules bytes>",
  "expectedHostedRulesetName": "<full inspected projects/.../rulesets/... name>",
  "expectedHostedRulesSha256": "<sha256 of inspected normalized hosted rules>"
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

## Historical initial inspection (2026-09-23)

Read-only GitHub Actions inspection run #1 (`35827155241`) succeeded using the
restricted Google service account. The GitHub backup artifact
`named-firestore-rules-before-35827155241` contains the original deny-all
source and the named release's original immutable ruleset reference. The
project, database ID, live ruleset name and SHA-256 were checked against
this artifact. The repo source SHA-256 used in the release request is the
**raw file SHA-256**, not the normalized source SHA-256 printed separately.

The controlled initial publication is submitted through a reviewable PR to
`ops/firebase-rules-release-request.json`, with both the inspected hosted
ruleset name and inspected normalized hosted source hash pinned. The workflow
refuses publication if the live source or ruleset changes before the run.
The push event on merge to `main` intentionally triggers one controlled
publication; a green test on the PR itself does not make any live changes.

After publication, inspect the live release and run the synthetic hosted A/B
QA. Do not classify hosted sync as functional based on the Rules API alone.


## Successive upgrades

The deny-all shape check applied only to the initial activation and is not a
valid authority for later upgrades. For every later release, first run
`workflow_dispatch: inspect` on trusted `main`. Use the resulting backup
artifact/log output to pin both `expectedHostedRulesetName` and
`expectedHostedRulesSha256` in the reviewed publish request. Publication
must fail if either value changes before PATCH. The pre-publication backup
remains the rollback target, and hosted authenticated QA remains mandatory
after propagation before claiming Production E2E.
