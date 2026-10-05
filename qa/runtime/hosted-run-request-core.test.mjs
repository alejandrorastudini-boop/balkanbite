import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPECTED_HOSTED_DATABASE,
  EXPECTED_HOSTED_PROJECT,
  EXPECTED_HOSTED_TARGET,
  validateHostedRunRequestShape,
} from "./hosted-run-request-core.mjs";

const base={
  projectId:EXPECTED_HOSTED_PROJECT,
  databaseId:EXPECTED_HOSTED_DATABASE,
  targetUrl:EXPECTED_HOSTED_TARGET,
  productionCommit:"a".repeat(40),
  rulesSha256:"b".repeat(64),
};

test("disabled hosted request never enables writes and accepts placeholders",()=>{
  const gate=validateHostedRunRequestShape({
    ...base,mode:"disabled",productionCommit:"0".repeat(40),rulesSha256:"0".repeat(64),
  });
  assert.deepEqual(gate,{disabled:true,writeEnabled:false});
});

test("read-only preflight never enables writes",()=>{
  assert.deepEqual(validateHostedRunRequestShape({...base,mode:"hosted-readonly-preflight"}),
    {disabled:false,writeEnabled:false});
});

test("only explicit synthetic E2E mode enables writes",()=>{
  assert.deepEqual(validateHostedRunRequestShape({...base,mode:"one-time-synthetic-hosted-e2e"}),
    {disabled:false,writeEnabled:true});
});

test("active hosted requests fail closed on malformed or wrong target pins",()=>{
  assert.throws(()=>validateHostedRunRequestShape({...base,mode:"hosted-readonly-preflight",productionCommit:"short"}));
  assert.throws(()=>validateHostedRunRequestShape({...base,mode:"hosted-readonly-preflight",rulesSha256:"bad"}));
  assert.throws(()=>validateHostedRunRequestShape({...base,mode:"hosted-readonly-preflight",databaseId:"(default)"}));
  assert.throws(()=>validateHostedRunRequestShape({...base,mode:"hosted-readonly-preflight",targetUrl:"https://example.com"}));
  assert.throws(()=>validateHostedRunRequestShape({...base,mode:"unexpected"}));
});
