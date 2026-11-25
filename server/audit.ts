import { Parser } from "htmlparser2";
import { createHash } from "node:crypto";
import type { Page, Issue, Suggestion } from "../src/types.ts";
export function normalizeUrl(input: string, base?: string) {
  const u = new URL(input, base);
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
    throw new Error("Use an HTTP or HTTPS URL without credentials.");
  u.hash = "";
  for (const key of [...u.searchParams.keys()])
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) u.searchParams.delete(key);
  return u.href;
}
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
export function parsePage(html: string, url: string): Page {
  const page: Page = {
    url,
    finalUrl: url,
    status: 200,
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
  };
  const stack: string[] = [];
  let base = url,
    text = "",
    title = "",
    heading = "",
    paragraph = "",
    link: Page["links"][number] | undefined;
  const ignored = () =>
    stack.some((t) => ["script", "style", "noscript", "template"].includes(t));
  const inContent = () =>
    !stack.some((t) => ["nav", "header", "footer"].includes(t));
  const parser = new Parser(
    {
      onopentag(name, a) {
        stack.push(name);
        if (name === "base" && a.href)
          try {
            base = normalizeUrl(a.href, url);
          } catch {}
        if (name === "title") title = "";
        if (name === "h1") heading = "";
        if (["p", "li"].includes(name)) paragraph = "";
        if (name === "meta" && (a.name || "").toLowerCase() === "description")
          page.description = a.content || "";
        if (
          name === "meta" &&
          ["robots", "googlebot"].includes((a.name || "").toLowerCase())
        )
          page.robots += " " + (a.content || "");
        if (name === "link" && /\bcanonical\b/i.test(a.rel || "") && a.href)
          try {
            page.canonical = normalizeUrl(a.href, base);
          } catch {}
        if (name === "img")
          try {
            page.images.push({
              src: normalizeUrl(a.src || a["data-src"], base),
              alt: a.alt ?? null,
            });
          } catch {}
        if (name === "script" && a.type === "application/ld+json")
          page.schemaCount++;
        if (name === "a" && a.href)
          try {
            link = {
              url: normalizeUrl(a.href, base),
              text: "",
              nofollow: /\bnofollow\b/i.test(a.rel || ""),
            };
          } catch {
            link = undefined;
          }
      },
      ontext(t) {
        if (ignored()) return;
        if (stack.includes("title")) title += t;
        if (stack.includes("h1")) heading += t;
        if (stack.includes("p") || stack.includes("li")) paragraph += t;
        if (link) link.text += t;
        if (inContent() && !stack.includes("head")) text += " " + t;
      },
      onclosetag(name) {
        if (name === "title") page.title = clean(title);
        if (name === "h1") page.h1.push(clean(heading));
        if (["p", "li"].includes(name) && clean(paragraph).length > 35)
          page.paragraphs.push(clean(paragraph).slice(0, 1000));
        if (name === "a" && link) {
          link.text = clean(link.text);
          page.links.push(link);
          link = undefined;
        }
        const i = stack.lastIndexOf(name);
        if (i >= 0) stack.splice(i);
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();
  page.wordCount = clean(text).split(/\s+/).filter(Boolean).length;
  page.robots = clean(page.robots);
  return page;
}
const stop = new Set(
  "the a an of to in and for with on at by is are your our how what why this that from into as be it or can you we more best guide".split(
    " ",
  ),
);
const tokens = (s: string) =>
  new Set(
    (s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter(
      (x) => !stop.has(x),
    ),
  );
export function analyze(pages: Page[]): {
  issues: Issue[];
  suggestions: Suggestion[];
} {
  const issues: Issue[] = [];
  const add = (
    p: Page,
    type: string,
    label: string,
    severity: Issue["severity"],
    detail: string,
    action: string,
  ) =>
    issues.push({
      id: createHash("sha1")
        .update(p.url + type)
        .digest("hex")
        .slice(0, 12),
      url: p.url,
      type,
      label,
      severity,
      detail:
        detail.length > 6000
          ? detail.slice(0, 5900) +
            "\nAdditional evidence omitted from this summary."
          : detail,
      action: action.slice(0, 3000),
    });
  const responses = pages.filter(
    (p) => p.status >= 200 && p.status < 300 && !p.error,
  );
  const byFinal = new Map<string, Page>();
  for (const page of responses)
    if (!byFinal.has(page.finalUrl) || page.url === page.finalUrl)
      byFinal.set(page.finalUrl, page);
  const usable = [...byFinal.values()];
  const byUrl = new Map(
    pages.flatMap(
      (p) =>
        [
          [p.url, p],
          [p.finalUrl, p],
        ] as [string, Page][],
    ),
  );
  for (const p of pages) {
    if (p.error) {
      add(
        p,
        "fetch_error",
        "Page could not be read",
        "medium",
        p.error,
        "Check the URL and server, then scan again.",
      );
      continue;
    }
    if (p.status >= 400) {
      add(
        p,
        "http_error",
        `HTTP ${p.status} response`,
        "high",
        "This crawled URL returned an error response.",
        "Restore the page, redirect it, or remove links pointing here.",
      );
      continue;
    }
    if (p.status < 200 || p.status >= 300) continue;
    if (byFinal.get(p.finalUrl) !== p) {
      add(
        p,
        "redirect_alias",
        "URL resolves to an already reviewed page",
        "info",
        `Final URL: ${p.finalUrl}. Metadata is checked once for this final response.`,
        "Review the redirect intent; use the destination URL for content changes.",
      );
      continue;
    }
    if (!p.title)
      add(
        p,
        "missing_title",
        "Missing page title",
        "high",
        "No title was found in the response HTML.",
        "Write a descriptive, unique SEO title.",
      );
    else if (p.title.length < 25 || p.title.length > 65)
      add(
        p,
        "title_length",
        "Review title length",
        "low",
        `${p.title.length} characters. Length is a review heuristic, not a ranking rule.`,
        "Check whether the title is specific and useful in search.",
      );
    if (!p.description)
      add(
        p,
        "missing_description",
        "Missing meta description",
        "low",
        "No description meta tag was found. Search engines may choose their own snippet.",
        "Draft an accurate description of this page.",
      );
    if (!p.h1.length)
      add(
        p,
        "missing_h1",
        "No H1 found",
        "medium",
        "No H1 element was found in the response HTML.",
        "Give the page a clear main heading.",
      );
    else if (p.h1.length > 1)
      add(
        p,
        "multiple_h1",
        "Review multiple H1s",
        "low",
        `${p.h1.length} H1 elements were found; review the page structure.`,
        "Choose a main heading and check heading levels in your editor.",
      );
    const missing = p.images.filter((i) => i.alt === null).length;
    if (missing)
      add(
        p,
        "missing_alt",
        "Images missing alt attributes",
        "medium",
        `${missing} of ${p.images.length} images have no alt attribute. Empty alt attributes are treated as decorative.`,
        "Describe meaningful images; use empty alt for decorative images.",
      );
    if (/\b(noindex|none)\b/i.test(p.robots))
      add(
        p,
        "noindex",
        "Excluded from indexing",
        "info",
        `Robots directive: ${p.robots}. This may be intentional.`,
        "Confirm whether this page should appear in search.",
      );
    if (p.canonical && p.canonical !== p.finalUrl)
      add(
        p,
        "canonical_review",
        "Canonical points elsewhere",
        "info",
        `Canonical: ${p.canonical}. Consolidation may be intentional.`,
        "Confirm that this is the preferred equivalent URL.",
      );
    if (p.wordCount < 100)
      add(
        p,
        "short_content",
        "Review short content",
        "info",
        `${p.wordCount} words outside header, navigation and footer. A short page can still be appropriate.`,
        "Review whether this page answers its visitors’ needs.",
      );
    const broken = [
      ...new Set(
        p.links
          .filter((l) => {
            const t = byUrl.get(l.url);
            return t && t.status >= 400;
          })
          .map((l) => l.url),
      ),
    ];
    if (broken.length)
      add(
        p,
        "broken_internal",
        "Links to crawled error pages",
        "high",
        broken.join("\n"),
        "Update or remove these internal links.",
      );
  }
  for (const key of ["title", "description"] as const) {
    const groups = new Map<string, Page[]>();
    for (const p of usable) {
      const v = clean(p[key]).toLowerCase();
      if (v) groups.set(v, [...(groups.get(v) || []), p]);
    }
    for (const group of groups.values())
      if (group.length > 1)
        for (const p of group)
          add(
            p,
            `duplicate_${key}`,
            `Repeated ${key === "title" ? "title" : "description"}`,
            "medium",
            `Same text on ${group.length} scanned pages.`,
            "Check canonical intent; write unique text where the pages are distinct.",
          );
  }
  const suggestions: Suggestion[] = [];
  const paragraphs = new Map(
    usable.map((page) => [
      page,
      page.paragraphs
        .slice(0, 20)
        .map((context) => ({ context, words: tokens(context) })),
    ]),
  );
  suggestionSearch: for (const target of usable) {
    if (/\b(noindex|none)\b/i.test(target.robots)) continue;
    const topic = tokens(target.title + " " + target.h1.join(" "));
    for (const source of usable) {
      if (
        source === target ||
        source.links.some(
          (l) => l.url === target.url || l.url === target.finalUrl,
        )
      )
        continue;
      for (const paragraph of paragraphs.get(source) || []) {
        const { context } = paragraph;
        const overlap = [...paragraph.words].filter((t) => topic.has(t));
        if (overlap.length < 2) continue;
        const words = context.split(/\s+/);
        let anchor = "";
        for (let n = 0; n < words.length; n++) {
          for (let len = 2; len <= 5 && n + len <= words.length; len++) {
            const candidate = words.slice(n, n + len).join(" ");
            const hits = [...tokens(candidate)].filter((t) => topic.has(t));
            if (hits.length >= 2) {
              anchor = candidate;
              break;
            }
          }
          if (anchor) break;
        }
        if (
          !anchor ||
          source.links.some((l) =>
            l.text.toLowerCase().includes(anchor.toLowerCase()),
          )
        )
          continue;
        suggestions.push({
          source: source.url,
          target: target.url,
          anchor,
          context,
          overlap,
          score: Math.min(
            100,
            Math.round((overlap.length / Math.max(2, topic.size)) * 100),
          ),
        });
        if (suggestions.length >= 500) break suggestionSearch;
        break;
      }
    }
  }
  return {
    issues: issues.sort(
      (a, b) =>
        ["high", "medium", "low", "info"].indexOf(a.severity) -
        ["high", "medium", "low", "info"].indexOf(b.severity),
    ),
    suggestions: suggestions.sort((a, b) => b.score - a.score).slice(0, 100),
  };
}
