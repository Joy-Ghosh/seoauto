import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
import handler from "../api/index.js";
const port = Number(process.env.PORT) || 4318;
const vite = await (
  await import("vite")
).createServer({
  root: process.cwd(),
  server: { middlewareMode: true, hmr: { port: 24679 } },
  appType: "spa",
});
const server = http.createServer(async (req, res) => {
  if (
    ![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host || "")
  ) {
    res.writeHead(403).end();
    return;
  }
  if (!req.url?.startsWith("/api/")) {
    vite.middlewares(req, res);
    return;
  }
  const stop = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) stop.abort();
  });
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const part of req) {
      size += part.length;
      if (size > 2_000_000) {
        res.writeHead(413).end();
        return;
      }
      chunks.push(part);
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers))
      if (value)
        headers.set(key, Array.isArray(value) ? value.join(",") : value);
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers,
      signal: stop.signal,
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
    });
    const result = await handler.fetch(request);
    const responseHeaders: Record<string, string | string[]> = {};
    for (const [key, value] of result.headers)
      if (key !== "set-cookie") responseHeaders[key] = value;
    const cookies = result.headers.getSetCookie();
    if (cookies.length) responseHeaders["set-cookie"] = cookies;
    res.writeHead(result.status, responseHeaders);
    const reader = result.body?.getReader();
    if (reader)
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (res.destroyed) {
          await reader.cancel();
          break;
        }
        if (!res.write(value))
          await new Promise<void>((resolve) => res.once("drain", resolve));
      }
    res.end();
  } catch {
    if (!res.headersSent)
      res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Request could not be completed." }));
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Hosted workspace adapter: http://127.0.0.1:${port}`),
);
process.on("SIGINT", () => {
  server.close();
  void vite.close();
});
