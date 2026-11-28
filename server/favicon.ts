import { Parser } from "htmlparser2";
import { robotsAllows } from "./crawler.js";
import { publicUrl } from "./public-network.js";

export async function discoverFavicon(html: string, pageUrl: string, signal: AbortSignal, fetcher: typeof fetch, robots: Parameters<typeof robotsAllows>[0]) {
  const origin = new URL(pageUrl).origin;
  const icons: string[] = [];
  new Parser({ onopentag(name, attrs) {
    if (name !== "link" || !/(?:^|\s)(?:icon|apple-touch-icon)(?:\s|$)/i.test(attrs.rel || "")) return;
    try { const icon = new URL(attrs.href, pageUrl); if (icon.origin === origin && !icons.includes(icon.href)) icons.push(icon.href); } catch {}
  } }).end(html);
  icons.push(origin + "/favicon.ico");
  for (const url of [...new Set(icons)].slice(0, 4)) {
    if (!robotsAllows(robots, url)) continue;
    try {
      const response = await fetcher(publicUrl(url), { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]), credentials: "omit" });
      if (!response.ok) { await response.body?.cancel(); continue; }
      const reader = response.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      try { while (reader) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 128000) throw new Error("Icon too large"); chunks.push(part.value); } } finally { await reader?.cancel().catch(() => {}); }
      const bytes = Buffer.concat(chunks);
      const mime = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png" : bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0 ? "image/x-icon" : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "image/jpeg" : bytes.toString("ascii",0,3) === "GIF" ? "image/gif" : bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP" ? "image/webp" : "";
      if (mime) return "data:" + mime + ";base64," + bytes.toString("base64");
    } catch { if (signal.aborted) break; }
  }
  return null;
}
