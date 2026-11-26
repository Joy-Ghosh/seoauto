import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSearchCsv, searchSummary } from "../src/search-data";
import { verifyChanges } from "../src/verification";
import { detectTechnologies } from "../server/technologies";
import { analyze, parsePage } from "../server/audit";
import type { Scan } from "../src/types";
import { titleConflicts } from "../src/title-review";
const scan = (id: string, date: string, pages: Scan["pages"]): Scan => ({ id, url: 'https://site.test/', startedAt: date, status: 'completed', limit: 10, pages, ...analyze(pages), discovered: pages.length, skipped: 0, skippedUrls: [], notice: [] });
test('Search Console imports quoted CSV, percentages and weighted metrics without inventing page-query joins', () => {
  const data = parseSearchCsv('Top queries,Clicks,Impressions,CTR,Position\r\n"treks, winter",2,100,2%,8\r\n"best ""trek""",3,300,1%,12', 'https://site.test/', '2026-11-01', '2026-11-20');
  assert.equal(data.rows[0].query, 'treks, winter'); assert.equal(data.rows[1].query, 'best "trek"'); assert.equal(data.rows[0].ctr, .02); assert.equal(data.rows[0].page, '');
  assert.deepEqual(searchSummary(data.rows), { clicks: 5, impressions: 400, ctr: .0125, position: 11 }); assert.match(data.warnings.join(' '), /cannot be inferred/);
});
test('Search Console rejects invalid imports and excludes other websites without discarding valid rows', () => {
  const data = parseSearchCsv('Page,Clicks,Impressions,CTR,Position\nhttps://site.test/a,1,10,10%,5\nhttps://other.test/a,1,10,10%,5\nhttps://site.test/b,20,10,200%,5', 'https://site.test/', '2026-11-01', '2026-11-20');
  assert.equal(data.rows.length, 1); assert.match(data.warnings.join(' '), /Skipped 2/);
  assert.throws(() => parseSearchCsv('x,y\n1,2', 'https://site.test/', '2026-11-01', '2026-11-20'), /English/);
  assert.throws(() => parseSearchCsv('Page,Clicks,Impressions,CTR,Position\n"unclosed', 'https://site.test/', '2026-11-01', '2026-11-20'), /unclosed/);
});
test('verification never calls unscanned or unreadable pages fixed and checks expected draft values', () => {
  const a = parsePage('<title>Old</title>', 'https://site.test/a'); const b = parsePage('', 'https://site.test/b');
  const before = scan('before', '2026-11-01T00:00:00Z', [a, b]);
  const after = scan('after', '2026-11-02T00:00:00Z', [parsePage('<title>New descriptive page title for testing</title><meta name="description" content="New description"><h1>Main heading</h1>', a.url)]);
  const result = verifyChanges(before, after, [{ id: 'draft', url: a.url, field: 'title', original: 'Old', value: after.pages[0].title }]);
  assert(result.findings.filter(row => row.issue.url === b.url).every(row => row.status === 'not_checked')); assert.equal(result.drafts[0].status, 'matches_draft'); assert(result.metadata.some(row => row.field === 'h1'));
  const failed = scan('failed', '2026-11-03T00:00:00Z', [{ ...a, status: 0, error: 'Timed out' }]); assert(verifyChanges(before, failed).findings.every(row => row.status === 'not_checked'));
  assert.throws(() => verifyChanges(before, before), /older baseline/);
});
test('technology hints retain evidence but never cookie values; skeleton blocks do not execute or capture scripts', () => {
  const technology = detectTechnologies('<script src="/_next/static/a.js"></script><img src="/wp-content/a.png">', new Headers({ 'x-powered-by': 'PHP/8.3', 'set-cookie': 'laravel_session=DO_NOT_RETAIN_ME' }));
  assert.deepEqual(technology.map(item => item.name), ['WordPress', 'Next.js', 'Laravel', 'PHP']); assert(!JSON.stringify(technology).includes('DO_NOT_RETAIN_ME'));
  assert.equal(detectTechnologies('<html><body>ordinary HTML</body></html>').length, 0);
  const page = parsePage('<main><h1>One</h1><p>Text <b>inside</b></p><img src="/photo.jpg"><script>dangerous()</script><h2>Two</h2></main>', 'https://site.test/');
  assert.deepEqual(page.outline?.map(block => block.kind), ['heading', 'paragraph', 'image', 'heading']); assert(!JSON.stringify(page.outline).includes('dangerous')); assert.equal(page.outline?.[0].region, 'main'); assert.equal(page.outline?.[3].level, 2);
});
test('one-page verification does not erase cross-page duplicates or untested broken destinations', () => {
  const a = parsePage('<title>Shared title</title><a href="/gone">Broken article</a>', 'https://site.test/a');
  const b = parsePage('<title>Shared title</title>', 'https://site.test/b');
  const gone = { ...parsePage('', 'https://site.test/gone'), status: 404 };
  const before = scan('before', '2026-11-01T00:00:00Z', [a, b, gone]);
  const current = parsePage('<title>New descriptive and distinct title</title><a href="/gone">Broken article</a>', a.url);
  const result = verifyChanges(before, scan('after', '2026-11-02T00:00:00Z', [current]));
  assert.equal(result.findings.find(row => row.issue.url === a.url && row.issue.type === 'duplicate_title')?.status, 'not_checked');
  assert.equal(result.findings.find(row => row.issue.url === a.url && row.issue.type === 'broken_internal')?.status, 'not_checked');
  current.links = [];
  assert.equal(verifyChanges(before, scan('after', '2026-11-02T00:00:00Z', [current])).findings.find(row => row.issue.url === a.url && row.issue.type === 'broken_internal')?.status, 'no_longer_observed');
});
test('bulk title approval detects duplicate drafts and conflicts with unchanged or already planned titles', () => {
  const a = parsePage('<title>First title</title>', 'https://site.test/a'); const b = parsePage('<title>Second title</title>', 'https://site.test/b');
  const first = { id: 'a', url: a.url, field: 'title' as const, original: a.title, value: 'Shared replacement' }; const second = { id: 'b', url: b.url, field: 'title' as const, original: b.title, value: ' shared   replacement ' };
  assert.equal(titleConflicts([a,b], [], [first,second]).size, 2); assert.equal(titleConflicts([a,b], [first], [second]).size, 1);
  assert.equal(titleConflicts([a,b], [], [{ ...first, value: b.title }]).size, 1);
  assert.equal(titleConflicts([a,b], [], [first, { ...second, value: 'Distinct other replacement' }]).size, 0);
});
