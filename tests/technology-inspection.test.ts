import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectTechnology } from "../server/inspect-technology";
test('on-demand inspection reads bounded first-party assets without executing scripts or following external assets', async () => {
  const calls: string[] = [];
  const fetcher = (async (url: string | URL | Request) => { const value = String(url); calls.push(value); if (value.endsWith('/robots.txt')) return new Response('User-agent: *\nAllow: /'); if (value.endsWith('/assets/app.js')) return new Response('react.transitional.element __vite__mapDeps ' + 'x'.repeat(800000), { headers: { 'content-type': 'application/javascript' } }); return new Response('<script type="module" src="/assets/app.js"></script><script src="https://outside.example/track.js"></script>', { headers: { 'content-type': 'text/html' } }); }) as typeof fetch;
  const result = await inspectTechnology('https://example.com/', new AbortController().signal, fetcher);
  assert(result.technologies.some(item => item.name === 'React')); assert(result.technologies.some(item => item.name === 'Vite')); assert.equal(result.inspectedScripts, 1); assert(!calls.some(url => url.includes('outside.example')));
});
test('on-demand inspection refuses private destinations and robots exclusions before reading page assets', async () => {
  await assert.rejects(inspectTechnology('http://127.0.0.1/', new AbortController().signal), /public|private|reserved|localhost/i);
  let count = 0; await assert.rejects(inspectTechnology('https://example.com/private', new AbortController().signal, (async () => { count++; return new Response('User-agent: *\nDisallow: /private'); }) as typeof fetch), /robots.txt excludes/); assert.equal(count, 1);
});
