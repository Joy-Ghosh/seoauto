/// <reference lib="webworker" />
import { env, pipeline } from "@huggingface/transformers";
import { MODEL_REVISION, SEMANTIC_MODEL, rankSemanticLinks, type SemanticPage } from "./semantic-links";

env.allowLocalModels = false;
env.useWasmCache = false;
env.backends.onnx.wasm!.wasmPaths = { mjs: self.location.origin + "/ml-runtime/ort-wasm-simd-threaded.mjs", wasm: self.location.origin + "/ml-runtime/ort-wasm-simd-threaded.wasm" };
env.backends.onnx.wasm!.numThreads = 1;
env.backends.onnx.wasm!.proxy = false;
env.fetch = (input: any, init?: any) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.origin !== self.location.origin && url.hostname !== "huggingface.co" && !url.hostname.endsWith(".hf.co") && !url.hostname.endsWith(".huggingface.co")) throw new Error("Unexpected model download origin.");
  if (init?.method && !["GET", "HEAD"].includes(init.method)) throw new Error("Model downloads are read-only.");
  return fetch(input, { ...init, credentials: "omit", referrerPolicy: "no-referrer" });
};
let extractor: any;
let busy = false;
self.onmessage = async (event: MessageEvent<{ pages: SemanticPage[]; focus?: string }>) => {
  if (busy) return;
  busy = true;
  try {
    const pages = event.data.pages;
    if (!Array.isArray(pages) || pages.length > 24) throw new Error("Use at most 24 pages for local matching.");
    extractor ||= await pipeline("feature-extraction", SEMANTIC_MODEL, { revision: MODEL_REVISION, dtype: "q8", device: "wasm", progress_callback: (progress: any) => {
      self.postMessage({ type: "progress", text: progress.status === "progress" && Number.isFinite(progress.progress) ? `Downloading model file · ${Math.round(progress.progress)}% of this file` : "Preparing local matching model…" });
    } });
    const texts = [...pages.map(p => [p.title, ...p.h1, p.description, p.paragraphs[0] || ""].join(" ").slice(0, 850)), ...pages.flatMap(p => p.paragraphs)];
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += 4) {
      self.postMessage({ type: "progress", text: `Comparing page meaning · ${i} of ${texts.length} text excerpts` });
      const output = await extractor(texts.slice(i, i + 4), { pooling: "mean", normalize: true });
      vectors.push(...output.tolist());
    }
    let index = pages.length;
    const paragraphs = pages.map(p => p.paragraphs.map(() => vectors[index++]));
    self.postMessage({ type: "result", suggestions: rankSemanticLinks(pages, { targets: vectors.slice(0, pages.length), paragraphs }, event.data.focus), pageCount: pages.length });
  } catch {
    self.postMessage({ type: "error", text: "Local matching could not finish. Check model downloads or available memory, then retry. Text-match candidates are still available." });
  } finally { busy = false; }
};
