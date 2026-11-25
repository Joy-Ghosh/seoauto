import type { Repair } from "./types";

export const AI_TOOLS = [
  {
    id: "keywords",
    name: "Keyword research",
    description:
      "Find relevant queries, intent, topic clusters and pages to target.",
  },
  {
    id: "competitors",
    name: "Competitors & gaps",
    description: "Discover possible competitors or compare crawled websites.",
  },
  {
    id: "content",
    name: "Content plan",
    description: "Plan useful articles, topic coverage and internal links.",
  },
  {
    id: "optimize",
    name: "Improve a page",
    description: "Draft titles, descriptions and clearer page content.",
  },
  {
    id: "priorities",
    name: "SEO action plan",
    description: "Turn scan findings into a practical, ordered repair plan.",
  },
  {
    id: "brief",
    name: "Content brief",
    description:
      "Build an outline, questions to answer and editorial guidance.",
  },
  {
    id: "links",
    name: "Internal link ideas",
    description:
      "Suggest relevant connections and natural anchor text from your content.",
  },
  {
    id: "schema",
    name: "Structured data",
    description:
      "Review schema opportunities and draft markup for manual validation.",
  },
  {
    id: "ask",
    name: "Ask about this site",
    description: "Ask a focused SEO question using the scan as context.",
  },
] as const;
export type AiTask = (typeof AI_TOOLS)[number]["id"];
export const DEFAULT_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";
export interface AiStatus {
  connected: boolean;
  model: string;
  source: "session" | "none";
}
export interface AiInput {
  scanId: string;
  task: AiTask;
  pageUrl?: string;
  seeds: string;
  market: string;
  language: string;
  audience: string;
  question: string;
  competitorUrls: string[];
}
export interface AiResult {
  id: string;
  scanId: string;
  task: AiTask;
  model: string;
  createdAt: string;
  summary: string;
  keywords: {
    keyword: string;
    intent: string;
    cluster: string;
    targetUrl: string;
    reason: string;
  }[];
  competitors: { name: string; url: string; reason: string }[];
  actions: {
    title: string;
    priority: string;
    evidence: string;
    action: string;
    url: string;
  }[];
  sections: { heading: string; text: string }[];
  repairs: (Repair & { reason: string })[];
  sources: {
    url: string;
    title: string;
    status: number;
    scannedAt: string;
    kind: "site" | "competitor";
  }[];
  warnings: string[];
  context: {
    selectedPageCount: number;
    totalPageCount: number;
    competitorPageCount: number;
  };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}
