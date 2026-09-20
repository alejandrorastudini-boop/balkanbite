import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const previewUrl = process.env.QA_PREVIEW_URL;
const trustedOidcToken = process.env.VERCEL_TRUSTED_OIDC_TOKEN || "";
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "";
const shareUrl = process.env.QA_SHARE_URL || "";
const artifactDir = process.env.QA_ARTIFACT_DIR || "artifacts/runtime-qa";
const expectedSha = process.env.QA_EXPECTED_SHA || "";
const expectedDeploymentId = process.env.QA_EXPECTED_DEPLOYMENT_ID || "";
const expectedFingerprint = process.env.QA_EXPECTED_FINGERPRINT || "";
const requestedLocalBypass = process.env.QA_ALLOW_UNPROTECTED_LOCAL === "true";
const delayMs = 30_000;
const shellDeadlineMs = 10_000;

if (!previewUrl) {
  throw new Error("QA_PREVIEW_URL is required");
}
if (!expectedSha) {
  throw new Error("QA_EXPECTED_SHA is required");
}
const previewHost = new URL(previewUrl).hostname;
const allowUnprotectedLocal =
  requestedLocalBypass && ["127.0.0.1", "localhost"].includes(previewHost);

if (requestedLocalBypass && !allowUnprotectedLocal) {
  throw new Error("QA_ALLOW_UNPROTECTED_LOCAL is restricted to localhost/127.0.0.1");
}
if (!trustedOidcToken && !bypassSecret && !shareUrl && !allowUnprotectedLocal) {
  throw new Error(
    "Protected preview access requires VERCEL_TRUSTED_OIDC_TOKEN, VERCEL_AUTOMATION_BYPASS_SECRET, or QA_SHARE_URL"
  );
}

await fs.mkdir(artifactDir, { recursive: true });

const extraHTTPHeaders = bypassSecret
  ? {
      "x-vercel-protection-bypass": bypassSecret,
      "x-vercel-set-bypass-cookie": "true",
    }
  : trustedOidcToken
    ? {
        "x-vercel-trusted-oidc-idp-token": trustedOidcToken,
      }
    : undefined;

const shareToken = shareUrl
  ? new URL(shareUrl).searchParams.get("_vercel_share")
  : null;

function scenarioUrl(cacheMode) {
  const url = new URL("/__qa/startup-cloud-sync", previewUrl);
  url.searchParams.set("delayMs", String(delayMs));
  url.searchParams.set("authDelayMs", "100");
  url.searchParams.set("cache", cacheMode);
  if (shareToken) url.searchParams.set("_vercel_share", shareToken);
  return url.toString();
}

async function textNumber(page, testId) {
  const text = (await page.getByTestId(testId).textContent())?.trim() || "";
  const number = Number(text);
  assert.ok(Number.isFinite(number), `${testId} must be numeric, got "${text}"`);
  return number;
}

async function waitForExpectedDeployment(page) {
  if (allowUnprotectedLocal) {
    await page.goto(scenarioUrl("present"), {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    const root = page.getByTestId("qa-runtime-root");
    await root.waitFor({ state: "attached", timeout: 10_000 });
    const localSha = ((await root.getAttribute("data-deployment-sha")) || "").trim();
    assert.equal(
      localSha,
      expectedSha,
      `local preview must serve the exact checked-out build SHA; expected ${expectedSha}, got ${localSha || "none"}`
    );
    return;
  }

  const deadline = Date.now() + 180_000;
  let lastSeenSha = "";
  let lastSeenDeploymentId = "";
  let lastSeenFingerprint = "";

  while (Date.now() < deadline) {
    await page.goto(scenarioUrl("present"), {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    const root = page.getByTestId("qa-runtime-root");
    try {
      await root.waitFor({ state: "attached", timeout: 10_000 });
      lastSeenSha = ((await root.getAttribute("data-deployment-sha")) || "").trim();
      lastSeenDeploymentId = (
        (await root.getAttribute("data-deployment-id")) || ""
      ).trim();
      lastSeenFingerprint = (
        (await root.getAttribute("data-source-fingerprint")) || ""
      ).trim();
    } catch {
      lastSeenSha = "";
      lastSeenDeploymentId = "";
      lastSeenFingerprint = "";
    }
    if (expectedFingerprint) {
      if (lastSeenFingerprint === expectedFingerprint) return;
    } else if (expectedDeploymentId) {
      if (lastSeenDeploymentId === expectedDeploymentId) return;
    } else if (lastSeenSha === expectedSha) {
      return;
    }
    await page.waitForTimeout(5_000);
  }

  throw new Error(
    `Preview alias did not reach expected deployment identity; expected SHA ${expectedSha}${expectedDeploymentId ? `, deployment ${expectedDeploymentId}` : ""}${expectedFingerprint ? `, fingerprint ${expectedFingerprint}` : ""}; last seen SHA ${lastSeenSha || "none"}, deployment ${lastSeenDeploymentId || "none"}, fingerprint ${lastSeenFingerprint || "none"}`
  );
}

async function runScenario(context, cacheMode) {
  const page = await context.newPage();
  const startedAt = Date.now();
  const evidence = {
    cacheMode,
    url: scenarioUrl(cacheMode).replace(/([?&]_vercel_share=)[^&]+/, "$1[redacted]"),
    shellVisibleMs: null,
    authResolvedMs: null,
    hydratedMs: null,
    preHydrationCommittedWrites: null,
    finalCommittedWrites: null,
    result: "running",
  };

  try {
    await waitForExpectedDeployment(page);
    await page.goto(scenarioUrl(cacheMode), {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    await page.getByTestId("qa-app-shell").waitFor({
      state: "visible",
      timeout: shellDeadlineMs,
    });
    evidence.shellVisibleMs = Date.now() - startedAt;
    assert.ok(
      evidence.shellVisibleMs < shellDeadlineMs,
      `usable shell exceeded ${shellDeadlineMs} ms: ${evidence.shellVisibleMs} ms`
    );

    assert.equal(
      await page.getByTestId("qa-fullscreen-overlay").count(),
      0,
      "full-screen startup overlay must be gone once auth resolves"
    );

    await page.getByTestId("qa-shell-action").click();
    assert.equal(
      (await page.getByTestId("qa-shell-interactions").textContent())?.trim(),
      "1",
      "non-inventory shell interaction must work before inventory hydration"
    );

    await page.getByTestId("qa-provisional-status").waitFor({ state: "visible" });
    assert.equal(
      (await page.getByTestId("qa-pantry-count").textContent())?.trim(),
      "—",
      "provisional inventory must not present a zero or cached count as authoritative"
    );
    assert.equal(
      (await page.getByTestId("qa-cloud-writes-allowed").textContent())?.trim(),
      "false",
      "cloud inventory writes must remain closed before hydration"
    );

    if (cacheMode === "present") {
      await page.getByText("QA Cached Yogurt", { exact: true }).waitFor({
        state: "visible",
      });
    } else {
      assert.equal(
        await page.getByText("QA Cached Yogurt", { exact: true }).count(),
        0,
        "no-cache scenario must not fabricate cached inventory"
      );
    }

    const addButton = page.locator("#pantry-add-item-btn");
    assert.equal(
      await addButton.isDisabled(),
      true,
      "pantry mutation controls must be disabled while inventory is provisional"
    );

    await page.waitForTimeout(1_000);
    evidence.preHydrationCommittedWrites = await textNumber(
      page,
      "qa-committed-writes"
    );
    assert.equal(
      evidence.preHydrationCommittedWrites,
      0,
      "pre-hydration write attempt must not commit to cloud"
    );

    await page.screenshot({
      path: path.join(artifactDir, `startup-${cacheMode}-provisional.png`),
      fullPage: true,
    });

    await page.getByTestId("qa-authoritative-status").waitFor({
      state: "visible",
      timeout: delayMs + 15_000,
    });

    evidence.hydratedMs = await textNumber(page, "qa-hydrated-ms");
    evidence.authResolvedMs = await textNumber(page, "qa-auth-resolved-ms");

    assert.ok(
      evidence.hydratedMs >= delayMs,
      `remote snapshot arrived before controlled delay: ${evidence.hydratedMs} ms`
    );
    assert.ok(
      evidence.hydratedMs < delayMs + 7_500,
      `remote snapshot took unexpectedly long: ${evidence.hydratedMs} ms`
    );

    assert.equal(
      (await page.getByTestId("qa-pantry-count").textContent())?.trim(),
      "1",
      "authoritative remote inventory count should replace provisional state"
    );
    await page.getByText("QA Remote Lentils", { exact: true }).waitFor({
      state: "visible",
    });
    assert.equal(
      await page.getByText("QA Cached Yogurt", { exact: true }).count(),
      0,
      "remote snapshot must replace provisional cache without duplication"
    );
    assert.equal(
      (await page.getByTestId("qa-cloud-writes-allowed").textContent())?.trim(),
      "true",
      "cloud write gate should open only after the authoritative snapshot"
    );
    assert.equal(
      await addButton.isDisabled(),
      false,
      "pantry mutation controls should re-enable after hydration"
    );

    await page.waitForFunction(() => {
      const node = document.querySelector('[data-testid="qa-committed-writes"]');
      return node?.textContent?.trim() === "1";
    });
    evidence.finalCommittedWrites = await textNumber(
      page,
      "qa-committed-writes"
    );
    assert.equal(
      evidence.finalCommittedWrites,
      1,
      "post-hydration write probe should be the first allowed cloud commit"
    );

    await page.screenshot({
      path: path.join(artifactDir, `startup-${cacheMode}-authoritative.png`),
      fullPage: true,
    });

    evidence.result = "pass";
    return evidence;
  } catch (error) {
    evidence.result = "fail";
    evidence.error = error instanceof Error ? error.message : String(error);
    await page
      .screenshot({
        path: path.join(artifactDir, `startup-${cacheMode}-failure.png`),
        fullPage: true,
      })
      .catch(() => {});
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
      evidence,
    });
  } finally {
    await page.close();
  }
}


function profileHealthDataUrl() {
  const url = new URL("/__qa/profile-health-data", previewUrl);
  if (shareToken) url.searchParams.set("_vercel_share", shareToken);
  return url.toString();
}

async function runProfileHealthDataControlScenario(context) {
  const page = await context.newPage();
  const evidence = {
    scenario: "profile-health-data-control",
    url: profileHealthDataUrl().replace(/([?&]_vercel_share=)[^&]+/, "$1[redacted]"),
    initialHealthProfilePresent: null,
    finalHealthProfilePresent: null,
    result: "running",
  };

  try {
    // Reuse the startup QA route as the trusted deployment-identity probe.
    await waitForExpectedDeployment(page);
    await page.goto(profileHealthDataUrl(), {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    const root = page.getByTestId("qa-profile-health-root");
    await root.waitFor({ state: "visible", timeout: 10_000 });

    assert.equal(
      ((await root.getAttribute("data-deployment-sha")) || "").trim(),
      expectedSha,
      "profile health-data QA must run against the exact expected build SHA"
    );

    evidence.initialHealthProfilePresent = (
      await page.getByTestId("qa-health-profile-present").textContent()
    )?.trim();
    assert.equal(
      evidence.initialHealthProfilePresent,
      "true",
      "QA profile must start with stored HealthProfile data"
    );

    const deleteButton = page.locator("#profile-clear-health-data-btn");
    await deleteButton.waitFor({ state: "visible", timeout: 10_000 });

    await page.screenshot({
      path: path.join(artifactDir, "profile-health-data-before-delete.png"),
      fullPage: true,
    });

    await deleteButton.click();
    await page
      .getByText(
        "Saved HealthProfile data will be removed. Your pantry, recipes, meal plan, and account will not be deleted.",
        { exact: true }
      )
      .waitFor({ state: "visible", timeout: 5_000 });

    const confirmButtons = page
      .getByRole("button", { name: "Delete health data", exact: true });
    assert.ok(
      (await confirmButtons.count()) >= 2,
      "confirmation must add a dedicated delete action"
    );
    await confirmButtons.last().click();

    await page.waitForFunction(() => {
      const node = document.querySelector('[data-testid="qa-health-profile-present"]');
      return node?.textContent?.trim() === "false";
    });

    evidence.finalHealthProfilePresent = (
      await page.getByTestId("qa-health-profile-present").textContent()
    )?.trim();
    assert.equal(
      evidence.finalHealthProfilePresent,
      "false",
      "confirmed deletion must remove HealthProfile from state"
    );
    assert.equal(
      await page.locator("#profile-clear-health-data-btn").count(),
      0,
      "health-data card must disappear after confirmed deletion"
    );

    await page.screenshot({
      path: path.join(artifactDir, "profile-health-data-after-delete.png"),
      fullPage: true,
    });

    evidence.result = "pass";
    return evidence;
  } catch (error) {
    evidence.result = "fail";
    evidence.error = error instanceof Error ? error.message : String(error);
    await page
      .screenshot({
        path: path.join(artifactDir, "profile-health-data-failure.png"),
        fullPage: true,
      })
      .catch(() => {});
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
      evidence,
    });
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  extraHTTPHeaders,
});
await context.tracing.start({ screenshots: true, snapshots: true });

let results = [];
let failure = null;

try {
  results = await Promise.all([
    runScenario(context, "present"),
    runScenario(context, "none"),
    runProfileHealthDataControlScenario(context),
  ]);
} catch (error) {
  failure = error;
  const partial = error?.evidence ? [error.evidence] : [];
  results = partial;
} finally {
  await context.tracing.stop({
    path: path.join(artifactDir, "playwright-trace.zip"),
  });
  await browser.close();
}

const summary = {
  generatedAt: new Date().toISOString(),
  previewUrl,
  expectedSha,
  expectedDeploymentId: expectedDeploymentId || null,
  expectedFingerprint: expectedFingerprint || null,
  delayMs,
  shellDeadlineMs,
  authMethod: bypassSecret
    ? "vercel-automation-bypass"
    : trustedOidcToken
      ? "vercel-trusted-source-oidc"
      : shareUrl
        ? "vercel-share-link"
        : "local-unprotected",
  results,
  status: failure ? "fail" : "pass",
};

await fs.writeFile(
  path.join(artifactDir, "startup-cloud-sync.json"),
  JSON.stringify(summary, null, 2) + "\n",
  "utf8"
);

console.log(JSON.stringify(summary, null, 2));

if (failure) {
  throw failure;
}
