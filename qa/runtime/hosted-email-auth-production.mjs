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
let idToken = "";
let uid = "";

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

async function ensureCleanupToken() {
  if (idToken && uid) return true;
  const login = await identity(
    "accounts:signInWithPassword",
    { email, password, returnSecureToken: true },
    { allowFailure: true },
  );
  if (!login.response.ok) return false;
  idToken = String(login.payload.idToken || "");
  uid = String(login.payload.localId || "");
  return Boolean(idToken && uid);
}

async function firestoreRequest(path, options = {}) {
  return fetch(`${firestoreBase}/${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${idToken}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
}

async function cleanupOwnedCollection(collectionId) {
  const response = await firestoreRequest("documents:runQuery", {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath: "userId" },
            op: "EQUAL",
            value: { stringValue: uid },
          },
        },
      },
    }),
  });
  assert.equal(response.ok, true, `Firestore query failed for ${collectionId}`);
  const rows = await response.json();

  for (const row of rows) {
    const name = row?.document?.name;
    if (!name) continue;
    const deleteResponse = await fetch(
      `https://firestore.googleapis.com/v1/${name}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${idToken}` },
      },
    );
    assert.equal(
      deleteResponse.ok,
      true,
      `Firestore cleanup failed for ${name}`,
    );
  }

  const verify = await firestoreRequest("documents:runQuery", {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath: "userId" },
            op: "EQUAL",
            value: { stringValue: uid },
          },
        },
      },
    }),
  });
  assert.equal(verify.ok, true, `Firestore verify failed for ${collectionId}`);
  const verifyRows = await verify.json();
  assert.equal(
    verifyRows.some((row) => Boolean(row?.document)),
    false,
    `${collectionId} still contains synthetic QA rows`,
  );
}

async function cleanupSyntheticAccount() {
  if (!(await ensureCleanupToken())) return;

  for (const collectionId of [
    "inventory",
    "recipes",
    "mealPlans",
    "shoppingList",
  ]) {
    await cleanupOwnedCollection(collectionId);
  }

  const profileDelete = await firestoreRequest(
    `documents/users/${encodeURIComponent(uid)}`,
    { method: "DELETE" },
  );
  assert.equal(
    profileDelete.ok || profileDelete.status === 404,
    true,
    "Synthetic profile cleanup failed",
  );

  const deletion = await identity("accounts:delete", { idToken });
  assert.equal(deletion.response.ok, true);

  const verifyLogin = await identity(
    "accounts:signInWithPassword",
    { email, password, returnSecureToken: true },
    { allowFailure: true },
  );
  assert.equal(
    verifyLogin.response.ok,
    false,
    "Synthetic Firebase Auth user still exists after cleanup",
  );
}

try {
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
  idToken = String(backendLogin.payload.idToken || "");
  uid = String(backendLogin.payload.localId || "");
  assert.equal(backendLogin.payload.email, email);
  assert.ok(idToken);
  assert.ok(uid);

  await page
    .locator("#onboarding-household-size")
    .waitFor({ state: "visible", timeout: 20_000 });
  await page.locator("#onboarding-household-size").fill("1");
  await page.locator("#onboarding-next-step-1").click();
  await page.locator("#onboarding-diet-all").click();
  await page.locator("#onboarding-next-step-2").click();
  await page.locator("#onboarding-cooking-moderate").click();
  await page.locator("#onboarding-next-step-3").click();
  await page.locator("#onboarding-finish").click();
  await page
    .locator("#onboarding-household-size")
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
    "Hosted production auth E2E passed: signup -> onboarding -> authenticated UI -> logout -> login -> logout -> password reset notice.",
  );
} finally {
  try {
    await cleanupSyntheticAccount();
    console.log("Synthetic hosted-auth QA account and owned cloud data removed.");
  } finally {
    if (browser) await browser.close();
  }
}
