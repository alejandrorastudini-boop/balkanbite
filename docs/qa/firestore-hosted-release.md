# Firestore hosted release gate

## Hosted state observed on 2026-09-13

Read-only Firebase Console inspection showed:

- Authentication: one existing real/personal user.
- Authentication providers: Google enabled; Email/Password not enabled; SMS MFA disabled.
- Firestore Data: empty database (`Start collection`, no visible collections/documents).
- Firestore Rules: default deny-all (`allow read, write: if false;`).

No hosted data, users, providers or rules were modified during this audit.

## Ruleset intended for hosted publication

The authoritative candidate is the repository root `firestore.rules` from the integration tree. It has been validated with the official Firestore Emulator, including anonymous rejection, owner-scoped reads/writes, cross-user isolation, ownership-transfer rejection, legacy inventory, namespaced inventory IDs, tombstones and reactivation.

Publication should target the default Firestore database of Firebase project `gen-lang-client-0319723351` explicitly. The repository intentionally does not track a `.firebaserc`, so an accidental generic `firebase deploy` cannot silently inherit a production project alias.

`firebase.json` maps Firestore rules to `firestore.rules`. Any CLI publication must therefore use an explicit project argument and only the rules target.

## Change from current hosted behavior

Current hosted behavior is deny-all: no client can read or write Firestore.

The candidate rules keep unauthenticated access denied, but allow authenticated users to:

- read/write their own `/users/{uid}` document;
- create `inventory`, `recipes`, `mealPlans` and `shoppingList` documents only when incoming `userId` equals their Firebase UID;
- read/delete those collection documents only when the stored `userId` equals their UID;
- update only when both existing and incoming `userId` equal their UID, preventing ownership transfer.

No wildcard public read/write rule is introduced.

## Empty-cloud guard

Additional Auth + Firestore Emulator QA checked first login against an empty cloud. After authoritative empty inventory hydration, the app wrote zero documents to secondary collections from local/default state:

- recipes: 0;
- mealPlans: 0;
- shoppingList: 0.

This guard passed in run `34768045704`. No silent auto-upload from local/default state was observed in that scenario.

## Impact on the one existing personal user

Publishing the rules does not itself create documents or mutate data. However, after publication, signing into BalkanBite with the existing personal Google identity can activate the application's live Firebase synchronization. `useFirebaseSync` can create/update the user's profile and later write synchronized app state.

For that reason the personal user must not be used for destructive QA. Hosted functional QA should use dedicated synthetic identities/data only.

## Required release sequence

Do not publish Firestore rules while production still runs the old `main` client. The safe order is:

1. integrate/deploy the validated PR #18 client while hosted Firestore remains deny-all;
2. smoke-test production guest behavior;
3. only then publish the validated Firestore rules;
4. verify anonymous access remains denied;
5. run hosted Auth/Firestore QA with synthetic identities/data;
6. rollback immediately on authorization/isolation anomaly.

This ensures that the first client allowed to write hosted Firestore is the hardened integration client rather than the old production client.

## Rollback

Preferred rollback is Firebase Console Rules history/timeline: restore/clone the previously published deny-all ruleset and publish it again.

Emergency deny-all contents:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Rollback affects authorization only; it does not delete documents that may have been created during QA. QA documents/users must be cleaned separately if they were intentionally created.

## Hosted QA identities

Do not use the existing personal user.

Preferred QA strategy:

1. use two dedicated synthetic identities A/B;
2. exercise only synthetic Firestore documents owned by those UIDs;
3. validate empty remote hydration, namespaced IDs, logout/guest restoration, user isolation, legacy precedence, tombstones, reactivation and clear-all;
4. remove only the synthetic QA data/users when finished.

Because hosted Auth currently exposes Google only, two approaches are possible:

- create two dedicated Google QA accounts manually, or
- temporarily enable Email/Password solely for controlled QA, create two disposable Firebase users, run QA, delete those QA users/data and disable Email/Password again.

The second option changes hosted Auth configuration and therefore requires explicit owner authorization before use. Email/Password should not remain enabled for release until password recovery and email-verification policy are productized.

## Cost expectation

The planned QA uses only a handful of auth sessions and dozens of Firestore reads/writes/deletes. This is far below the documented free quotas for a qualifying Firestore database and below Identity Platform's free MAU tier for standard providers. No SMS/MFA should be used.

No paid service, quota increase or billing-plan change is required for this release gate.

## Exact CLI publication command after explicit authorization

From the validated integration tree:

```bash
npx firebase-tools deploy --only firestore:rules --project gen-lang-client-0319723351 --config firebase.json
```

This publishes rules only. It does not deploy Hosting, Functions or application code.
