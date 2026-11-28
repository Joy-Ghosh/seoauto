import type { Page, Scan, Suggestion } from "./types";
import { editorialLinkPage } from "./link-eligibility";
export const SEMANTIC_MODEL = "Xenova/all-MiniLM-L6-v2";
export const MODEL_REVISION = "751bff37182d3f1213fa05d7196b954e230abad9";
export function semanticPages(scan: Scan, focus?: Page) {
  const eligible = scan.pages.filter(editorialLinkPage);
  const unique = eligible.filter((p, i) => eligible.findIndex(other => other.finalUrl === p.finalUrl) === i);
  const ordered = [...unique].sort((a, b) => Number(b.url === focus?.url) - Number(a.url === focus?.url) || b.paragraphs.length - a.paragraphs.length);
  return ordered.slice(0, 24).map(p => ({ url: p.url, finalUrl: p.finalUrl, title: p.title.slice(0, 300), h1: p.h1.slice(0, 2), description: p.description.slice(0, 400), links: p.links.map(l => ({ url: l.url, text: l.text })), paragraphs: p.paragraphs.filter(text => text.length >= 60).slice(0, 2).map(text => text.slice(0, 480)) }));
}
export type SemanticPage = ReturnType<typeof semanticPages>[number];
export function cosine(a: number[], b: number[]) { if (a.length !== b.length || !a.length) return 0; let dot = 0, aa = 0, bb = 0; for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; } return aa && bb ? dot / Math.sqrt(aa * bb) : 0; }
const words = (text: string) => text.toLowerCase().match(/[a-z]{3,}/g) || [];
const stop = new Set("the and for with this that your our from are has have can will into about more page website".split(" "));
function exactAnchor(context: string, topic: string) {
  const target = new Set(words(topic).filter(w => !stop.has(w))), parts = [...context.matchAll(/\S+/g)];
  let best = "", bestScore = 0;
  for (let i = 0; i < parts.length; i++) for (let n = 2; n <= 5 && i + n <= parts.length; n++) {
    const a = parts[i].index!, last = parts[i + n - 1], text = context.slice(a, last.index! + last[0].length).replace(/[.,;:!?]+$/, "");
    const tokens = words(text).filter(w => !stop.has(w));
    const hits = tokens.filter(w => target.has(w)).length;
    const score = hits * 3 - n * .15;
    if (hits >= 2 && tokens.length >= 2 && score > bestScore) { bestScore = score; best = text; }
  }
  return best;
}
export function rankSemanticLinks(pages: SemanticPage[], vectors: { targets: number[][]; paragraphs: number[][][] }, focus?: string): Suggestion[] {
  const candidates: Suggestion[] = [];
  pages.forEach((source, i) => pages.forEach((target, j) => {
    if (i === j || source.finalUrl === target.finalUrl || source.links.some(l => l.url === target.url || l.url === target.finalUrl) || focus && focus !== source.url && focus !== target.url) return;
    let best = -1, similarity = .35;
    source.paragraphs.forEach((text, n) => { const score = cosine(vectors.paragraphs[i]?.[n] || [], vectors.targets[j] || []); if (score > similarity) { best = n; similarity = score; } });
    if (best < 0) return;
    const context = source.paragraphs[best];
    let anchor = exactAnchor(context, target.title + " " + (target.h1[0] || ""));
    if (anchor && source.links.some(l => l.text.toLowerCase().includes(anchor.toLowerCase()))) anchor = "";
    candidates.push({ source: source.url, target: target.url, anchor, context, overlap: [], score: Math.round(similarity * 100) });
  }));
  return candidates.sort((a, b) => b.score - a.score).slice(0, 8);
}
