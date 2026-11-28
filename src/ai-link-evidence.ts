import type { Page } from "./types";

// Match only URLs from retained scan evidence. Model text never becomes a navigation target.
export function mentionedEvidencePages(text: string, pages: Page[]) {
  return pages.filter(page => [page.url, page.finalUrl].some(url => {
    const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`${escape(url)}(?=$|[\\s)\"'\x60.,;:!?])`).test(text)) return true;
    try {
      const path = new URL(url).pathname;
      if (path === "/") return false;
      const escaped = escape(path);
      return new RegExp(`(^|[\\s(\"'\x60])${escaped}(?=$|[\\s)\"'\x60.,;:!?])`).test(text);
    } catch { return false; }
  }));
}
