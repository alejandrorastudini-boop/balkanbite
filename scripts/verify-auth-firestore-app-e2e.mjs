import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";

const BASE_URL = "http://127.0.0.1:3000";
const projectId = "demo-balkanbite-auth-e2e";
const password = "QaPassword123!";

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("App did not become healthy");
}

async function createEmulatorUser(email) {
  const response = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const body = await response.json();
  if (!response.ok) throw new Error(`Auth emulator user creation failed: ${JSON.stringify(body)}`);
  return body.localId;
}

async function adminDocs(testEnv, collectionName) {
  return testEnv.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDocs(collection(context.firestore(), collectionName));
    return snapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, data: snapshotDoc.data() }));
  });
}

async function adminSet(testEnv, collectionName, documentId, data) {
  return testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), collectionName, documentId), data);
  });
}

async function userSet(testEnv, uid, collectionName, documentId, data, options) {
  const db = testEnv.authenticatedContext(uid).firestore();
  await setDoc(doc(db, collectionName, documentId), data, options);
}

async function waitUntil(fn, label, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      last = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label} not reached${last ? `: ${last.message}` : ""}`);
}

async function readPantry(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("balkanbite_pantry") || "[]"));
}

async function readUserPantry(page, uid) {
  return page.evaluate((id) => JSON.parse(localStorage.getItem(`balkanbite_pantry_user_${id}`) || "null"), uid);
}

async function login(page, email) {
  await page.locator("#header-auth-btn").click();
  const modal = page.locator("#auth-modal-card");
  await modal.waitFor({ state: "visible" });
  await modal.getByRole("button", { name: /Entrar/i }).click();
  await modal.locator('input[type="email"]').fill(email);
  await modal.locator('input[type="password"]').fill(password);
  await modal.getByRole("button", { name: /Iniciar Sesión/i }).click();
  await modal.waitFor({ state: "hidden", timeout: 10000 });
}

async function logout(page) {
  await page.locator("#header-auth-btn").click();
  const modal = page.locator("#auth-modal-card");
  await modal.waitFor({ state: "visible" });
  await modal.locator("#auth-sign-out-btn").click();
  await modal.waitFor({ state: "hidden", timeout: 10000 });
}

async function addPantryItem(page, name, quantity = 1, unit = "pcs") {
  await page.locator("#nav-tab-pantry").click();
  await page.locator("#pantry-add-item-btn").click();
  const form = page.locator("#pantry-view form").last();
  await form.waitFor({ state: "visible" });
  await form.locator('input[type="text"]').fill(name);
  await form.locator('input[type="number"]').nth(0).fill(String(quantity));
  await form.locator("select").nth(0).selectOption(unit);
  await form.locator('button[type="submit"]').click();
  await form.waitFor({ state: "hidden" });
}

async function clearPantry(page) {
  await page.locator("#nav-tab-pantry").click();
  await page.locator("#pantry-clear-all-btn").click();
  const confirmOverlay = page.locator("div.fixed.inset-0.z-50").last();
  await confirmOverlay.waitFor({ state: "visible" });
  await confirmOverlay.locator("button").last().click();
}

const appLogFd = fs.openSync("/tmp/balkanbite-auth-app-e2e.log", "w");
const app = spawn("npm", ["run", "dev"], {
  env: { ...process.env, VITE_FIREBASE_EMULATOR: "1" },
  stdio: ["ignore", appLogFd, appLogFd],
});

let browser;
let testEnv;
try {
  await waitForHealth();
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });

  const uidA = await createEmulatorUser("qa-a@example.invalid");
  const uidB = await createEmulatorUser("qa-b@example.invalid");
  assert.notEqual(uidA, uidB);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", async (dialog) => { try { await dialog.accept(); } catch {} });

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("balkanbite_show_landing", "false");
    localStorage.setItem("balkanbite_pantry", JSON.stringify([
      {
        id: "guest-only",
        name: "Guest Only",
        quantity: 7,
        unit: "uds",
        category: "Other",
        addedAt: "2026-09-13"
      }
    ]));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#pantry-view").waitFor({ state: "visible" });
  assert.equal((await readPantry(page))[0].id, "guest-only");

  // A: empty remote inventory is authoritative; guest inventory must not import.
  await login(page, "qa-a@example.invalid");
  await waitUntil(async () => {
    const cached = await readUserPantry(page, uidA);
    return Array.isArray(cached) && cached.length === 0;
  }, "user A empty cloud hydration");
  assert.equal((await readPantry(page))[0].id, "guest-only", "guest storage key must remain untouched while authenticated");
  assert.equal(await page.locator('[id^="pantry-item-"]').count(), 0, "authenticated empty snapshot must replace visible guest inventory");
  let inventoryDocs = await adminDocs(testEnv, "inventory");
  assert.equal(inventoryDocs.filter(({ data }) => data.userId === uidA).length, 0, "demo/guest pantry must not auto-upload");

  // A local mutation persists to a namespaced physical document.
  await addPantryItem(page, "Auth A Tomato", 2, "pcs");
  const aDoc = await waitUntil(async () => {
    const docs = await adminDocs(testEnv, "inventory");
    return docs.find(({ data }) => data.userId === uidA && data.name === "Auth A Tomato");
  }, "user A namespaced inventory write");
  assert.ok(aDoc.id.startsWith(`u_${encodeURIComponent(uidA)}__`));
  assert.equal(aDoc.data._deleted, false);

  // Logout restores the guest pantry exactly.
  await logout(page);
  await waitUntil(async () => (await page.locator("#pantry-item-guest-only").count()) === 1, "guest pantry restoration");
  assert.equal((await readPantry(page))[0].id, "guest-only");

  // B gets an independent empty cloud and cannot see A.
  await login(page, "qa-b@example.invalid");
  await waitUntil(async () => {
    const cached = await readUserPantry(page, uidB);
    return Array.isArray(cached) && cached.length === 0;
  }, "user B empty cloud hydration");
  assert.equal(await page.getByText("Auth A Tomato", { exact: true }).count(), 0);
  await addPantryItem(page, "Auth B Pepper", 3, "pcs");
  const bDoc = await waitUntil(async () => {
    const docs = await adminDocs(testEnv, "inventory");
    return docs.find(({ data }) => data.userId === uidB && data.name === "Auth B Pepper");
  }, "user B namespaced inventory write");
  assert.ok(bDoc.id.startsWith(`u_${encodeURIComponent(uidB)}__`));
  assert.notEqual(aDoc.id, bDoc.id);

  await logout(page);
  await waitUntil(async () => (await page.locator("#pantry-item-guest-only").count()) === 1, "guest restore after B");

  // Return to A: A inventory returns, B stays isolated.
  await login(page, "qa-a@example.invalid");
  await waitUntil(async () => (await page.getByText("Auth A Tomato", { exact: true }).count()) === 1, "user A inventory restore");
  assert.equal(await page.getByText("Auth B Pepper", { exact: true }).count(), 0);

  // Legacy inventory remains readable.
  await adminSet(testEnv, "inventory", "legacy-a", {
    id: "logical-legacy",
    userId: uidA,
    name: "Legacy A",
    quantity: 1,
    unit: "uds",
    category: "Other",
    addedAt: "2026-09-13",
  });
  await waitUntil(async () => {
    const cached = await readUserPantry(page, uidA);
    return cached?.some((item) => item.id === "logical-legacy" && item.name === "Legacy A");
  }, "legacy inventory hydration");

  // If legacy and namespaced copies coexist, namespaced is authoritative.
  const scopedLegacyId = `u_${encodeURIComponent(uidA)}__logical-legacy`;
  await adminSet(testEnv, "inventory", scopedLegacyId, {
    id: "logical-legacy",
    userId: uidA,
    name: "Scoped A",
    quantity: 3,
    unit: "uds",
    category: "Other",
    addedAt: "2026-09-13",
    _deleted: false,
    deletedAt: null,
  });
  await waitUntil(async () => {
    const cached = await readUserPantry(page, uidA);
    const matches = cached?.filter((item) => item.id === "logical-legacy") || [];
    return matches.length === 1 && matches[0].name === "Scoped A" && matches[0].quantity === 3;
  }, "scoped inventory authority over legacy");

  // UI deletion writes a namespaced tombstone; legacy does not reappear.
  await page.locator("#pantry-item-logical-legacy").getByTitle("Eliminar").click();
  await waitUntil(async () => {
    const docs = await adminDocs(testEnv, "inventory");
    return docs.find(({ id }) => id === scopedLegacyId)?.data?._deleted === true;
  }, "tombstone after UI deletion");
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#pantry-item-logical-legacy").count(), 0, "legacy row must stay suppressed by tombstone");

  // A legitimate owner reactivation of the scoped doc is accepted and rehydrates live UI.
  await userSet(testEnv, uidA, "inventory", scopedLegacyId, {
    id: "logical-legacy",
    userId: uidA,
    name: "Reactivated A",
    quantity: 4,
    unit: "uds",
    category: "Other",
    addedAt: "2026-09-13",
    _deleted: false,
    deletedAt: null,
  }, { merge: true });
  await waitUntil(async () => (await page.getByText("Reactivated A", { exact: true }).count()) === 1, "reactivated inventory in UI");

  // Authenticated clear-all converts active inventory to tombstones rather than hard deletes.
  await clearPantry(page);
  await waitUntil(async () => {
    const cached = await readUserPantry(page, uidA);
    return Array.isArray(cached) && cached.length === 0;
  }, "authenticated clear-all local state");
  await waitUntil(async () => {
    const docs = await adminDocs(testEnv, "inventory");
    const own = docs.filter(({ data }) => data.userId === uidA);
    const visible = own.filter(({ id, data }) => id.startsWith(`u_${encodeURIComponent(uidA)}__`) && data._deleted !== true);
    return visible.length === 0;
  }, "all user A scoped inventory tombstoned");
  assert.equal(await page.locator('[id^="pantry-item-"]').count(), 0);

  // A remains empty after a logout/login cycle despite surviving legacy documents.
  await logout(page);
  await waitUntil(async () => (await page.locator("#pantry-item-guest-only").count()) === 1, "guest restore after clear");
  await login(page, "qa-a@example.invalid");
  await waitUntil(async () => {
    const cached = await readUserPantry(page, uidA);
    return Array.isArray(cached) && cached.length === 0;
  }, "A stays empty after tombstone hydration");
  assert.equal(await page.getByText("Legacy A", { exact: true }).count(), 0);
  assert.equal(await page.getByText("Auth B Pepper", { exact: true }).count(), 0);

  // B's inventory is still intact and isolated.
  await logout(page);
  await login(page, "qa-b@example.invalid");
  await waitUntil(async () => (await page.getByText("Auth B Pepper", { exact: true }).count()) === 1, "B inventory remains intact");
  assert.equal(await page.getByText("Auth A Tomato", { exact: true }).count(), 0);

  await context.close();
  console.log("BalkanBite Auth + Firestore app emulator E2E: PASS");
} finally {
  if (browser) await browser.close();
  if (testEnv) await testEnv.cleanup();
  app.kill("SIGTERM");
  fs.closeSync(appLogFd);
}
