import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authModalSource = readFileSync(
  new URL("../src/components/AuthModal.tsx", import.meta.url),
  "utf8",
);
const firebaseSource = readFileSync(
  new URL("../src/lib/firebase.ts", import.meta.url),
  "utf8",
);

test("email/password account creation and sign-in are exposed alongside Google", () => {
  assert.match(authModalSource, /id="auth-tab-login"/);
  assert.match(authModalSource, /id="auth-tab-signup"/);
  assert.match(authModalSource, /id="auth-email-form"/);
  assert.match(authModalSource, /id="auth-email-submit"/);
  assert.match(authModalSource, /signUpWithEmail/);
  assert.match(authModalSource, /loginWithEmail/);
  assert.match(authModalSource, /id="btn-google-sign-in"/);
  assert.match(authModalSource, /id="auth-modal-guest-btn"/);
});

test("email/password auth has deterministic validation and provider-disabled handling", () => {
  assert.match(authModalSource, /password\.length < 6/);
  assert.match(authModalSource, /auth\/operation-not-allowed/);
  assert.match(authModalSource, /auth\/email-already-in-use/);
  assert.match(authModalSource, /auth\/invalid-credential/);
  assert.doesNotMatch(
    authModalSource,
    /setErrorMessage\(err\?\.message/,
  );
});

test("password reset remains inside the same first-party auth boundary", () => {
  assert.match(firebaseSource, /sendPasswordResetEmail/);
  assert.match(firebaseSource, /export const resetPassword/);
  assert.match(authModalSource, /id="auth-reset-password-btn"/);
  assert.match(authModalSource, /await resetPassword\(normalizedEmail\)/);
});

test("authenticated copy is provider-neutral and old unsupported security claims stay removed", () => {
  assert.match(authModalSource, /BalkanBite account connected/);
  assert.doesNotMatch(authModalSource, /Google account connected/);
  assert.doesNotMatch(authModalSource, /Cifrado de grado médico/);
  assert.doesNotMatch(authModalSource, /medical-grade encryption/i);
});
