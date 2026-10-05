import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const request = JSON.parse(
  readFileSync(new URL("./hosted-run-request.json", import.meta.url), "utf8"),
);
const expectedDb =
  "ai-studio-balkanbite-9bd2735f-15da-4be1-a327-f9c6d29866b6";
const expectedProject = "gen-lang-client-0319723351";
const target = "https://balkanbite.vercel.app";

assert.equal(process.env.GITHUB_REF, "refs/heads/qa/hosted-firestore-current-v2");
assert.equal(request.mode, "one-time-synthetic-hosted-e2e");
assert.equal(request.projectId, expectedProject);
assert.equal(request.databaseId, expectedDb);
assert.equal(request.targetUrl, target);
assert.match(String(request.productionCommit || ""), /^[a-f0-9]{40}$/);
assert.match(String(request.rulesSha256 || ""), /^[a-f0-9]{64}$/, "Exact production Rules SHA required");
const response = await fetch(
  "https://api.github.com/repos/alejandrorastudini-boop/balkanbite/branches/main",
  { headers: { Accept: "application/vnd.github+json", "User-Agent": "BalkanBite-QA" } },
);
assert.equal(response.status, 200, "Unable to verify current production main SHA");
const currentMain = await response.json();
assert.equal(currentMain.commit?.sha, request.productionCommit,
  "Main advanced after approved QA request; review before running hosted writes");

const rulesResponse = await fetch(
  "https://raw.githubusercontent.com/alejandrorastudini-boop/balkanbite/" +
    request.productionCommit + "/firestore.rules",
  { cache: "no-store" },
);
assert.equal(rulesResponse.status, 200, "Unable to recover firestore.rules for approved Production commit");
const rulesBytes = await rulesResponse.text();
const rulesHash = createHash("sha256").update(rulesBytes).digest("hex");
assert.equal(rulesHash, request.rulesSha256,
  "Approved hosted QA Rules SHA does not match exact Production commit");

const health = await fetch(target + "/api/health", { cache: "no-store" });
assert.equal(health.status, 200, "Production health route unavailable");
assert.equal((await health.json()).status, "ok");
const home = await fetch(target + "/", { cache: "no-store" });
assert.equal(home.status, 200, "Production homepage unavailable");
const html = await home.text();
const scriptPath = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
assert.ok(scriptPath, "Could not resolve production JavaScript asset");
const pendingAssets=[scriptPath];
const seenAssets=new Set();
let foundDatabase=false;
let foundCommit=false;
while (pendingAssets.length && seenAssets.size < 80 && (!foundDatabase || !foundCommit)) {
  const assetPath=pendingAssets.shift();
  if (!assetPath || seenAssets.has(assetPath)) continue;
  seenAssets.add(assetPath);
  const asset=await fetch(new URL(assetPath,target));
  assert.equal(asset.status,200,"Production JavaScript asset unavailable: "+assetPath);
  const bundle=await asset.text();
  foundDatabase ||= bundle.includes(expectedDb);
  foundCommit ||= bundle.includes(request.productionCommit);
  for (const match of bundle.matchAll(/(?:\\/)?assets\\/[A-Za-z0-9_.-]+\\.js/g)) {
    const normalized=match[0].startsWith("/") ? match[0] : "/"+match[0];
    if (!seenAssets.has(normalized)) pendingAssets.push(normalized);
  }
}
assert.equal(foundDatabase,true,
  "Production JavaScript graph does not target approved named Firestore database");
assert.equal(foundCommit,true,
  "Production JavaScript graph is not built from the exact approved main commit");
console.log("One-time synthetic hosted QA manifest, main commit, health and JS database target verified.");
