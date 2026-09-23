import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const request = JSON.parse(
  readFileSync(new URL("./hosted-run-request.json", import.meta.url), "utf8"),
);
const expectedDb =
  "ai-studio-balkanbite-9bd2735f-15da-4be1-a327-f9c6d29866b6";
const expectedProject = "gen-lang-client-0319723351";
const target = "https://balkanbite.vercel.app";

assert.equal(process.env.GITHUB_REF, "refs/heads/qa/hosted-email-auth-e2e");
assert.equal(request.mode, "one-time-synthetic-hosted-e2e");
assert.equal(request.projectId, expectedProject);
assert.equal(request.databaseId, expectedDb);
assert.equal(request.targetUrl, target);
assert.match(String(request.productionCommit || ""), /^[a-f0-9]{40}$/);
const response = await fetch(
  "https://api.github.com/repos/alejandrorastudini-boop/balkanbite/branches/main",
  { headers: { Accept: "application/vnd.github+json", "User-Agent": "BalkanBite-QA" } },
);
assert.equal(response.status, 200, "Unable to verify current production main SHA");
const currentMain = await response.json();
assert.equal(currentMain.commit?.sha, request.productionCommit,
  "Main advanced after approved QA request; review before running hosted writes");

const health = await fetch(target + "/api/health", { cache: "no-store" });
assert.equal(health.status, 200, "Production health route unavailable");
assert.equal((await health.json()).status, "ok");
const home = await fetch(target + "/", { cache: "no-store" });
assert.equal(home.status, 200, "Production homepage unavailable");
const html = await home.text();
const scriptPath = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
assert.ok(scriptPath, "Could not resolve production JavaScript asset");
const asset = await fetch(new URL(scriptPath, target));
assert.equal(asset.status, 200, "Production JavaScript asset unavailable");
const bundle = await asset.text();
assert.ok(bundle.includes(expectedDb),
  "Production bundle does not target approved named Firestore database");
console.log("One-time synthetic hosted QA manifest, main commit, health and JS database target verified.");
