import { test } from "node:test";
import assert from "node:assert/strict";
import { editableField, fixSteps, linkStatus, pageLinks } from "../src/page-evidence";
import { analyze, parsePage } from "../server/audit";
import type { Issue } from "../src/types";

test("a healthy source exposes every broken destination with its status and anchor; unknown links stay unknown", () => {
  const source = parsePage('<title>Source</title><a href="/gone">Article</a><a href="/gone" rel="nofollow">Footer article</a><a href="/blocked">Restricted</a><a href="/unscanned">Unknown</a><a href="https://outside.test/">External</a>', 'https://site.test/');
  const gone = { ...parsePage('', 'https://site.test/gone'), status: 404 };
  const blocked = { ...parsePage('', 'https://site.test/blocked'), status: 403 };
  const pages = [source, gone, blocked];
  const issue = analyze(pages).issues.find(issue => issue.type === 'broken_internal')!;
  assert.equal(source.status, 200);
  assert.deepEqual(issue.detail.split('\n'), [gone.url, blocked.url]);
  const links = pageLinks(source, pages);
  assert.equal(links.outgoing.length, 5);
  assert.deepEqual(links.outgoing.filter(link => link.target?.status === 404).map(link => [link.text, link.nofollow]), [['Article', false], ['Footer article', true]]);
  assert.equal(linkStatus(links.outgoing[3].target), 'Not scanned');
  assert.equal(links.outgoing[4].internal, false);
  assert.equal(pageLinks(gone, pages).incoming.length, 2);
  assert.match(fixSteps(issue, source).join(' '), /401\/403\/429/);
});

test("incoming aliases resolve to their retained destination without stealing exact URL records", () => {
  const source = parsePage('<a href="/old">Old</a><a href="/new">New</a>', 'https://site.test/');
  const redirected = { ...parsePage('', 'https://site.test/old'), finalUrl: 'https://site.test/new', redirects: 1 };
  assert.equal(pageLinks(redirected, [source, redirected]).incoming.length, 2);
  const destination = parsePage('', 'https://site.test/new');
  assert.equal(pageLinks(redirected, [source, redirected, destination]).incoming.length, 1);
  assert.equal(pageLinks(destination, [source, redirected, destination]).incoming[0].text, 'New');
});

test("fix guidance separates missing pages, denied access, server failures and editable metadata", () => {
  const page = parsePage('', 'https://site.test/');
  const issue = { type: 'http_error', action: 'Check response' } as Issue;
  assert.match(fixSteps(issue, { ...page, status: 404 })[0], /Restore/);
  assert.match(fixSteps(issue, { ...page, status: 403 })[0], /does not prove/);
  assert.match(fixSteps(issue, { ...page, status: 503 })[0], /server logs/);
  assert.equal(editableField({ type: 'missing_description' } as Issue), 'meta_description');
  assert.equal(editableField({ type: 'missing_h1' } as Issue), null);
  assert.match(linkStatus({ ...page, status: 0, error: 'Timed out' }), /Could not read/);
});
