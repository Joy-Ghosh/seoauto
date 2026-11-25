import { test } from "node:test";
import assert from "node:assert/strict";
import { connections } from "../src/topology";
import type { Page } from "../src/types";

test('known destination URLs take precedence over aliases and redirects do not add a click',()=>{
  const page=(url:string,links:string[],finalUrl=url)=>({url,finalUrl,links:links.map(url=>({url,text:'',nofollow:false}))}) as Page;
  const direct=connections([page('https://test/',['https://test/new']),page('https://test/new',[]),page('https://test/old',[],'https://test/new')]);
  assert.equal(direct[1].incoming,1);assert.equal(direct[2].incoming,0);
  const redirected=connections([page('https://test/',['https://test/old']),page('https://test/new',[]),page('https://test/old',[],'https://test/new')]);
  assert.equal(redirected[1].depth,1);assert.equal(redirected[2].depth,1);
});

test("connections deduplicate links, resolve redirects and measure shortest scanned depth", () => {
  const page = (url: string, links: string[], finalUrl = url) =>
    ({
      url,
      finalUrl,
      links: links.map((url) => ({ url, text: "", nofollow: false })),
    }) as Page;
  const rows = connections([
    page("https://test/", [
      "https://test/old",
      "https://test/old",
      "https://outside/",
    ]),
    page("https://test/old", ["https://test/last"], "https://test/new"),
    page("https://test/last", []),
    page("https://test/unreached", []),
  ]);
  assert.deepEqual(
    rows.map(({ incoming, outgoing, depth }) => [incoming, outgoing, depth]),
    [
      [0, 1, 0],
      [1, 1, 1],
      [1, 0, 2],
      [0, 0, null],
    ],
  );
});
