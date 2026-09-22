import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

// A hosted test creates real synthetic Auth users and owned Firestore documents.
// It must never run during routine PR validation or silently target production.
assert.equal(process.env.QA_ALLOW_HOSTED_WRITES, "true",
  "Explicit QA_ALLOW_HOSTED_WRITES=true required to create hosted test accounts");
const productionUrl = process.env.QA_HOSTED_TARGET_URL;
assert.ok(productionUrl, "Explicit QA_HOSTED_TARGET_URL required");
const target = new URL(productionUrl);
assert.equal(target.protocol, "https:", "Hosted QA requires HTTPS");
assert.ok(target.hostname.endsWith(".vercel.app"),
  "Hosted QA target must be an approved Vercel deployment");
assert.ok(target.hostname !== "balkanbite.vercel.app" ||
  process.env.QA_ALLOW_PRODUCTION_TARGET === "true",
  "Production target requires a separate QA_ALLOW_PRODUCTION_TARGET=true");
const runId = process.env.GITHUB_RUN_ID || String(Date.now());
const attempt = process.env.GITHUB_RUN_ATTEMPT || "1";
const email = `balkanbite-ci-${runId}-${attempt}@example.com`;
const password = `Bb-${randomBytes(16).toString("base64url")}-A1!`;
const displayName = "BalkanBite CI QA";
const isolationEmail = `balkanbite-ci-${runId}-${attempt}-isolation@example.com`;
const isolationPassword = `Bb-${randomBytes(16).toString("base64url")}-B2!`;

const firebaseConfig = JSON.parse(
  readFileSync(new URL("../../firebase-applet-config.json", import.meta.url), "utf8"),
);
const identityBase = "https://identitytoolkit.googleapis.com/v1";
const firestoreDatabaseId =
  "ai-studio-balkanbite-9bd2735f-15da-4be1-a327-f9c6d29866b6";
const firestoreBase =
  `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firestoreDatabaseId}`;
const documentRoot =
  `projects/${firebaseConfig.projectId}/databases/${firestoreDatabaseId}/documents`;

let browser;
let primaryError = null;
let isolationIdToken = "";
let isolationUid = "";

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

// Delete only documents owned by the synthetic user authenticated below.
// A rules failure is reported, but must never prevent deleting the Auth user.
async function deleteOwnedQaDocuments(idToken, uid) {
  const headers = { authorization: `Bearer ${idToken}` };
  const collections = ["inventory", "recipes", "mealPlans", "shoppingList"];
  const listOwned = async (collection) => {
    const response = await fetch(`${firestoreBase}/documents:runQuery`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collection }],
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
    if (!response.ok) {
      throw new Error(`Cannot list synthetic ${collection} documents: HTTP ${response.status} ${await response.text()}`);
    }
    const results = await response.json();
    assert.ok(Array.isArray(results), "Unexpected Firestore runQuery response");
    const prefix = `${documentRoot}/${collection}/`;
    return results.flatMap((result) => {
      const name = result?.document?.name;
      if (!name) return [];
      assert.ok(name.startsWith(prefix), "Refusing unscoped QA document");
      assert.ok(!name.slice(prefix.length).includes("/"), "Refusing nested QA document");
      return [name];
    });
  };
  for (const collection of collections) {
    const docs = await listOwned(collection);
    for (const name of docs) {
      const deletion = await fetch(`https://firestore.googleapis.com/v1/${name}`, {
        method: "DELETE",
        headers,
      });
      if (!deletion.ok && deletion.status !== 404) {
        throw new Error(`Synthetic document deletion failed: HTTP ${deletion.status} ${await deletion.text()}`);
      }
    }
    assert.equal((await listOwned(collection)).length, 0,
      `Synthetic ${collection} documents remain after cleanup`);
  }
  const profileUrl = `${firestoreBase}/documents/users/${encodeURIComponent(uid)}`;
  const profile = await fetch(profileUrl, { headers });
  if (profile.status !== 404) {
    if (!profile.ok) {
      throw new Error(`Synthetic profile lookup failed: HTTP ${profile.status} ${await profile.text()}`);
    }
    const deleted = await fetch(profileUrl, { method: "DELETE", headers });
    if (!deleted.ok && deleted.status !== 404) {
      throw new Error(`Synthetic profile deletion failed: HTTP ${deleted.status} ${await deleted.text()}`);
    }
  }
  const verify = await fetch(profileUrl, { headers });
  assert.equal(verify.status, 404, "Synthetic profile remains or cannot verify cleanup");
}


async function verifyHostedCollectionIsolation(ownerToken, ownerUid, secondToken, secondUid) {
  const headers = (token) => ({
    authorization: "Bearer " + token,
    "content-type": "application/json",
  });
  const logicalId = "qa-" + runId + "-" + attempt + "-" + randomBytes(4).toString("hex");
  const scopedId = (uid, id) =>
    "u_" + encodeURIComponent(uid) + "__" + encodeURIComponent(id);
  for (const collectionName of ["inventory", "recipes", "mealPlans", "shoppingList"]) {
    const itemId = collectionName === "mealPlans" ? "2099-12-31" : logicalId;
    const firstId = scopedId(ownerUid, itemId);
    const secondId = scopedId(secondUid, itemId);
    assert.notEqual(firstId, secondId, "Cross-user document IDs must differ");
    const base = firestoreBase + "/documents/" + collectionName + "/";
    const ownerUrl = base + encodeURIComponent(firstId);
    const secondUrl = base + encodeURIComponent(secondId);
    const fields = (uid) => ({
      userId: { stringValue: uid },
      ...(collectionName === "mealPlans"
        ? { date: { stringValue: itemId } }
        : { id: { stringValue: itemId } }),
      qaSyntheticOnly: { booleanValue: true },
    });
    const createOwner = await fetch(ownerUrl, {
      method: "PATCH",
      headers: headers(ownerToken),
      body: JSON.stringify({ fields: fields(ownerUid) }),
    });
    assert.equal(createOwner.status, 200,
      "Owner create failed for " + collectionName + ": HTTP " + createOwner.status);
    const ownRead = await fetch(ownerUrl, { headers: headers(ownerToken) });
    assert.equal(ownRead.status, 200, "Owner read failed for " + collectionName);
    const crossRead = await fetch(ownerUrl, { headers: headers(secondToken) });
    assert.equal(crossRead.status, 403, "Cross-user read not denied for " + collectionName);
    const crossWrite = await fetch(ownerUrl + "?updateMask.fieldPaths=qaCrossUserProbe", {
      method: "PATCH",
      headers: headers(secondToken),
      body: JSON.stringify({ fields: { qaCrossUserProbe: { booleanValue: true } } }),
    });
    assert.equal(crossWrite.status, 403, "Cross-user update not denied for " + collectionName);
    const createSecond = await fetch(secondUrl, {
      method: "PATCH",
      headers: headers(secondToken),
      body: JSON.stringify({ fields: fields(secondUid) }),
    });
    assert.equal(createSecond.status, 200,
      "Second owner create failed for " + collectionName + ": HTTP " + createSecond.status);
    const secondRead = await fetch(secondUrl, { headers: headers(secondToken) });
    assert.equal(secondRead.status, 200, "Second owner read failed for " + collectionName);
    const reverseCrossRead = await fetch(secondUrl, { headers: headers(ownerToken) });
    assert.equal(reverseCrossRead.status, 403,
      "Reverse cross-user read not denied for " + collectionName);
  }
  console.log("Hosted owner isolation passed for all four synced collections.");
}

async function removeSyntheticAccount(targetEmail, targetPassword) {
  assert.equal(targetEmail, email, "Refusing to clean a different account");
  assert.equal(targetPassword, password, "Refusing to use unrelated credentials");
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
  const errors = [];
  try {
    await deleteOwnedQaDocuments(token, localId);
  } catch (error) {
    errors.push(error);
  }
  try {
    await identity("accounts:delete", { idToken: token });
    const verifyLogin = await identity(
      "accounts:signInWithPassword",
      { email: targetEmail, password: targetPassword, returnSecureToken: true },
      { allowFailure: true },
    );
    assert.equal(verifyLogin.response.ok, false,
      `Synthetic Firebase Auth user still exists: ${targetEmail}`);
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    throw new AggregateError(errors,
      "Synthetic cleanup incomplete: check owned documents and Auth account");
  }
  return true;
}

try {

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) {
      console.log(`[browser:${message.type()}] ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    console.log(`[browser:pageerror] ${error.stack || error.message}`);
  });

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
  if (!profileHydrated) {
    console.log(
      "DIAGNOSTIC: Firebase Auth succeeded but users/{uid} was not created by the live client within 10 seconds.",
    );
    await page.waitForTimeout(2_000);
  }
  assert.equal(
    profileHydrated,
    true,
    "New authenticated account did not create its owned Firestore profile",
  );

  // Test the hosted rules with a second synthetic Auth identity. Neither
  // identity uses an actual customer account or pre-existing Firestore data.
  const ownerUid = String(backendLogin.payload.localId);
  const ownerProfileUrl =
    `${firestoreBase}/documents/users/${encodeURIComponent(ownerUid)}`;
  const anonymousRead = await fetch(ownerProfileUrl);
  assert.ok([401, 403].includes(anonymousRead.status),
    `Unauthenticated profile read unexpectedly returned HTTP ${anonymousRead.status}`);

  const isolationSignup = await identity("accounts:signUp", {
    email: isolationEmail,
    password: isolationPassword,
    returnSecureToken: true,
  });
  isolationIdToken = String(isolationSignup.payload.idToken || "");
  assert.ok(isolationIdToken, "Missing isolation account token");
  isolationUid = String(isolationSignup.payload.localId || "");
  assert.ok(isolationUid, "Missing isolation account UID");
  assert.notEqual(isolationUid, ownerUid);

  const crossRead = await fetch(ownerProfileUrl, {
    headers: { authorization: `Bearer ${isolationIdToken}` },
  });
  assert.equal(crossRead.status, 403,
    `Cross-user profile read unexpectedly returned HTTP ${crossRead.status}`);

  // If rules regress, this updateMask limits any accidental write to a
  // throwaway field on the first synthetic account's throwaway profile.
  const crossWrite = await fetch(
    `${ownerProfileUrl}?updateMask.fieldPaths=qaIsolationProbe`,
    {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${isolationIdToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fields: { qaIsolationProbe: { booleanValue: true } },
      }),
    },
  );
  assert.equal(crossWrite.status, 403,
    `Cross-user profile update unexpectedly returned HTTP ${crossWrite.status}`);

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

  await verifyHostedCollectionIsolation(
    String(backendLogin.payload.idToken), ownerUid, isolationIdToken, isolationUid,
  );
  console.log(
    "Hosted production auth E2E passed: signup -> profile -> UI -> logout -> login -> reset -> four collection owner-isolation checks.",
  );
} catch (error) {
  primaryError = error;
} finally {
  if (isolationIdToken) {
    try {
      if (isolationUid) await deleteOwnedQaDocuments(isolationIdToken, isolationUid);
    } catch (isolationDocumentsError) {
      if (!primaryError) primaryError = isolationDocumentsError;
      else console.error("Isolation document cleanup also failed:", isolationDocumentsError);
    }
    try {
      await identity("accounts:delete", { idToken: isolationIdToken });
      const verifyIsolation = await identity("accounts:signInWithPassword", {
        email: isolationEmail,
        password: isolationPassword,
        returnSecureToken: true,
      }, { allowFailure: true });
      assert.equal(verifyIsolation.response.ok, false,
        "Synthetic isolation account remains after cleanup");
      console.log("Synthetic second Auth account removed.");
    } catch (isolationCleanupError) {
      if (!primaryError) primaryError = isolationCleanupError;
      else console.error("Isolation account cleanup also failed:", isolationCleanupError);
    }
  }
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
