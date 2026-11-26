import { z } from "zod";
const url = z
  .string()
  .max(2500)
  .refine((value) => {
    try {
      const u = new URL(value);
      return (
        ["http:", "https:"].includes(u.protocol) && !u.username && !u.password
      );
    } catch {
      return false;
    }
  });
const str = (size = 2000) => z.string().max(size);
export const pageSchema = z.object({
  technologies: z.array(z.object({ name: str(100), confidence: z.enum(["strong", "possible"]), evidence: str(500) })).max(30).optional(),
  outline: z.array(z.object({ kind: z.enum(["heading", "paragraph", "image"]), text: str(2000), level: z.number().int().min(1).max(6).optional(), src: url.optional(), region: str(30) })).max(200).optional(),
  url,
  finalUrl: url,
  status: z.number().int().min(0).max(599),
  title: str(3000),
  description: str(5000),
  h1: z.array(str(3000)).max(100),
  canonical: str(2500),
  robots: str(2000),
  wordCount: z.number().int().min(0),
  images: z.array(z.object({ src: url, alt: str(5000).nullable() })).max(1500),
  links: z
    .array(z.object({ url, text: str(3000), nofollow: z.boolean() }))
    .max(5000),
  paragraphs: z.array(str(3000)).max(2000),
  schemaCount: z.number().int().min(0),
  ms: z.number().min(0),
  redirects: z.number().int().min(0),
  error: str().optional(),
});
export const scanSchema = z.object({
  sourcePageCount: z.number().int().min(1).max(200).optional(),
  id: z.string().regex(/^[\w-]{1,100}$/),
  url,
  status: z.enum(["running", "completed", "cancelled", "failed"]),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().optional(),
  limit: z.number().int().min(1).max(200),
  pages: z.array(pageSchema).max(200),
  issues: z
    .array(
      z.object({
        id: str(200),
        type: str(150),
        label: str(500),
        severity: z.enum(["high", "medium", "low", "info"]),
        url,
        detail: str(6000),
        action: str(6000),
      }),
    )
    .max(5000),
  suggestions: z
    .array(
      z.object({
        source: url,
        target: url,
        anchor: str(1000),
        context: str(3000),
        overlap: z.array(str(100)).max(50),
        score: z.number(),
      }),
    )
    .max(100),
  discovered: z.number().int().min(0),
  skipped: z.number().int().min(0),
  skippedUrls: z.array(url).max(2500),
  notice: z.array(str(5000)).max(50),
  current: str(2500).optional(),
  error: str().optional(),
});
