import type { Scan, Page } from "../src/types.js";
import { normalizeUrl, parsePage, analyze } from "./audit.js";
import { boundedText } from "./public-network.js";
export function robotsAllows(text: string, url: string) {
  const groups: {
    agents: string[];
    rules: { allow: boolean; path: string }[];
  }[] = [];
  let group = {
    agents: [] as string[],
    rules: [] as { allow: boolean; path: string }[],
  };
  for (const line of text.split(/\r?\n/)) {
    const [raw, ...rest] = line.split("#")[0].split(":");
    const key = raw.trim().toLowerCase(),
      v = rest.join(":").trim();
    if (key === "user-agent") {
      if (group.rules.length) {
        groups.push(group);
        group = { agents: [], rules: [] };
      }
      group.agents.push(v.toLowerCase());
    } else if (["allow", "disallow"].includes(key) && v)
      group.rules.push({ allow: key === "allow", path: v });
  }
  groups.push(group);
  const own = groups.filter((g) =>
    g.agents.some((a) => "localseoworkbench".includes(a) && a !== "*"),
  );
  const rules = (
    own.length ? own : groups.filter((g) => g.agents.includes("*"))
  ).flatMap((g) => g.rules);
  const u = new URL(url);
  const path = u.pathname + u.search;
  let best: { allow: boolean; size: number } | undefined;
  for (const rule of rules) {
    const end = rule.path.endsWith("$");
    const p = rule.path
      .replace(/\$$/, "")
      .split("*")
      .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    if (new RegExp("^" + p + (end ? "$" : "")).test(path)) {
      const size = rule.path.replace(/[*$]/g, "").length;
      if (!best || size > best.size || (size === best.size && rule.allow))
        best = { allow: rule.allow, size };
    }
  }
  return best?.allow ?? true;
}
export async function fetchDocument(
  url: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const start = Date.now();
  const response = await fetcher(url, {
    headers: {
      "User-Agent": "LocalSEOWorkbench/0.1 (+local website audit)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
  });
  const type = response.headers.get("content-type") || "";
  if (!/html|text\/plain|xml/.test(type)) {
    await response.body?.cancel();
    if (response.status >= 400)
      return {
        html: "",
        status: response.status,
        url: response.url,
        ms: Date.now() - start,
        robots: response.headers.get("x-robots-tag") || "",
      };
    throw new Error(
      `Not an HTML/text response (${type || "unknown content type"}).`,
    );
  }
  const reader = response.body?.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  if (reader)
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 2_000_000)
          throw new Error("Response exceeds the 2 MB scan limit.");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
  return {
    html: Buffer.concat(chunks).toString("utf8"),
    status: response.status,
    url: response.url,
    ms: Date.now() - start,
    robots: response.headers.get("x-robots-tag") || "",
  };
}
export async function crawl(
  scan: Scan,
  signal: AbortSignal,
  changed: () => void,
  fetcher: typeof fetch = fetch,
) {
  try {
    let origin = new URL(scan.url).origin;
    let robots = "";
    const seen = new Set<string>(),
      queue = [scan.url];
    try {
      const r = await fetcher(new URL("/robots.txt", origin), {
        signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]),
        headers: { "User-Agent": "LocalSEOWorkbench/0.1" },
      });
      if (r.ok) robots = await boundedText(r, 500_000);
      else if (r.status >= 500) throw new Error("Robots server error");
    } catch {
      scan.notice.push(
        "robots.txt could not be read. Crawl stopped to avoid ignoring unknown restrictions.",
      );
      scan.status = "failed";
      scan.error = "Could not read robots.txt. Check the site or try again.";
      return;
    }
    while (queue.length && scan.pages.length < scan.limit && !signal.aborted) {
      const url = queue.shift()!;
      if (seen.has(url)) continue;
      seen.add(url);
      if (!robotsAllows(robots, url)) {
        scan.skipped++;
        scan.skippedUrls.push(url);
        changed();
        continue;
      }
      scan.current = url;
      changed();
      let page: Page;
      try {
        const doc = await fetchDocument(url, signal, fetcher);
        page = parsePage(doc.html, url);
        Object.assign(page, {
          status: doc.status,
          finalUrl: normalizeUrl(doc.url),
          ms: doc.ms,
          robots: (page.robots + " " + doc.robots).trim(),
          redirects: doc.url !== url ? 1 : 0,
        });
        if (
          scan.pages.length === 0 &&
          new URL(page.finalUrl).origin !== origin
        ) {
          origin = new URL(page.finalUrl).origin;
          scan.notice.push(
            "The start URL redirected; crawl scope follows its final origin.",
          );
          const r = await fetcher(new URL("/robots.txt", origin), {
            signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]),
          });
          if (r.ok) robots = await boundedText(r, 500_000);
          else if (r.status >= 500)
            throw new Error("Redirected robots.txt unavailable");
        }
      } catch (error) {
        if (signal.aborted) break;
        page = {
          url,
          finalUrl: url,
          status: 0,
          title: "",
          description: "",
          h1: [],
          canonical: "",
          robots: "",
          wordCount: 0,
          images: [],
          links: [],
          paragraphs: [],
          schemaCount: 0,
          ms: 0,
          redirects: 0,
          error: (error as Error).message,
        };
      }
      scan.pages.push(page);
      if (
        !page.error &&
        page.status < 400 &&
        new URL(page.finalUrl).origin === origin
      )
        for (const link of page.links) {
          const u = new URL(link.url);
          if (
            u.origin === origin &&
            !link.nofollow &&
            !/\.(pdf|zip|jpe?g|png|gif|svg|webp|mp4|mp3|css|js|xml|ico|woff2?)$/i.test(
              u.pathname,
            ) &&
            !seen.has(link.url) &&
            !queue.includes(link.url) &&
            queue.length < 2000
          )
            queue.push(link.url);
        }
      scan.discovered = seen.size + queue.length;
      changed();
      await new Promise((r) => setTimeout(r, 120));
    }
    Object.assign(scan, analyze(scan.pages));
    scan.status = signal.aborted ? "cancelled" : "completed";
    if (queue.length)
      scan.notice.push(
        `${queue.length} discovered URLs remain outside this scan’s page limit.`,
      );
    scan.notice.push(
      "HTML responses only. JavaScript-rendered content, external link health and search performance were not checked.",
    );
  } catch (error) {
    scan.status = signal.aborted ? "cancelled" : "failed";
    scan.error = (error as Error).message;
  } finally {
    scan.finishedAt = new Date().toISOString();
    scan.current = undefined;
    changed();
  }
}
