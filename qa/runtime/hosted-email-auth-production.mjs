import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const productionUrl =
  process.env.QA_PRODUCTION_URL || "https://balkanbite.vercel.app";
const runId = process.env.GITHUB_RUN_ID || String(Date.now());
const attempt = process.env.GITHUB_RUN_ATTEMPT || "1";
const email = `balkanbite-ci-${runId}-${attempt}@example.com`;
const password = `Bb-${runId}-${attempt}-A1!`;
const displayName = "BalkanBite CI QA";

const firebaseConfig = JSON.parse(
  readFileSync(new URL("../../firebase-applet-config.json", import.meta.url), "utf8"),
);
const identityBase = "https://identitytoolkit.googleapis.com/v1";
const firestoreBase =
  `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)`;

let browser;
let primaryError = null;

async function identity(path, body, { allowFailure = false } = {}) {
  const response = await fetch(
    `${identityBase}/${path}?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const payload = await response.json();
  if (!response.ok && !allowFailure) {
    throw new Error(
      `${path}: ${payload?.error?.message || `HTTP ${response.status}`}`,
    );
  }
  return { response, payload };
}

async function openAuth(page) {
  const headerButton = page.locator("#header-auth-btn");
  if (await headerButton.isVisible().catch(() => false)) {
    await headerButton.click();
  } else {
    await page.locator("#landing-login-top-btn").click();
  }
  await page.locator("#auth-modal-overlay").waitFor({ state: "visible" });
}

async function waitForProfileDocument(idToken, localId) {
  const url =
    `${firestoreBase}/documents/users/${encodeURIComponent(localId)}`;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${idToken}` },
    });
    if (response.ok) return true;
    if (response.status !== 404) {
      const detail = await response.text();
      throw new Error(
        `Profile hydration check failed: HTTP ${response.status} ${detail}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

async function completeOnboardingIfVisible(page) {
  const household = page.locator("#onboarding-household-size");
  const visible = await household
    .waitFor({ state: "visible", timeout: 3_000 })
    .then(() => true)
    .catch(() => false);

  if (!visible) return false;

  await household.fill("1");
  await page.locator("#onboarding-next-step-1").click();
  await page.locator("#onboarding-diet-all").click();
  await page.locator("#onboarding-next-step-2").click();
  await page.locator("#onboarding-cooking-moderate").click();
  await page.locator("#onboarding-next-step-3").click();
  await page.locator("#onboarding-finish").click();
  await household.waitFor({ state: "detached", timeout: 20_000 });
  return true;
}

async function removeSyntheticAccount(targetEmail, targetPassword) {
  const login = await identity(
    "accounts:signInWithPassword",
    { email: targetEmail, password: targetPassword, returnSecureToken: true },
    { allowFailure: true },
  );
  if (!login.response.ok) return false;

  const token = String(login.payload.idToken || "");
  const localId = String(login.payload.localId || "");
  assert.ok(token);
  assert.ok(localId);

  const profileDelete = await fetch(
    `${firestoreBase}/documents/users/${encodeURIComponent(localId)}`,
    {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    },
  );
  if (!profileDelete.ok && profileDelete.status !== 404) {
    const detail = await profileDelete.text();
    throw new Error(
      `Synthetic profile cleanup failed: HTTP ${profileDelete.status} ${detail}`,
    );
  }

  await identity("accounts:delete", { idToken: token });

  const verifyLogin = await identity(
    "accounts:signInWithPassword",
    { email: targetEmail, password: targetPassword, returnSecureToken: true },
    { allowFailure: true },
  );
  assert.equal(
    verifyLogin.response.ok,
    false,
    `Synthetic Firebase Auth user still exists: ${targetEmail}`,
  );
  return true;
}

async function cleanupStaleCiAccounts() {
  for (const staleRunId of ["35715738785", "35716484997"]) {
    const staleEmail = `balkanbite-ci-${staleRunId}-1@example.com`;
    const stalePassword = `Bb-${staleRunId}-1-A1!`;
    const removed = await removeSyntheticAccount(staleEmail, stalePassword);
    if (removed) {
      console.log(`Removed stale synthetic QA account from run ${staleRunId}.`);
    }
  }
}

try {
  await cleanupStaleCiAccounts();

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  await page.goto(productionUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.locator("#landing-login-top-btn").waitFor({ state: "visible" });

  await openAuth(page);
  await page.locator("#auth-tab-login").waitFor({ state: "visible" });
  await page.locator("#auth-tab-signup").waitFor({ state: "visible" });

  await page.locator("#auth-tab-signup").click();
  await page.locator("#auth-display-name").fill(displayName);
  await page.locator("#auth-email").fill(email);
  await page.locator("#auth-password").fill(password);
  await page.locator("#auth-email-submit").click();
  await page
    .locator("#auth-modal-overlay")
    .waitFor({ state: "detached", timeout: 20_000 });

  const backendLogin = await identity("accounts:signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });
  assert.equal(backendLogin.payload.email, email);
  assert.ok(backendLogin.payload.idToken);
  assert.ok(backendLogin.payload.localId);

  const profileHydrated = await waitForProfileDocument(
    String(backendLogin.payload.idToken),
    String(backendLogin.payload.localId),
  );
  assert.equal(
    profileHydrated,
    true,
    "New authenticated account did not create its owned Firestore profile",
  );

  const onboardingCompletedInQa = await completeOnboardingIfVisible(page);
  console.log(
    onboardingCompletedInQa
      ? "Optional onboarding appeared and was completed for the synthetic account."
      : "Onboarding was not shown in this auth path; continuing with account-auth checks.",
  );

  await page.locator("#header-auth-btn").waitFor({ state: "visible", timeout: 20_000 });
  await openAuth(page);
  await page.locator("#auth-sign-out-btn").waitFor({ state: "visible" });
  await page
    .getByText(email, { exact: true })
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.locator("#auth-sign-out-btn").click();
  await page
    .locator("#auth-modal-overlay")
    .waitFor({ state: "detached", timeout: 10_000 });

  await openAuth(page);
  await page.locator("#auth-tab-login").click();
  await page.locator("#auth-email").fill(email);
  await page.locator("#auth-password").fill(password);
  await page.locator("#auth-email-submit").click();
  await page
    .locator("#auth-modal-overlay")
    .waitFor({ state: "detached", timeout: 20_000 });

  await openAuth(page);
  await page.locator("#auth-sign-out-btn").waitFor({ state: "visible" });
  await page
    .getByText(email, { exact: true })
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.locator("#auth-sign-out-btn").click();
  await page
    .locator("#auth-modal-overlay")
    .waitFor({ state: "detached", timeout: 10_000 });

  await openAuth(page);
  await page.locator("#auth-tab-login").click();
  await page.locator("#auth-email").fill(email);
  await page.locator("#auth-reset-password-btn").click();
  await page
    .locator("#auth-notice-message")
    .waitFor({ state: "visible", timeout: 15_000 });

  console.log(
    "Hosted production auth E2E passed: signup -> owned profile hydration -> authenticated UI -> logout -> login -> logout -> password reset notice.",
  );
} catch (error) {
  primaryError = error;
} finally {
  try {
    const removed = await removeSyntheticAccount(email, password);
    if (removed) {
      console.log("Synthetic hosted-auth QA profile and Auth user removed.");
    }
  } catch (cleanupError) {
    if (!primaryError) primaryError = cleanupError;
    else console.error("Cleanup also failed:", cleanupError);
  }

  if (browser) await browser.close();
}

if (primaryError) throw primaryError;
