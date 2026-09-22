# Named Firestore integration gate — 2026-09-22

## Confirmed target

Firebase project: `gen-lang-client-0319723351`.

Existing BalkanBite Firestore database:
`ai-studio-balkanbite-9bd2735f-15da-4be1-a327-f9c6d29866b6`.

The production client previously initialized Firestore without a database ID, so the SDK attempted to use `(default)`. Runtime evidence showed that `(default)` does not exist.

The existing named BalkanBite database is currently locked down with deny-all client rules. Do not publish broader rules until the client target is verified and the hosted rule set is reviewed.

## Branch change

Branch `fix/named-firestore-balkanbite`:

- initializes Firestore with the existing named database ID;
- scopes `firebase.json` Firestore rule deployment to that same database;
- adds a regression test to ensure the client and Firebase CLI target cannot silently diverge.

## Release gate

Before merge or production classification:

1. lint/typecheck must pass;
2. test suite must pass;
3. build must pass;
4. review the diff for accidental provider/auth or persistence regressions;
5. publish only the validated owner-scoped `firestore.rules` to the named database;
6. rerun synthetic hosted account QA;
7. verify that the browser no longer reports `Database '(default)' not found`;
8. verify owner isolation with two synthetic users before calling cloud sync REAL E2E.

Publishing hosted Firestore rules is a production security change and remains a separate explicit gate.
