import { test } from "node:test";
import assert from "node:assert/strict";
import { nextTask } from "../src/next-task";
import { cosine, rankSemanticLinks, semanticPages } from "../src/semantic-links";
import { analyze, parsePage } from "../server/audit";
import type { Scan, Repair } from "../src/types";
const makeScan = (): Scan => { const pages = [parsePage('<title>Site performance guide</title><h1>Website performance</h1><p>Improve website performance by measuring page loading times and reducing unnecessary assets for visitors.</p>', 'https://example.test/guide'), parsePage('<title>Fast page loading checklist</title><h1>Page loading speed</h1><p>Measure website performance before and after reducing images and JavaScript to check how fast pages load.</p>', 'https://example.test/speed'), parsePage('<title>Privacy policy</title><p>Website performance and loading speed appear here but this privacy policy is not an editorial link placement.</p>', 'https://example.test/privacy')]; return { id: 'baseline', url: pages[0].url, startedAt: '2026-11-27T00:00:00Z', status: 'completed', limit: 10, pages, ...analyze(pages), discovered: 3, skipped: 0, skippedUrls: [], notice: [] }; };
test('next action resumes reported publication without claiming a fix and otherwise names a real finding', () => {
 const scan = makeScan(); const repair: Repair = { id:'draft', url:scan.url, field:'title', original:'Old', value:'New', workflow:{revision:1,baselineScanId:scan.id,updatedAt:scan.startedAt,publishedAt:scan.startedAt,previous:[],checks:[]} };
 assert.equal(nextTask(scan,[repair]).kind,'plan');
 const next = nextTask(scan,[]); assert.equal(next.kind,'finding'); assert(scan.issues.some(i=>i.id===next.issueId));
});
test('semantic matching excludes legal, unreadable and noindex pages, keeps exact anchors and refuses existing links', () => {
 const scan=makeScan(); const pages=semanticPages(scan);
 assert.equal(pages.length,2);
 const vectors={targets:[[1,0],[1,0]],paragraphs:[[[1,0]],[[1,0]]]};
 const rows=rankSemanticLinks(pages,vectors);assert(rows.length>0);
 assert(rows.every(row=>!row.anchor||row.context.includes(row.anchor)));
 assert.equal(rankSemanticLinks([{...pages[0],links:[{url:pages[1].finalUrl,text:'speed'}]},pages[1]],vectors).filter(row=>row.source===pages[0].url).length,0);
 assert.equal(cosine([0,0],[1,2]),0);assert.equal(cosine([1],[1,0]),0);
 scan.pages[1].robots='noindex';assert.equal(semanticPages(scan).length,1);
});
test('semantic ranking is bounded and a focused page never returns unrelated pairs', () => {
 const pages=semanticPages(makeScan());const vectors={targets:[[1,0],[1,0]],paragraphs:[[[1,0]],[[1,0]]]};
 assert(rankSemanticLinks(pages,vectors,pages[0].url).every(r=>r.source===pages[0].url||r.target===pages[0].url));
 assert.deepEqual(rankSemanticLinks(pages,{targets:[[1,0],[0,1]],paragraphs:[[[1,0]],[[0,1]]]}),[]);
});

import { readFileSync } from "node:fs";
import { browserPolicy } from "../src/browser-policy";
import { editorialLinkPage } from "../src/link-eligibility";
test('editorial suggestions exclude policy pages in either role while retaining editorial privacy articles', () => {
 const scan=makeScan();
 const policy=scan.pages[2];
 assert.equal(editorialLinkPage(policy),false);
 assert.equal(editorialLinkPage({...policy,url:'https://example.test/privacy-first-design'}),true);
 assert.equal(editorialLinkPage({...scan.pages[0],status:503}),false);
 assert.equal(editorialLinkPage({...scan.pages[0],robots:'none'}),false);
 assert(analyze(scan.pages).suggestions.every(row=>row.source!==policy.url&&row.target!==policy.url));
 const pages=semanticPages(scan);
 const rows=rankSemanticLinks(pages,{targets:[[1,0],[1,0]],paragraphs:[[[1,0]],[[1,0]]]});
 assert.equal(rows.find(row=>row.source===pages[0].url)?.anchor,'');
});
test('local production and hosted worker policies stay aligned without enabling JavaScript eval', () => {
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(config.headers[0].headers.find((h:any)=>h.key==='Content-Security-Policy').value,browserPolicy);
 assert(!browserPolicy.includes("'unsafe-eval'"));assert(browserPolicy.includes("'wasm-unsafe-eval'"));
});
