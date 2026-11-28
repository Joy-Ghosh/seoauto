export type ViewContext = { query: string; severity: string; problemType: string };
export const emptyContext: ViewContext = { query: "", severity: "all", problemType: "all" };
export function readContexts(raw: string | null): Record<string, ViewContext> {
  try {
    const value = JSON.parse(raw || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).slice(-30).flatMap(([key, row]: [string, any]) =>
      row && typeof row.query === "string" && typeof row.problemType === "string" && ["all", "high", "medium", "low", "info"].includes(row.severity)
        ? [[key.slice(0, 300), { query: row.query.slice(0, 1000), severity: row.severity, problemType: row.problemType.slice(0, 100) }]] : []));
  } catch { return {}; }
}
export function readWorkspaceRoute(hash: string) {
  const [view, query = ""] = hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(query);
  return { view, finding: params.get("finding") || "", scan: params.get("scan") || "" };
}
