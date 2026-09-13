import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, getDocs } from "firebase/firestore";

const BASE_URL = "http://127.0.0.1:3000";
const projectId = "demo-balkanbite-empty-cloud-risk";
const email = "qa-empty-cloud@example.invalid";
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

async function createEmulatorUser() {
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
  let documents = [];
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDocs(collection(context.firestore(), collectionName));
    documents = snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  });
  return documents;
}

async function waitUntil(fn, label, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label} not reached`);
}

async function login(page) {
  await page.locator("#header-auth-btn").click();
  const modal = page.locator("#auth-modal-card");
  await modal.waitFor({ state: "visible" });
  await modal.getByRole("button", { name: /Entrar/i }).click();
  await modal.locator('input[type="email"]').fill(email);
  await modal.locator('input[type="password"]').fill(password);
  await modal.getByRole("button", { name: /Iniciar Sesión/i }).click();
  await modal.waitFor({ state: "hidden", timeout: 10000 });
}

const appLogFd = fs.openSync("/tmp/balkanbite-empty-cloud-risk.log", "w");
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

  const uid = await createEmulatorUser();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("balkanbite_show_landing", "false");
  });
  await page.reload({ waitUntil: "networkidle" });

  await login(page);
  await waitUntil(async () => {
    return page.evaluate((id) => {
      const raw = localStorage.getItem(`balkanbite_pantry_user_${id}`);
      if (raw === null) return false;
      const value = JSON.parse(raw);
      return Array.isArray(value) && value.length === 0;
    }, uid);
  }, "authoritative empty inventory hydration");

  // Give secondary collection hydration/write effects time to settle.
  await page.waitForTimeout(2000);

  const recipes = (await adminDocs(testEnv, "recipes")).filter(({ data }) => data.userId === uid);
  const mealPlans = (await adminDocs(testEnv, "mealPlans")).filter(({ data }) => data.userId === uid);
  const shopping = (await adminDocs(testEnv, "shoppingList")).filter(({ data }) => data.userId === uid);

  console.log(JSON.stringify({
    uid,
    recipesWrittenFromEmptyCloud: recipes.length,
    mealPlansWrittenFromEmptyCloud: mealPlans.length,
    shoppingItemsWrittenFromEmptyCloud: shopping.length,
  }));

  assert.equal(recipes.length, 0, "empty hosted recipes must not be populated from local/default state on first login");
  assert.equal(mealPlans.length, 0, "empty hosted mealPlans must not be populated from local/default state on first login");
  assert.equal(shopping.length, 0, "empty hosted shoppingList must not be populated from local/default state on first login");

  await context.close();
  console.log("BalkanBite empty-cloud secondary collection guard: PASS");
} finally {
  if (browser) await browser.close();
  if (testEnv) await testEnv.cleanup();
  app.kill("SIGTERM");
  fs.closeSync(appLogFd);
}
