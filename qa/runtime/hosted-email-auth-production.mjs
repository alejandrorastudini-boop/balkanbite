import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { deleteApp, initializeApp } from "firebase/app";
import {
  deleteUser,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
} from "firebase/firestore";

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

const qaApp = initializeApp(firebaseConfig, `hosted-auth-e2e-${runId}-${attempt}`);
const qaAuth = getAuth(qaApp);
const qaDb = getFirestore(qaApp);
const ownedCollections = ["inventory", "recipes", "mealPlans", "shoppingList"];

let browser;
let qaCredential = null;

async function openAuth(page) {
  const headerButton = page.locator("#header-auth-btn");
  if (await headerButton.isVisible().catch(() => false)) {
    await headerButton.click();
  } else {
    await page.locator("#landing-login-top-btn").click();
  }
  await page.locator("#auth-modal-overlay").waitFor({ state: "visible" });
}

async function cleanupSyntheticAccount() {
  if (!qaCredential) {
    try {
      qaCredential = await signInWithEmailAndPassword(qaAuth, email, password);
    } catch {
      return;
    }
  }

  const uid = qaCredential.user.uid;

  for (const collectionName of ownedCollections) {
    const ownedQuery = query(
      collection(qaDb, collectionName),
      where("userId", "==", uid),
    );
    const snapshot = await getDocs(ownedQuery);
    await Promise.all(snapshot.docs.map((entry) => deleteDoc(entry.ref)));
    const after = await getDocs(ownedQuery);
    assert.equal(after.empty, true, `${collectionName} cleanup incomplete`);
  }

  await deleteDoc(doc(qaDb, "users", uid));
  await deleteUser(qaCredential.user);
  qaCredential = null;

  await assert.rejects(
    signInWithEmailAndPassword(qaAuth, email, password),
    (error) =>
      error?.code === "auth/invalid-credential" ||
      error?.code === "auth/user-not-found",
  );
}

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto(productionUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator("#landing-login-top-btn").waitFor({ state: "visible" });
  await openAuth(page);

  await page.locator("#auth-tab-login").waitFor({ state: "visible" });
  await page.locator("#auth-tab-signup").waitFor({ state: "visible" });

  await page.locator("#auth-tab-signup").click();
  await page.locator("#auth-display-name").fill(displayName);
  await page.locator("#auth-email").fill(email);
  await page.locator("#auth-password").fill(password);
  await page.locator("#auth-email-submit").click();

  await page.locator("#auth-modal-overlay").waitFor({ state: "detached", timeout: 20_000 });

  qaCredential = await signInWithEmailAndPassword(qaAuth, email, password);
  assert.equal(qaCredential.user.email, email);

  await setDoc(
    doc(qaDb, "users", qaCredential.user.uid),
    {
      userId: qaCredential.user.uid,
      onboardingCompleted: true,
    },
    { merge: true },
  );

  await page.waitForFunction(
    () => document.querySelector("#onboarding-household-size") === null,
    undefined,
    { timeout: 20_000 },
  );

  await openAuth(page);
  await page.locator("#auth-sign-out-btn").waitFor({ state: "visible" });
  await assert.doesNotReject(async () => {
    await page.locator(`text=${email}`).first().waitFor({ state: "visible", timeout: 10_000 });
  });
  await page.locator("#auth-sign-out-btn").click();
  await page.locator("#auth-modal-overlay").waitFor({ state: "detached", timeout: 10_000 });

  await openAuth(page);
  await page.locator("#auth-tab-login").click();
  await page.locator("#auth-email").fill(email);
  await page.locator("#auth-password").fill(password);
  await page.locator("#auth-email-submit").click();
  await page.locator("#auth-modal-overlay").waitFor({ state: "detached", timeout: 20_000 });

  await openAuth(page);
  await page.locator("#auth-sign-out-btn").waitFor({ state: "visible" });
  await page.locator("#auth-sign-out-btn").click();
  await page.locator("#auth-modal-overlay").waitFor({ state: "detached", timeout: 10_000 });

  await openAuth(page);
  await page.locator("#auth-tab-login").click();
  await page.locator("#auth-email").fill(email);
  await page.locator("#auth-reset-password-btn").click();
  await page.locator("#auth-notice-message").waitFor({ state: "visible", timeout: 15_000 });

  console.log(
    "Hosted production auth E2E passed: signup -> authenticated UI -> logout -> login -> logout -> password reset notice.",
  );
} finally {
  try {
    await signOut(qaAuth);
  } catch {}
  try {
    qaCredential = await signInWithEmailAndPassword(qaAuth, email, password);
  } catch {}
  try {
    await cleanupSyntheticAccount();
    console.log("Synthetic hosted-auth QA account and owned cloud data removed.");
  } finally {
    if (browser) await browser.close();
    await deleteApp(qaApp);
  }
}
