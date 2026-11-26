import { test } from "node:test";
import assert from "node:assert/strict";
import { pageSpeedRequest, parseSpeedReport, readSpeedSummary } from "../src/pagespeed.js";
const report = { requestedUrl:"https://example.com/", finalUrl:"https://example.com/", lighthouseVersion:"13.0.0", fetchTime:"2026-11-26T10:00:00.000Z", configSettings:{formFactor:"mobile"}, categories:{performance:{score:0},seo:{score:null}}, audits:{"largest-contentful-paint":{numericValue:2300,displayValue:"2.3 s"},"cumulative-layout-shift":{numericValue:0},"render-blocking-resources":{title:"Remove render blocking resources",description:"Review resources",score:0,displayValue:"500 ms"},"manual-audit":{score:0,scoreDisplayMode:"manual"}} };
test("speed results preserve zero, distinguish missing scores and label the tested device",()=>{
  const parsed=parseSpeedReport({lighthouseResult:report},"google");
  assert.equal(parsed.scores[0].score,0); assert.equal(parsed.scores[1].score,null); assert.equal(parsed.scores[3].score,null);
  assert.equal(parsed.metrics.find(m=>m.id==="cumulative-layout-shift")?.value,"0.000"); assert.equal(parsed.device,"mobile");
  assert.deepEqual(parsed.opportunities.map(o=>o.id),["render-blocking-resources"]);
  assert.deepEqual(readSpeedSummary(parsed),parsed);
  assert.throws(()=>readSpeedSummary({...parsed,scores:[{score:200}]}),/invalid/);
  assert.throws(()=>parseSpeedReport({lighthouseResult:{...report,runtimeError:{code:"NO_FCP"}}},"import"),/could not complete/);
  assert.throws(()=>parseSpeedReport({schema:"seo-workbench-scan/v1"},"import"),/Lighthouse/);
});
test("speed requests use only Google, validate URLs, omit credentials and preserve category/device selection",()=>{
  const endpoint=new URL(pageSpeedRequest("https://example.com/#section","desktop"));
  assert.equal(endpoint.origin,"https://www.googleapis.com"); assert.equal(endpoint.searchParams.get("strategy"),"desktop");
  assert.equal(endpoint.searchParams.get("url"),"https://example.com/"); assert.equal(endpoint.searchParams.has("key"),false); assert.equal(endpoint.searchParams.getAll("category").length,4);
  assert.equal(new URL(pageSpeedRequest("https://example.com/","mobile","my-own-test-key")).searchParams.get("key"),"my-own-test-key");
  assert.throws(()=>pageSpeedRequest("javascript:alert(1)","mobile"),/HTTP/);
  assert.throws(()=>pageSpeedRequest("https://password:secret@example.com/","mobile"),/password/);
});
