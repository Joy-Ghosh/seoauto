import { test } from "node:test";
import assert from "node:assert/strict";
import { createSearchConsoleApi } from "../server/search-console";
const config = { secret: 'fixture-secret-that-is-long-enough-for-encryption', passwordHash: '', secure: true };
const credentials = { clientId: 'fixture-client-id', clientSecret: 'fixture-client-secret' };
test('Google OAuth uses PKCE, bounded state, fixed endpoints and owner-bound encrypted credentials', async () => {
  const calls: string[] = [];
  const handler = createSearchConsoleApi(config, (async (url, init) => {
    calls.push(String(url)); assert.equal(url, 'https://oauth2.googleapis.com/token');
    assert(String(init?.body).includes('code_verifier='));
    return Response.json({ access_token: 'fixture-google-token', scope: 'https://www.googleapis.com/auth/webmasters.readonly', expires_in: 3600 });
  }) as typeof fetch, credentials);
  const response = await handler(new Request('https://app.test/api/search-console/connect'), '/api/search-console/connect', 'owner-a');
  assert.equal(response.status, 303); const location = new URL(response.headers.get('location')!); assert.equal(location.hostname, 'accounts.google.com'); assert.equal(location.searchParams.get('code_challenge_method'), 'S256'); assert.equal(location.searchParams.get('scope'), 'https://www.googleapis.com/auth/webmasters.readonly');
  const cookie = response.headers.getSetCookie()[0]; assert(cookie.includes('HttpOnly')); assert(cookie.includes('SameSite=Lax')); assert(!cookie.includes('owner-a'));
  const callback = 'https://app.test/api/search-console/callback?state=' + location.searchParams.get('state') + '&code=fixture-code';
  assert.equal((await handler(new Request(callback), '/api/search-console/callback')).status, 400);
  const completed = await handler(new Request(callback, { headers: { cookie: cookie.split(';')[0] } }), '/api/search-console/callback'); assert.equal(completed.status, 303); assert.equal(calls.length, 1);
  const accessCookie = completed.headers.getSetCookie().find(value => value.startsWith('__Host-seo-gsc='))!; assert(accessCookie.includes('SameSite=Strict')); assert(!accessCookie.includes('fixture-google-token'));
  const request = new Request('https://app.test/api/search-console/status', { headers: { cookie: accessCookie.split(';')[0] } });
  assert.equal((await (await handler(request, '/api/search-console/status', 'owner-a')).json()).connected, true);
  assert.equal((await (await handler(request, '/api/search-console/status', 'owner-b')).json()).connected, false);
});
test('Google configuration is optional and missing credentials never trigger a provider call', async () => {
  const handler = createSearchConsoleApi(config, (() => { throw Error('unexpected network'); }) as typeof fetch, { clientId: '', clientSecret: '' });
  const status = await (await handler(new Request('https://app.test/api/search-console/status'), '/api/search-console/status', 'owner')).json(); assert.equal(status.configured, false); assert.equal(status.connected, false);
  assert.equal((await handler(new Request('https://app.test/api/search-console/connect'), '/api/search-console/connect', 'owner')).status, 503);
  assert.equal((await handler(new Request('https://app.test/api/search-console/query', { method: 'POST' }), '/api/search-console/query', 'owner')).status, 401);
});
