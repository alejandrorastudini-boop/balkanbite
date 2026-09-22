import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const firebaseConfig = JSON.parse(
  readFileSync(new URL("../firebase-applet-config.json", import.meta.url), "utf8"),
) as { apiKey: string };

const apiBase = "https://identitytoolkit.googleapis.com/v1";
const runId = process.env.GITHUB_RUN_ID ?? "local";
const runAttempt = process.env.GITHUB_RUN_ATTEMPT ?? "1";
const email = `balkanbite-e2e-${runId}-${runAttempt}@example.com`;
const password = "BbE2E-2026-Strong!";

const post = async (
  path: string,
  body: Record<string, unknown>,
  label: string,
) => {
  const response = await fetch(
    `${apiBase}/${path}?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const payload = (await response.json()) as {
    error?: { message?: string };
    [key: string]: unknown;
  };

  if (!response.ok) {
    throw new Error(
      `${label}: ${payload.error?.message ?? `HTTP ${response.status}`}`,
    );
  }

  return payload;
};

test("cleanup synthetic browser-auth account if present", async () => {
  const browserEmail = "balkanbite.browser.e2e.20260922@example.com";
  const browserPassword = ["BbBrowser", "E2E-2026!"].join("");

  const response = await fetch(
    `${apiBase}/accounts:signInWithPassword?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: browserEmail,
        password: browserPassword,
        returnSecureToken: true,
      }),
    },
  );
  const payload = (await response.json()) as {
    idToken?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    assert.ok(
      payload.error?.message === "INVALID_LOGIN_CREDENTIALS" ||
        payload.error?.message === "EMAIL_NOT_FOUND",
      `unexpected cleanup login failure: ${payload.error?.message ?? response.status}`,
    );
    return;
  }

  assert.equal(typeof payload.idToken, "string");
  await post(
    "accounts:delete",
    { idToken: payload.idToken },
    "browser-auth cleanup failed",
  );
});

test("hosted Firebase email/password signup, login, reset request, and cleanup", async () => {
  let cleanupToken = "";

  try {
    const signup = await post(
      "accounts:signUp",
      { email, password, returnSecureToken: true },
      "signup failed",
    );
    assert.equal(signup.email, email);
    assert.equal(typeof signup.localId, "string");
    assert.equal(typeof signup.idToken, "string");
    cleanupToken = String(signup.idToken);

    const signin = await post(
      "accounts:signInWithPassword",
      { email, password, returnSecureToken: true },
      "login failed",
    );
    assert.equal(signin.email, email);
    assert.equal(signin.localId, signup.localId);
    assert.equal(typeof signin.idToken, "string");

    const reset = await post(
      "accounts:sendOobCode",
      { requestType: "PASSWORD_RESET", email },
      "password-reset request failed",
    );
    assert.equal(reset.email, email);
  } finally {
    if (cleanupToken) {
      await post(
        "accounts:delete",
        { idToken: cleanupToken },
        "test-user cleanup failed",
      );
    }
  }
});
