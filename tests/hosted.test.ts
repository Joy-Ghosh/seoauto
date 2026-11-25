import { test } from "node:test";
import assert from "node:assert/strict";
import type { lookup } from "node:dns";
import { createHostedHandler } from "../api/index.ts";
import {
  hashPassword,
  type AuthConfig,
  seal,
} from "../server/hosted-auth.ts";
import {
  createPublicFetch,
  guardedLookup,
  isPublicAddress,
  publicUrl,
} from "../server/public-network.ts";
import { NvidiaClient } from "../server/ai.ts";
import { DEFAULT_MODEL } from "../src/ai-types.ts";

const password = "fixture-owner-password-not-a-production-secret";
const config: AuthConfig = {
  secret: "fixture-secret-with-more-than-forty-characters-for-tests-only",
  passwordHash: hashPassword(password),
  secure: true,
};
const request = (
  path: string,
  body?: unknown,
  cookies = "",
  origin = "https://workspace.example",
) =>
  new Request("https://workspace.example/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookies ? { Cookie: cookies } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const cookies = (response: Response) =>
  response.headers
    .getSetCookie()
    .filter((value) => !/Max-Age=0(?:;|$)/.test(value))
    .map((value) => value.split(";")[0])
    .join("; ");
async function login(handler: ReturnType<typeof createHostedHandler>) {
  const response = await handler(request("login", { password }));
  assert.equal(response.status, 200);
  return cookies(response);
}

test("hosted API fails closed without configuration and without owner authentication", async () => {
  const broken = createHostedHandler({ ...config, secret: "" });
  assert.equal(
    (await broken(request("crawl", { url: "https://example.com" }))).status,
    503,
  );
  const handler = createHostedHandler(config);
  for (const path of ["crawl", "ai/connect", "ai/research", "demo"])
    assert.equal((await handler(request(path, {}))).status, 401);
  assert.equal(
    (await handler(request("login", { password: "wrong" }))).status,
    401,
  );
  assert.equal((await handler(request("ai/status"))).status, 401);
});

test('expired cookies and cookies sealed for a different purpose cannot authenticate',async()=>{
  const handler=createHostedHandler(config);
  const expired=seal({id:'expired',expires:Date.now()-1},config,'owner');
  const wrongPurpose=seal({id:'wrong-purpose',expires:Date.now()+60_000},config,'ai');
  for(const token of [expired,wrongPurpose])assert.equal((await handler(request('ai/status',undefined,'__Host-seo-owner='+token))).status,401);
});

test("owner cookies are encrypted, secure and reject tampering and cross-origin writes", async () => {
  const handler = createHostedHandler(config),
    response = await handler(request("login", { password })),
    cookie = cookies(response);
  assert(!cookie.includes(password));
  assert.match(response.headers.get("set-cookie")!, /HttpOnly/);
  assert.match(response.headers.get("set-cookie")!, /SameSite=Strict/);
  assert.match(response.headers.get("set-cookie")!, /Secure/);
  assert.equal((await handler(request("demo", {}, cookie))).status, 200);
  assert.equal(
    (await handler(request("demo", {}, cookie, "https://attacker.example")))
      .status,
    403,
  );
  const changed = cookie.replace(
    /seo-owner=(.)/,
    (_match, char) => "seo-owner=" + (char === "A" ? "B" : "A"),
  );
  assert.equal((await handler(request("demo", {}, changed))).status, 401);
  const logout = await handler(request("logout", {}, cookie));
  assert.match(logout.headers.get("set-cookie")!, /Max-Age=0/);
});

test("private, reserved, unusual-port and credential-bearing crawl destinations are blocked", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::ffff:127.0.0.1",
    "fd00::1",
    "fe80::1",
    "2001:db8::1",
  ])
    assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  for (const url of [
    "http://2130706433/",
    "http://0x7f000001/",
    "http://[::1]/",
    "http://localhost/",
    "http://metadata.internal/",
    "https://example.com:22/",
    "http://user:password@example.com/",
  ])
    assert.throws(() => publicUrl(url));
});

test("DNS guard rejects mixed public/private answers and pins accepted answers to the connector", async () => {
  const resolve = (records: { address: string; family: number }[]) =>
    ((_host: any, _options: any, callback: any) =>
      callback(null, records)) as typeof lookup;
  const result = await new Promise<{ error: Error | null; addresses: unknown }>(
    (done) =>
      guardedLookup(
        resolve([
          { address: "8.8.8.8", family: 4 },
          { address: "127.0.0.1", family: 4 },
        ]),
      )("mixed.example", { all: true }, (error, addresses) =>
        done({ error, addresses }),
      ),
  );
  assert.match(result.error!.message, /blocked/);
  const good = await new Promise<unknown>((done) =>
    guardedLookup(resolve([{ address: "8.8.8.8", family: 4 }]))(
      "public.example",
      { all: true },
      (error, addresses) => {
        assert.equal(error, null);
        done(addresses);
      },
    ),
  );
  assert.deepEqual(good, [{ address: "8.8.8.8", family: 4 }]);
});

test("redirects to private destinations are rejected before a second request and credentials never forward", async () => {
  let calls = 0;
  const safeFetch = createPublicFetch((async (
    _url: unknown,
    init?: { headers?: unknown },
  ) => {
    calls++;
    assert.equal(
      new Headers(init?.headers as HeadersInit).get("authorization"),
      null,
    );
    return new Response(null, {
      status: 302,
      headers: { Location: "http://169.254.169.254/latest/meta-data/" },
    });
  }) as any);
  await assert.rejects(
    safeFetch("https://public.example/", {
      headers: { Authorization: "must-not-be-forwarded" },
    }),
    /Only public/,
  );
  assert.equal(calls, 1);
});

test("AI credentials survive a cold handler instance but cannot be used by another owner session", async () => {
  const key = "nvapi-fixture-only-not-a-real-key";
  let calls = 0;
  const factory = () =>
    new NvidiaClient((async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: {
                content:
                  body.messages[0].content === "Reply only with OK."
                    ? "OK"
                    : JSON.stringify({
                        summary:
                          "A real report shape from a simulated provider",
                        keywords: [],
                        competitors: [],
                        actions: [],
                        sections: [],
                        repairs: [],
                      }),
              },
            },
          ],
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch);
  const handler = createHostedHandler(config, factory),
    owner = await login(handler);
  const connected = await handler(
      request("ai/connect", { key, model: DEFAULT_MODEL }, owner),
    ),
    ai = cookies(connected);
  assert.equal(connected.status, 200);
  assert(!ai.includes(key));
  assert(!(await connected.text()).includes(key));
  const cold = createHostedHandler(config, factory),
    ownCookies = owner + "; " + ai;
  assert.equal(
    (await (await cold(request("ai/status", undefined, ownCookies))).json())
      .connected,
    true,
  );
  const secondOwner = await login(cold);
  assert.equal(
    (
      await (
        await cold(request("ai/status", undefined, secondOwner + "; " + ai))
      ).json()
    ).connected,
    false,
  );
  const sample = await (await cold(request("demo", {}, owner))).json();
  const report = await cold(
    request(
      "ai/research",
      {
        scanId: sample.id,
        task: "keywords",
        seeds: "performance",
        market: "",
        language: "English",
        audience: "",
        question: "",
        competitorUrls: [],
        scan: sample,
      },
      ownCookies,
    ),
  );
  assert.equal(report.status, 200);
  assert(!(await report.text()).includes(key));
  assert.equal(calls, 2);
});

test("hosted crawl streams page evidence to completion without relying on server memory or files", async () => {
  const websiteFetch = (async (input) => {
    const response = new Response(
      String(input).endsWith("robots.txt")
        ? "User-agent: *\nAllow: /"
        : "<title>Website performance guide</title><h1>Useful content</h1><p>A practical guide to performance and content for small business websites.</p>",
      { headers: { "Content-Type": "text/html" } },
    );
    Object.defineProperty(response, "url", { value: String(input) });
    return response;
  }) as typeof fetch;
  const handler = createHostedHandler(config, undefined, websiteFetch),
    owner = await login(handler);
  const response = await handler(
    request("crawl", { url: "https://example.com/", limit: 10 }, owner),
  );
  assert.equal(response.headers.get("content-type"), "application/x-ndjson");
  const events = (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(events[0].type, "start");
  assert.equal(events.at(-1).type, "complete");
  assert.equal(events.at(-1).scan.status, "completed");
  assert.equal(events.at(-1).scan.pages.length, 1);
  assert.equal(events.at(-1).scan.pages[0].status, 200);
  assert.equal(events.at(-1).scan.pages[0].title, "Website performance guide");
});

test('cancelling a crawl stream stops only its own request and leaves a later crawl usable',async()=>{
  let entered!:()=>void;const ready=new Promise<void>(resolve=>{entered=resolve;});let captured:AbortSignal|undefined;
  const websiteFetch=(async(input,init)=>{
    if(String(input).endsWith('/slow')){captured=init?.signal??undefined;entered();await new Promise((resolve,reject)=>captured?.addEventListener('abort',()=>reject(new Error('stopped')),{once:true}));}
    const response=new Response(String(input).endsWith('robots.txt')?'User-agent: *\nAllow: /':'<title>Website guide</title><h1>Useful page</h1><p>Website content for an isolated crawl cancellation test.</p>',{headers:{'Content-Type':'text/html'}});Object.defineProperty(response,'url',{value:String(input)});return response;
  }) as typeof fetch;
  const handler=createHostedHandler(config,undefined,websiteFetch),owner=await login(handler);
  const slow=await handler(request('crawl',{url:'https://example.com/slow',limit:1},owner)),reader=slow.body!.getReader();
  await ready;await reader.cancel();assert.equal(captured?.aborted,true);
  const fast=await handler(request('crawl',{url:'https://example.com/fast',limit:1},owner));
  const final=(await fast.text()).trim().split('\n').map(line=>JSON.parse(line)).at(-1);
  assert.equal(final.type,'complete');assert.equal(final.scan.status,'completed');
});
