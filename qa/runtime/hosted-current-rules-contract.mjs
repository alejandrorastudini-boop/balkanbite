import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { validateHostedRunRequestShape } from "./hosted-run-request-core.mjs";

assert.equal(process.env.QA_ALLOW_HOSTED_WRITES, "true",
  "Explicit QA_ALLOW_HOSTED_WRITES=true required");
assert.equal(process.env.GITHUB_REF, "refs/heads/main",
  "Hosted write probe can run only from reviewed main");
const runRequest=JSON.parse(
  readFileSync(new URL("./hosted-run-request.json", import.meta.url), "utf8"),
);
const runGate=validateHostedRunRequestShape(runRequest);
assert.equal(runGate.writeEnabled,true,
  "Hosted write probe requires one-time-synthetic-hosted-e2e manifest mode");
const targetUrl = new URL(process.env.QA_HOSTED_TARGET_URL || "");
assert.equal(targetUrl.protocol, "https:");
assert.ok(targetUrl.hostname.endsWith(".vercel.app"));
assert.ok(targetUrl.hostname !== "balkanbite.vercel.app" ||
  process.env.QA_ALLOW_PRODUCTION_TARGET === "true",
  "Production target requires QA_ALLOW_PRODUCTION_TARGET=true");
assert.equal(targetUrl.origin,runRequest.targetUrl,
  "Hosted write target must equal reviewed manifest target");

const cfg = JSON.parse(readFileSync(new URL("../../firebase-applet-config.json", import.meta.url), "utf8"));
assert.equal(cfg.projectId, "gen-lang-client-0319723351",
  "Hosted QA Firebase config project changed unexpectedly");
const databaseId = "ai-studio-balkanbite-9bd2735f-15da-4be1-a327-f9c6d29866b6";
const base = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${databaseId}`;
const identityBase = "https://identitytoolkit.googleapis.com/v1";
const run = (process.env.GITHUB_RUN_ID || Date.now()) + "-" + (process.env.GITHUB_RUN_ATTEMPT || "1");
const scoped = (uid, id) => "u_" + encodeURIComponent(uid) + "__" + encodeURIComponent(id);
const headers = token => ({ authorization: "Bearer " + token, "content-type": "application/json" });
const docUrl = (collection, id) => base + "/documents/" + collection + "/" + encodeURIComponent(id);

async function identity(path, body, allowFailure = false) {
  const res = await fetch(identityBase + "/" + path + "?key=" + encodeURIComponent(cfg.apiKey), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const payload = await res.json();
  if (!res.ok && !allowFailure) throw new Error(path + ": " + (payload?.error?.message || res.status));
  return { res, payload };
}
const timestamp = value => ({ __timestamp: value });
const firestoreValue = value => {
  if (value && typeof value === "object" && "__timestamp" in value) {
    return { timestampValue: value.__timestamp };
  }
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (value && typeof value === "object") {
    return { mapValue: { fields: fields(value).fields } };
  }
  return { stringValue: String(value) };
};
const fields = object => ({
  fields: Object.fromEntries(Object.entries(object).map(([key, value]) => [key, firestoreValue(value)])),
});
async function patch(token, collection, id, body) {
  return fetch(docUrl(collection,id), { method:"PATCH", headers:headers(token), body:JSON.stringify(fields(body)) });
}
async function read(token, collection, id) { return fetch(docUrl(collection,id), { headers:headers(token) }); }
async function readAnonymous(collection, id) { return fetch(docUrl(collection,id)); }
async function del(token, collection, id) { return fetch(docUrl(collection,id), { method:"DELETE", headers:headers(token) }); }

const accounts=[];
let primaryError=null;
try {
  for (const label of ["owner","other"]) {
    const email=`balkanbite-rules-${run}-${label}@example.com`;
    const password="Bb-"+randomBytes(18).toString("base64url")+"-A1!";
    const signup=await identity("accounts:signUp",{email,password,returnSecureToken:true});
    accounts.push({email,password,uid:String(signup.payload.localId),token:String(signup.payload.idToken)});
  }
  const [owner,other]=accounts;
  assert.notEqual(owner.uid,other.uid);

  const now = timestamp(new Date().toISOString());
  const cases=[
    ["cookConfirmations","cook-"+run,{
      userId:owner.uid,cookConfirmationId:"cook-"+run,mealId:"meal-"+run,
      requestSignature:"sig-"+run,deductions:[{pantryItemId:"qa",quantity:1,unit:"pcs"}],
      createdAt:now,
    }],
    ["inventoryConsumptions","voice-"+run,{
      userId:owner.uid,mutationId:"voice-"+run,source:"voice",purpose:"food-use",
      requestSignature:"sig-"+run,deductions:[{pantryItemId:"qa",consumedQuantity:1,unit:"pcs"}],
      createdAt:now,
    }],
    ["purchaseApplications","purchase-"+run,{
      userId:owner.uid,mutationId:"purchase-"+run,source:"purchase",requestSignature:"sig-"+run,
      acceptedSourceIds:["shopping:qa"],newlyAppliedSourceIds:["shopping:qa"],
      expectedChanges:[{pantryItemId:"qa",quantity:1,unit:"pcs"}],createdAt:now,
    }],
    ["inventoryClearApplications","clear-"+run,{
      userId:owner.uid,mutationId:"clear-"+run,requestSignature:"sig-"+run,
      clearedIds:["qa"],createdAt:now,
    }],
  ];
  for (const [collection,id,payload] of cases) {
    const sid=scoped(owner.uid,id);
    const absent=await read(owner.token,collection,sid);
    assert.equal(absent.status,404,"Owner absent read must be allowed for "+collection);
    const foreignAbsent=await read(other.token,collection,sid);
    assert.equal(foreignAbsent.status,403,"Cross-user absent read must fail for "+collection);
    const createdRes=await patch(owner.token,collection,sid,payload);
    assert.equal(createdRes.status,200,"Owner create failed for "+collection+": "+await createdRes.text());
    assert.equal((await read(owner.token,collection,sid)).status,200);
    assert.equal((await read(other.token,collection,sid)).status,403);
    assert.ok([401,403].includes((await readAnonymous(collection,sid)).status),
      "Anonymous journal read not denied for "+collection);
    const mutate=await patch(owner.token,collection,sid,{...payload,requestSignature:"tampered"});
    assert.equal(mutate.status,403,"Immutable journal update not denied for "+collection);
    const remove=await del(owner.token,collection,sid);
    assert.equal(remove.status,403,"Immutable journal delete not denied for "+collection);
  }

  const inventoryId=scoped(owner.uid,"inventory-cleanup-"+run);
  const inventoryRow={
    userId:owner.uid,id:"inventory-cleanup-"+run,name:"QA synthetic inventory",
    quantity:1,unit:"pcs",cookRevision:0,
  };
  assert.equal((await read(owner.token,"inventory",inventoryId)).status,404,
    "Owner-scoped absent inventory ID must be readable");
  assert.equal((await read(other.token,"inventory",inventoryId)).status,403,
    "Cross-user absent inventory ID must remain hidden");
  assert.equal((await patch(owner.token,"inventory",inventoryId,inventoryRow)).status,200,
    "Owner inventory create failed");
  assert.equal((await patch(other.token,"inventory",inventoryId,{...inventoryRow,userId:other.uid})).status,403,
    "Cross-user inventory mutation not denied");
  assert.equal((await del(owner.token,"inventory",inventoryId)).status,200,
    "Unversioned synthetic inventory cleanup failed");
  assert.equal((await read(owner.token,"inventory",inventoryId)).status,404,
    "Synthetic inventory remained after cleanup");

  const shoppingId=scoped(owner.uid,"shortage-v1:qa:"+run);
  assert.equal((await read(owner.token,"shoppingList",shoppingId)).status,404,
    "Owner-scoped absent shopping row must be readable for transactional create");
  assert.equal((await read(other.token,"shoppingList",shoppingId)).status,403,
    "Cross-user absent shopping row must remain hidden");
  const shoppingRow={
    userId:owner.uid,id:"shortage-v1:qa:"+run,name:"QA synthetic shortage",
    quantity:1,unit:"pcs",category:"QA",checked:false,
    amountOrigin:"deterministic_shortfall",purchaseAmountConfirmed:false,
  };
  assert.equal((await patch(owner.token,"shoppingList",shoppingId,shoppingRow)).status,200,
    "Owner shopping create failed");
  assert.equal((await patch(other.token,"shoppingList",shoppingId,{...shoppingRow,userId:other.uid})).status,403,
    "Cross-user shopping mutation not denied");
  assert.equal((await del(owner.token,"shoppingList",shoppingId)).status,200,
    "Synthetic shopping row cleanup failed");
  assert.equal((await read(owner.token,"shoppingList",shoppingId)).status,404,
    "Synthetic shopping row remained after cleanup");

  const authorityId=scoped(owner.uid,"recipes");
  const authority={userId:owner.uid,collectionName:"recipes",revision:0,updatedAt:now};
  const authCreate=await patch(owner.token,"derivedCollectionAuthorities",authorityId,authority);
  assert.equal(authCreate.status,200,"Authority create failed: "+await authCreate.text());
  assert.equal((await read(other.token,"derivedCollectionAuthorities",authorityId)).status,403);
  assert.equal((await patch(other.token,"derivedCollectionAuthorities",authorityId,{...authority,userId:other.uid})).status,403);
  const authorityRevision1={...authority,revision:1,updatedAt:timestamp(new Date().toISOString())};
  assert.equal((await patch(owner.token,"derivedCollectionAuthorities",authorityId,authorityRevision1)).status,200,
    "Owner authority revision +1 must succeed");
  const skippedRevision={...authority,revision:3,updatedAt:timestamp(new Date().toISOString())};
  assert.equal((await patch(owner.token,"derivedCollectionAuthorities",authorityId,skippedRevision)).status,403,
    "Authority revision jump must fail closed");

  console.log("Hosted current Rules contract passed: current journals + derived authority owner isolation and immutability.");
} catch (error) {
  primaryError=error;
  throw error;
} finally {
  // Current immutable journals intentionally cannot be deleted by their owner.
  // They use synthetic-only IDs and no customer data; deleting the temporary
  // Auth identities below prevents future authenticated access. A privileged
  // cleanup mechanism is intentionally not introduced just for QA.
  const cleanupErrors=[];
  for (const account of accounts) {
    try {
      const deletion=await identity("accounts:delete",{idToken:account.token},true);
      assert.equal(deletion.res.ok,true,"Synthetic Auth account deletion failed for "+account.email);
      const verify=await identity("accounts:signInWithPassword",{
        email:account.email,password:account.password,returnSecureToken:true,
      },true);
      assert.equal(verify.res.ok,false,"Synthetic Auth account still accepts login: "+account.email);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length) {
    throw new AggregateError(primaryError ? [primaryError,...cleanupErrors] : cleanupErrors,
      "Synthetic hosted QA failed and/or Auth cleanup was incomplete");
  }
}
