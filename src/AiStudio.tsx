import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CircleStop,
  KeyRound,
  LoaderCircle,
  Plus,
  Sparkles,
  Unplug,
} from "lucide-react";
import { AI_TOOLS, DEFAULT_MODEL } from "./ai-types";
import type { AiInput, AiResult, AiStatus, AiTask } from "./ai-types";
import type { Repair, Scan } from "./types";
import { api as request, hosted } from "./client";

function exportReport(report: AiResult) {
  const lines = [
    "# SEO research: " + AI_TOOLS.find((t) => t.id === report.task)?.name,
    `Generated ${report.createdAt} with ${report.model}`,
    "",
    report.summary,
    "",
    "## Research limits",
    ...report.warnings.map((w) => "- " + w),
    "",
    "## Keyword ideas",
    ...report.keywords.map(
      (k) =>
        `- ${k.keyword} | ${k.intent} | ${k.cluster}\n  Page: ${k.targetUrl}\n  ${k.reason}`,
    ),
    "",
    "## Possible competitors — unverified",
    ...report.competitors.map((c) => `- ${c.name}: ${c.url}\n  ${c.reason}`),
    "",
    "## Recommended actions",
    ...report.actions.map(
      (a) =>
        `### ${a.title} (${a.priority})\n${a.evidence}\n\n${a.action}\n${a.url}`,
    ),
    ...report.sections.map((s) => `\n## ${s.heading}\n${s.text}`),
    "",
    "## Drafts for review",
    ...report.repairs.map(
      (r) =>
        `### ${r.field} — ${r.url}\nCurrent: ${r.original}\nDraft: ${r.value}\n${r.reason}`,
    ),
    "",
    "## Fetched evidence",
    ...report.sources.map(
      (s) => `- ${s.url} (${s.kind}, HTTP ${s.status}, scanned ${s.scannedAt})`,
    ),
  ];
  const url = URL.createObjectURL(
    new Blob([lines.join("\n\n")], { type: "text/markdown;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "seo-ai-" + report.task + ".md";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const pathLabel = (url: string) => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

export default function AiStudio({
  scan,
  addRepair,
  repairs,
  inspect,
  initialTask,
  initialPageUrl,
}: {
  scan: Scan | null;
  addRepair: (repair: Repair) => void;
  repairs: Repair[];
  inspect: (url: string) => void;
  initialTask?: AiTask;
  initialPageUrl?: string;
}) {
  const [status, setStatus] = useState<AiStatus>({
    connected: false,
    model: DEFAULT_MODEL,
    source: "none",
  });
  const [key, setKey] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [task, setTask] = useState<AiTask>(initialTask || "keywords");
  const [seeds, setSeeds] = useState("");
  const [market, setMarket] = useState("");
  const [language, setLanguage] = useState("English");
  const [audience, setAudience] = useState("");
  const [question, setQuestion] = useState("");
  const [pageUrl, setPageUrl] = useState(initialPageUrl || "");
  const [competitors, setCompetitors] = useState("");
  const [reports, setReports] = useState<AiResult[]>([]);
  const [report, setReport] = useState<AiResult | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [consent, setConsent] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const pages =
    scan?.pages.filter((p) => p.status >= 200 && p.status < 300 && !p.error) ||
    [];

  useEffect(() => {
    const abort = new AbortController();
    request<AiStatus>("/api/ai/status", undefined, abort.signal)
      .then((s) => {
        setStatus(s);
        setModel(s.model);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    if (scan)
      request<AiResult[]>(
        "/api/ai/reports?scanId=" + encodeURIComponent(scan.id),
        undefined,
        abort.signal,
      )
        .then((saved) => {
          setReports(saved);
          const latest = initialTask
            ? saved.find((r) => r.task === initialTask)
            : saved[0];
          setReport(latest || null);
          if (latest && !initialTask) setTask(latest.task);
        })
        .catch((e) => {
          if (!abort.signal.aborted) setError(e.message);
        });
    return () => {
      abort.abort();
      controller.current?.abort();
    };
  }, [scan?.id]);

  async function connect() {
    setError("");
    setNotice("");
    setBusy("Connecting to NVIDIA…");
    controller.current = new AbortController();
    try {
      const next = await request<AiStatus>(
        "/api/ai/connect",
        { key, model },
        controller.current.signal,
      );
      setStatus(next);
      setNotice(
        hosted
          ? "Connected. Your key is protected by an encrypted, HttpOnly session cookie."
          : "Connected. Your key is held in this local server session only.",
      );
    } catch (e) {
      setError(
        (e as Error).name === "AbortError"
          ? "Connection cancelled."
          : (e as Error).message,
      );
    } finally {
      setKey("");
      setBusy("");
      controller.current = null;
    }
  }
  async function disconnect() {
    try {
      setStatus(await request<AiStatus>("/api/ai/disconnect", {}));
      setNotice("Disconnected. The key has been cleared from server memory.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function run() {
    if (!scan) return;
    setError("");
    setNotice("");
    const urls =
      task === "competitors" || task === "content"
        ? competitors
            .split(/\r?\n/)
            .map((v) => v.trim())
            .filter(Boolean)
        : [];
    if (urls.length > 2) {
      setError("Enter up to two competitor URLs, one per line.");
      return;
    }
    if (task === "ask" && !question.trim()) {
      setError("Enter a question about this website.");
      return;
    }
    setBusy(
      urls.length
        ? "Reading competitor pages, then generating your research…"
        : "Generating research from your scan…",
    );
    controller.current = new AbortController();
    const input: AiInput = {
      scanId: scan.id,
      task,
      seeds,
      market,
      language,
      audience,
      question,
      pageUrl: pageUrl || (task === "optimize" ? pages[0]?.url : ""),
      competitorUrls: urls,
    };
    try {
      const result = await request<AiResult>(
        "/api/ai/research",
        input,
        controller.current.signal,
      );
      setReport(result);
      setReports((previous) => [result, ...previous].slice(0, 20));
      setNotice(
        "Research saved locally. Review suggestions before using them.",
      );
    } catch (e) {
      setError(
        (e as Error).name === "AbortError"
          ? "AI request cancelled. No drafts were changed."
          : (e as Error).message,
      );
    } finally {
      setBusy("");
      controller.current = null;
    }
  }
  async function cancel() {
    controller.current?.abort();
    await request("/api/ai/cancel", {}).catch(() => {});
  }
  function chooseTool(next: AiTask) {
    setTask(next);
    setReport(reports.find((r) => r.task === next) || null);
    setError("");
    setNotice("");
  }

  return (
    <div className="ai-studio">
      <section className="panel ai-connection" aria-labelledby="nvidia-heading">
        <div className="section-heading">
          <div>
            <h2 id="nvidia-heading">
              <KeyRound size={18} /> NVIDIA connection
            </h2>
            <p>
              Use your own NVIDIA Build API key. It is never saved to
              localStorage, scan files or exported research.
            </p>
          </div>
          <span className={"ai-chip " + (status.connected ? "connected" : "")}>
            {status.connected ? "Connected" : "Not connected"}
          </span>
        </div>
        {status.connected ? (
          <div className="ai-connected">
            <div>
              <strong>{status.model}</strong>
              <p>
                {hosted
                  ? "Key stays in an encrypted, HttpOnly cookie tied to your sign-in. Sign out or disconnect to remove it."
                  : "Key stays in server memory until you disconnect or restart the app."}
              </p>
            </div>
            <button
              className="button secondary"
              disabled={!!busy}
              onClick={() => void disconnect()}
            >
              <Unplug size={15} /> Disconnect
            </button>
          </div>
        ) : (
          <form
            className="ai-connect-form"
            onSubmit={(e) => {
              e.preventDefault();
              void connect();
            }}
          >
            <label>
              NVIDIA API key
              <input
                name="nvidia-api-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Paste your key here"
                required
                disabled={!!busy}
                maxLength={2048}
              />
            </label>
            <label>
              Text model ID
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                required
                disabled={!!busy}
                list="nvidia-models"
                spellCheck={false}
              />
              <datalist id="nvidia-models">
                <option value={DEFAULT_MODEL} />
              </datalist>
            </label>
            <button className="button primary" disabled={!!busy || !key.trim()}>
              {busy.startsWith("Connecting") ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <KeyRound size={16} />
              )}{" "}
              Connect & test
            </button>
            <p className="ai-small">
              The connection test sends a short “OK” prompt to NVIDIA and may
              use your API allowance.{" "}
              <a
                href="https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b"
                target="_blank"
                rel="noreferrer"
              >
                Model & key details
              </a>
            </p>
          </form>
        )}
      </section>

      <section className="panel ai-research" aria-labelledby="ai-tools-heading">
        <div className="section-heading">
          <div>
            <h2 id="ai-tools-heading">
              <Sparkles size={18} /> What would you like to improve?
            </h2>
            <p>
              Start from page evidence. Turn ideas into changes you can review.
            </p>
            {scan && (
              <p className="ai-site-context">
                <strong>Website: {new URL(scan.url).hostname}</strong> ·{" "}
                {scan.pages.length} pages in this scan ·{" "}
                {new Date(scan.startedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
        <div className="ai-tools" role="group" aria-label="AI SEO tools">
          {AI_TOOLS.map((tool) => (
            <button
              type="button"
              key={tool.id}
              disabled={!!busy}
              aria-pressed={task === tool.id}
              className={"ai-tool " + (task === tool.id ? "selected" : "")}
              onClick={() => chooseTool(tool.id)}
            >
              <strong>{tool.name}</strong>
              <span>{tool.description}</span>
            </button>
          ))}
        </div>
        {!scan ? (
          <p className="notice">
            Scan a website or open a saved scan from Overview to give AI
            evidence to work with. You can connect your key now.
          </p>
        ) : (
          <form
            className="ai-research-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run();
            }}
          >
            <div className="ai-fields">
              <label className="ai-wide">
                {task === "brief"
                  ? "Topic for the content brief"
                  : "Seed keywords or topics"}
                <input
                  value={seeds}
                  onChange={(e) => setSeeds(e.target.value)}
                  placeholder="e.g. WordPress SEO, ecommerce product pages"
                  maxLength={1500}
                  disabled={!!busy}
                />
              </label>
              <label>
                Target market
                <input
                  value={market}
                  onChange={(e) => setMarket(e.target.value)}
                  placeholder="e.g. India, English-speaking small businesses"
                  maxLength={150}
                  disabled={!!busy}
                />
              </label>
              <label>
                Language
                <input
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="English"
                  maxLength={100}
                  disabled={!!busy}
                />
              </label>
              <label className="ai-wide">
                Audience & business context
                <input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Who you help, what you sell, and your main goal"
                  maxLength={1000}
                  disabled={!!busy}
                />
              </label>
              <label className="ai-wide">
                {task === "optimize"
                  ? "Page to improve"
                  : "Page focus (optional)"}
                <select
                  value={
                    pageUrl || (task === "optimize" ? pages[0]?.url || "" : "")
                  }
                  onChange={(e) => setPageUrl(e.target.value)}
                  disabled={!!busy}
                >
                  {task !== "optimize" && (
                    <option value="">
                      Whole scan · up to 20 successful pages
                    </option>
                  )}
                  {pages.map((p) => (
                    <option key={p.url} value={p.url}>
                      {pathLabel(p.url)} — {p.title || "Untitled"}
                    </option>
                  ))}
                </select>
              </label>
              {(task === "competitors" || task === "content") && (
                <label className="ai-wide">
                  Competitor URLs to inspect (optional, up to 2)
                  <textarea
                    value={competitors}
                    onChange={(e) => setCompetitors(e.target.value)}
                    placeholder={
                      "https://competitor-one.com/\nhttps://competitor-two.com/"
                    }
                    rows={3}
                    maxLength={4000}
                    disabled={!!busy}
                  />
                  <small>
                    Each run reads up to {hosted ? 3 : 5} pages per competitor,
                    respects robots.txt, and sends successful page evidence to
                    NVIDIA. Leave blank for unverified competitor ideas.
                  </small>
                </label>
              )}
              <label className="ai-wide">
                {task === "ask"
                  ? "Your question"
                  : "Additional direction (optional)"}
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={
                    task === "ask"
                      ? "What should I improve on this site first, and why?"
                      : "Anything the analysis should pay particular attention to?"
                  }
                  rows={3}
                  maxLength={3000}
                  required={task === "ask"}
                  disabled={!!busy}
                />
              </label>
            </div>
            <label className="ai-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={!!busy}
              />
              <span>
                Send sampled titles, descriptions, page text, links and audit
                findings to NVIDIA for this analysis. Results stay on this
                computer. NVIDIA account limits apply.
              </span>
            </label>
            <div className="ai-run-row">
              <button
                className="button primary"
                disabled={
                  !!busy ||
                  !status.connected ||
                  !consent ||
                  !pages.length ||
                  scan.status === "running"
                }
              >
                <Sparkles size={16} /> Run{" "}
                {AI_TOOLS.find((t) => t.id === task)?.name.toLowerCase()}{" "}
                <ArrowRight size={16} />
              </button>
              <span className="ai-small">
                No search-volume or live ranking feed is connected.
              </span>
            </div>
          </form>
        )}
      </section>
      {busy && (
        <div className="progress-panel" role="status">
          <LoaderCircle size={19} className="spin" />
          <div>
            <strong>{busy}</strong>
            <small>
              AI generation can take up to two minutes after competitor
              crawling.
            </small>
          </div>
          <button className="button secondary" onClick={() => void cancel()}>
            <CircleStop size={15} /> Cancel
          </button>
        </div>
      )}
      {error && (
        <p className="error ai-message" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="ai-success ai-message" role="status">
          <Check size={16} />
          {notice}
        </p>
      )}
      {reports.length > 0 && (
        <div className="ai-history">
          <label>
            Saved research
            <select
              aria-label="Saved research"
              value={report?.id || ""}
              disabled={!!busy}
              onChange={(e) => {
                const selected = reports.find((r) => r.id === e.target.value);
                if (selected) {
                  setReport(selected);
                  setTask(selected.task);
                }
              }}
            >
              <option value="" disabled>
                Choose a report
              </option>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {AI_TOOLS.find((t) => t.id === r.task)?.name} ·{" "}
                  {new Date(r.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {report && (
        <section
          className="panel ai-results"
          aria-labelledby="ai-result-heading"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">AI RESEARCH · REVIEW REQUIRED</span>
              <h2 id="ai-result-heading">
                {AI_TOOLS.find((t) => t.id === report.task)?.name}
              </h2>
              <p>
                {new Date(report.createdAt).toLocaleString()} · {report.model}
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => exportReport(report)}
            >
              <ArrowDownToLine size={15} /> Export research
            </button>
          </div>
          <p className="ai-summary">{report.summary}</p>
          <div className="ai-boundaries">
            {report.warnings.map((warning, i) => (
              <p key={i}>{warning}</p>
            ))}
          </div>
          {report.keywords.length > 0 && (
            <div className="ai-result-block">
              <h3>Keyword ideas & page mapping</h3>
              <p className="ai-small">
                Intent and relevance are AI inferences. Volume, difficulty and
                CPC are unknown.
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Keyword</th>
                      <th>Intent / cluster</th>
                      <th>Page to target</th>
                      <th>Why consider it?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.keywords.map((keyword, i) => (
                      <tr key={i}>
                        <td>
                          <strong>{keyword.keyword}</strong>
                        </td>
                        <td>
                          {keyword.intent}
                          <small>{keyword.cluster}</small>
                        </td>
                        <td>
                          {keyword.targetUrl.startsWith("http")
                            ? pathLabel(keyword.targetUrl)
                            : keyword.targetUrl}
                        </td>
                        <td>{keyword.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {report.competitors.length > 0 && (
            <div className="ai-result-block">
              <h3>Possible competitors to validate</h3>
              <p className="ai-small">
                Suggested from model knowledge. Inclusion does not confirm
                current activity or search competition.
              </p>
              {report.competitors.map((competitor, i) => (
                <article key={i} className="ai-action">
                  <span className="ai-chip">Unverified suggestion</span>
                  <h3>{competitor.name || competitor.url}</h3>
                  <p>{competitor.url}</p>
                  <p>{competitor.reason}</p>
                  <div className="ai-inline-actions">
                    <button
                      className="button secondary"
                      disabled={!!busy}
                      onClick={() => {
                        setCompetitors(competitor.url);
                        chooseTool("competitors");
                        setNotice(
                          "Competitor URL added above. Run the comparison to inspect its pages.",
                        );
                      }}
                    >
                      Use for comparison
                    </button>
                    <button
                      className="text-button"
                      disabled={!!busy}
                      onClick={() => inspect(competitor.url)}
                    >
                      Scan in Overview <ArrowRight size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {report.actions.length > 0 && (
            <div className="ai-result-block">
              <h3>Recommended next steps</h3>
              {report.actions.map((action, i) => (
                <article className="ai-action" key={i}>
                  <span className={"severity-tag " + action.priority}>
                    {action.priority} · AI recommendation
                  </span>
                  <h3>{action.title}</h3>
                  {action.url && <p className="ai-small">{action.url}</p>}
                  <p>
                    <strong>Reasoning: </strong>
                    {action.evidence}
                  </p>
                  <p className="ai-prose">{action.action}</p>
                </article>
              ))}
            </div>
          )}
          {report.sections.map((section, i) => (
            <div className="ai-result-block" key={i}>
              <h3>{section.heading}</h3>
              <p className="ai-prose">{section.text}</p>
            </div>
          ))}
          {report.repairs.length > 0 && (
            <div className="ai-result-block">
              <h3>Suggested drafts</h3>
              <p className="ai-small">
                Adding a draft changes your local repair plan only. Review its
                wording in Repair plan before export.
              </p>
              {report.repairs.map((repair) => {
                const added = repairs.some(
                  (r) => r.id === repair.id && r.value === repair.value,
                );
                return (
                  <article className="ai-action" key={repair.id}>
                    <h3>
                      {repair.field === "title" ? "Title" : "Meta description"}{" "}
                      · {pathLabel(repair.url)}
                    </h3>
                    <div className="ai-draft">
                      <div>
                        <small>CURRENT HTML</small>
                        <p>{repair.original || "(missing)"}</p>
                      </div>
                      <div>
                        <small>AI DRAFT</small>
                        <p>{repair.value}</p>
                      </div>
                    </div>
                    <p>{repair.reason}</p>
                    <button
                      className="button secondary"
                      disabled={added}
                      onClick={() => addRepair(repair)}
                    >
                      {added ? <Check size={15} /> : <Plus size={15} />}{" "}
                      {added
                        ? "Added to repair plan"
                        : "Add draft to repair plan"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
          <details className="ai-sources">
            <summary>
              Evidence · {report.context.selectedPageCount} of{" "}
              {report.context.totalPageCount} own pages ·{" "}
              {report.context.competitorPageCount} competitor pages
            </summary>
            <p className="ai-small">
              Response HTML sampled for this report. Other pages and live search
              results were not inspected.
            </p>
            <ul>
              {report.sources.map((source, i) => (
                <li key={i}>
                  <strong>
                    {source.kind === "site" ? "Your site" : "Competitor"}
                  </strong>{" "}
                  · {source.url}
                  <small>
                    HTTP {source.status} · {source.title || "Untitled"} ·{" "}
                    {new Date(source.scannedAt).toLocaleString()}
                  </small>
                </li>
              ))}
            </ul>
            {report.usage?.total_tokens !== undefined && (
              <p className="ai-small">
                NVIDIA reported {report.usage.total_tokens.toLocaleString()}{" "}
                total tokens for this generation.
              </p>
            )}
          </details>
        </section>
      )}
    </div>
  );
}
