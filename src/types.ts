export type Severity = "high" | "medium" | "low" | "info";
export interface Page {
  url: string;
  finalUrl: string;
  status: number;
  title: string;
  description: string;
  h1: string[];
  canonical: string;
  robots: string;
  wordCount: number;
  images: { src: string; alt: string | null }[];
  links: { url: string; text: string; nofollow: boolean }[];
  paragraphs: string[];
  schemaCount: number;
  ms: number;
  error?: string;
  redirects: number;
}
export interface Issue {
  id: string;
  type: string;
  label: string;
  severity: Severity;
  url: string;
  detail: string;
  action: string;
}
export interface Suggestion {
  source: string;
  target: string;
  anchor: string;
  context: string;
  overlap: string[];
  score: number;
}
export interface Repair {
  id: string;
  url: string;
  field: "title" | "meta_description" | "alt_text";
  original: string;
  value: string;
  imageSrc?: string;
}
export interface Scan {
  sourcePageCount?: number;
  id: string;
  url: string;
  status: "running" | "completed" | "cancelled" | "failed";
  startedAt: string;
  finishedAt?: string;
  limit: number;
  pages: Page[];
  issues: Issue[];
  suggestions: Suggestion[];
  discovered: number;
  skipped: number;
  skippedUrls: string[];
  notice: string[];
  current?: string;
  error?: string;
}
