import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const BASE_URL = "http://127.0.0.1:3000";

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

const appLogFd = fs.openSync("/tmp/balkanbite-google-auth-ui.log", "w");
const app = spawn("npm", ["run", "dev"], {
  env: { ...process.env, GEMINI_API_KEY: "" },
  stdio: ["ignore", appLogFd, appLogFd],
});

let browser;
try {
  await waitForHealth();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem("balkanbite_show_landing", "false");
  });
  await page.reload({ waitUntil: "networkidle" });

  await page.locator("#header-auth-btn").click();
  const modal = page.locator("#auth-modal-card");
  await modal.waitFor({ state: "visible" });

  assert.equal(await modal.locator("#btn-google-sign-in").count(), 1, "Google sign-in must be the single hosted sign-in option");
  await modal.locator("#btn-google-sign-in").waitFor({ state: "visible" });
  assert.equal(await modal.locator('input[type="email"]').count(), 0, "Email sign-in must not be exposed");
  assert.equal(await modal.locator('input[type="password"]').count(), 0, "Password sign-in must not be exposed");
  assert.equal(await modal.getByRole("button", { name: /^Entrar$/i }).count(), 0, "Legacy email login tab must be absent");
  assert.equal(await modal.getByRole("button", { name: /^Registro$/i }).count(), 0, "Legacy email signup tab must be absent");
  assert.equal(await modal.locator("#auth-modal-guest-btn").count(), 1, "Guest access must remain available");

  const text = (await modal.innerText()).toLowerCase();
  assert.ok(text.includes("google"), "Modal must identify Google as the hosted provider");
  assert.ok(!text.includes("cifrado de grado médico"), "Unsupported medical-grade encryption claim must be absent");
  assert.ok(!text.includes("medical-grade encryption"), "Unsupported medical-grade encryption claim must be absent");

  await modal.locator("#auth-modal-close-btn").click();
  await modal.waitFor({ state: "hidden" });

  console.log("BalkanBite Google-only auth UI E2E: PASS");
} finally {
  if (browser) await browser.close();
  app.kill("SIGTERM");
  fs.closeSync(appLogFd);
}
