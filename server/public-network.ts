import { lookup } from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import ipaddr from "ipaddr.js";
import { Agent, fetch as undiciFetch } from "undici";
import { normalizeUrl } from "./audit.js";

export function isPublicAddress(address: string) {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export function publicUrl(input: string) {
  const url = new URL(normalizeUrl(input));
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    url.href.length > 2500 ||
    (url.port && !["80", "443"].includes(url.port)) ||
    /(^|\.)(localhost|local|internal|test|invalid|onion)$/.test(hostname) ||
    (!hostname.includes(".") && !isIP(hostname)) ||
    (isIP(hostname) && !isPublicAddress(hostname))
  )
    throw new Error(
      "Only public HTTP/HTTPS websites on standard web ports can be scanned.",
    );
  return url.href;
}
// Validation happens at socket resolution, not just before fetch. The checked
// addresses are the exact addresses given to the connector (DNS rebinding guard).
export function guardedLookup(
  resolver: typeof lookup = lookup,
): LookupFunction {
  return (hostname, options, callback) => {
    resolver(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) {
        callback(error, [], 0);
        return;
      }
      if (
        !addresses.length ||
        addresses.some((value) => !isPublicAddress(value.address))
      ) {
        callback(
          new Error("Private or reserved network destinations are blocked."),
          [],
          0,
        );
        return;
      }
      if (options.all) callback(null, addresses);
      else {
        const selected =
          addresses.find(
            (value) =>
              !options.family || value.family === Number(options.family),
          ) || addresses[0];
        callback(null, selected.address, selected.family);
      }
    });
  };
}
const dispatcher = new Agent({ connect: { lookup: guardedLookup() } });
export function createPublicFetch(
  transport: typeof undiciFetch = undiciFetch,
): typeof fetch {
  return async (input, init) => {
    let url = publicUrl(String(input));
    for (let count = 0; count <= 5; count++) {
      let response: Response;
      try { response = (await transport(url, {
        method: "GET",
        signal: init?.signal,
        headers: {
          "User-Agent": "LocalSEOWorkbench/0.2 (+read-only website audit)",
          Accept: "text/html,application/xhtml+xml,text/plain",
        },
        redirect: "manual",
        dispatcher,
      })) as unknown as Response; }
      catch (error) {
        const code = (error as { cause?: { code?: string } }).cause?.code;
        if (["ENOTFOUND", "EAI_AGAIN"].includes(code || "")) throw new Error("Website DNS lookup failed. The domain could not be resolved; check its DNS and try again.");
        throw error;
      }
      if (
        [301, 302, 303, 307, 308].includes(response.status) &&
        response.headers.has("location")
      ) {
        const location = response.headers.get("location")!;
        await response.body?.cancel();
        url = publicUrl(new URL(location, url).href);
        continue;
      }
      return response;
    }
    throw new Error("Too many redirects.");
  };
}
export const publicFetch = createPublicFetch();
export async function boundedText(response: Response, maximum: number) {
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    if (reader)
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > maximum)
          throw new Error("Response exceeds the scan size limit.");
        chunks.push(value);
      }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    await reader?.cancel().catch(() => {});
  }
}
