import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

assert.equal(process.env.QA_ALLOW_HOSTED_WRITES, "true",
  "Explicit QA_ALLOW_HOSTED_WRITES=true required");
const targetUrl = new URL(process.env.QA_HOSTED_TARGET_URL || "");
assert.equal(targetUrl.protocol, "https:");
assert.ok(targetUrl.hostname.endsWith(".vercel.app"));
assert.ok(targetUrl.hostname !== "balkanbite.vercel.app" ||
  process.env.QA_ALLOW_PRODUCTION_TARGET === "true",
  "Production target requires QA_ALLOW_PRODUCTION_TARGET=true");

const cfg = JSON.parse(readFileSync(new URL("../../firebase-applet-config.json", import.meta.url), "utf8"));
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
const fields = object => ({ fields: Object.fromEntries(Object.entries(object).map(([k,v]) => {
  if (typeof v === "boolean") return [k,{booleanValue:v}];
  if (typeof v === "number") return [k,{integerValue:String(v)}];
  if (Array.isArray(v)) return [k,{arrayValue:{values:v.map(x=>({mapValue:{fields:fields(x).fields}}))}}];
  return [k,{stringValue:String(v)}];
}))});
async function patch(token, collection, id, body) {
  return fetch(docUrl(collection,id), { method:"PATCH", headers:headers(token), body:JSON.stringify(fields(body)) });
}
async function read(token, collection, id) { return fetch(docUrl(collection,id), { headers:headers(token) }); }
async function del(token, collection, id) { return fetch(docUrl(collection,id), { method:"DELETE", headers:headers(token) }); }

const accounts=[];
const created=[];
try {
  for (const label of ["owner","other"]) {
    const email=`balkanbite-rules-${run}-${label}@example.com`;
    const password="Bb-"+randomBytes(18).toString("base64url")+"-A1!";
    const signup=await identity("accounts:signUp",{email,password,returnSecureToken:true});
    accounts.push({email,password,uid:String(signup.payload.localId),token:String(signup.payload.idToken)});
  }
  const [owner,other]=accounts;
  assert.notEqual(owner.uid,other.uid);

  const cases=[
    ["cookConfirmations","cook-"+run,{userId:owner.uid,cookConfirmationId:"cook-"+run,mealId:"meal-"+run,requestSignature:"sig-"+run,deductions:[{pantryItemId:"qa",quantity:1,unit:"pcs"}]}],
    ["inventoryConsumptions","voice-"+run,{userId:owner.uid,mutationId:"voice-"+run,source:"voice",purpose:"food-use",requestSignature:"sig-"+run,deductions:[{pantryItemId:"qa",consumedQuantity:1,unit:"pcs"}]}],
    ["purchaseApplications","purchase-"+run,{userId:owner.uid,mutationId:"purchase-"+run,requestSignature:"sig-"+run,acceptedSourceIds:["shopping:qa"]}],
    ["inventoryClearApplications","clear-"+run,{userId:owner.uid,mutationId:"clear-"+run,requestSignature:"sig-"+run,clearedIds:["qa"]}],
  ];
  for (const [collection,id,payload] of cases) {
    const sid=scoped(owner.uid,id);
    const absent=await read(owner.token,collection,sid);
    assert.equal(absent.status,404,"Owner absent read must be allowed for "+collection);
    const foreignAbsent=await read(other.token,collection,sid);
    assert.equal(foreignAbsent.status,403,"Cross-user absent read must fail for "+collection);
    const createdRes=await patch(owner.token,collection,sid,payload);
    assert.equal(createdRes.status,200,"Owner create failed for "+collection+": "+await createdRes.text());
    created.push([owner,collection,sid]);
    assert.equal((await read(owner.token,collection,sid)).status,200);
    assert.equal((await read(other.token,collection,sid)).status,403);
    const mutate=await patch(owner.token,collection,sid,{...payload,requestSignature:"tampered"});
    assert.equal(mutate.status,403,"Immutable journal update not denied for "+collection);
    const remove=await del(owner.token,collection,sid);
    assert.equal(remove.status,403,"Immutable journal delete not denied for "+collection);
  }

  const authorityId=scoped(owner.uid,"recipes");
  const authority={userId:owner.uid,collectionName:"recipes",revision:0};
  const authCreate=await patch(owner.token,"derivedCollectionAuthorities",authorityId,authority);
  assert.equal(authCreate.status,200,"Authority create failed: "+await authCreate.text());
  created.push([owner,"derivedCollectionAuthorities",authorityId]);
  assert.equal((await read(other.token,"derivedCollectionAuthorities",authorityId)).status,403);
  assert.equal((await patch(other.token,"derivedCollectionAuthorities",authorityId,{...authority,userId:other.uid})).status,403);

  console.log("Hosted current Rules contract passed: current journals + derived authority owner isolation and immutability.");
} finally {
  // Current immutable journals intentionally cannot be deleted by their owner.
  // They use synthetic-only IDs and no customer data; deleting the temporary
  // Auth identities below prevents future authenticated access. A privileged
  // cleanup mechanism is intentionally not introduced just for QA.
  for (const account of accounts) {
    const login=await identity("accounts:signInWithPassword",{email:account.email,password:account.password,returnSecureToken:true},true);
    if (login.res.ok) await identity("accounts:delete",{idToken:login.payload.idToken},true);
  }
}
