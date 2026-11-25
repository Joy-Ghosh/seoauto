import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  CircleStop,
  FileSearch,
  Files,
  GitBranch,
  Globe2,
  LayoutDashboard,
  Link2,
  ListChecks,
  LoaderCircle,
  Play,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { Page, Repair, Scan } from "./types";
import { connections } from "./topology";
import AiStudio from "./AiStudio";
import { AI_TOOLS } from "./ai-types";
import type { AiTask } from "./ai-types";
import { api, hosted } from "./client";
import AccessGate, { useOwnerSession } from "./AccessGate";
import { exportScan, exportCsv } from "./exports";
import ScanBackup from "./ScanBackup";
import "./style.css";
type View = "overview" | "issues" | "pages" | "links" | "repairs" | "ai";
type History = {
  id: string;
  url: string;
  status: string;
  startedAt: string;
  pages: number;
  issues: number;
};
const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "issues", label: "Findings", icon: FileSearch },
  { id: "pages", label: "Pages", icon: Files },
  { id: "links", label: "Internal links", icon: GitBranch },
  { id: "repairs", label: "Repair plan", icon: ListChecks },
  { id: "ai", label: "AI Studio", icon: Sparkles },
] as const;
const short = (url: string) => {
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname + u.search) || "/";
  } catch {
    return url;
  }
};
const host = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};
const icons = {
  high: "Needs attention",
  medium: "Review next",
  low: "Small improvement",
  info: "Context only",
};
function download(name: string, data: unknown) {
  const b = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function App() {
  const owner = useOwnerSession();
  const [aiLaunch, setAiLaunch] = useState<{
    task: AiTask;
    pageUrl: string;
    scanId: string;
  } | null>(null);
  const [view, setView] = useState<View>("overview"),
    [scan, setScan] = useState<Scan | null>(null),
    [history, setHistory] = useState<History[]>([]),
    [url, setUrl] = useState(""),
    [limit, setLimit] = useState(40),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [severity, setSeverity] = useState("all"),
    [detail, setDetail] = useState<Page | null>(null),
    [repairs, setRepairs] = useState<Repair[]>([]),
    [help, setHelp] = useState(false),
    [toast, setToast] = useState("");
  const refreshHistory = () =>
    api<History[]>("/api/scans")
      .then(setHistory)
      .catch(() => {});
  useEffect(() => {
    refreshHistory();
    const previous = sessionStorage.getItem("seo:last-scan");
    if (previous)
      void api<Scan>("/api/scans/" + previous)
        .then(setScan)
        .catch(() => sessionStorage.removeItem("seo:last-scan"));
  }, []);
  useEffect(() => {
    if (scan) sessionStorage.setItem("seo:last-scan", scan.id);
  }, [scan?.id]);
  useEffect(() => {
    if (!scan) return;
    try {
      setRepairs(
        JSON.parse(localStorage.getItem("repairs:" + scan.id) || "[]"),
      );
    } catch {
      setRepairs([]);
    }
  }, [scan?.id]);
  useEffect(() => {
    if (scan)
      localStorage.setItem("repairs:" + scan.id, JSON.stringify(repairs));
  }, [repairs]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (scan?.status !== "running") return;
    const t = setInterval(
      () =>
        api<Scan>("/api/scans/" + scan.id)
          .then((s) => {
            setScan(s);
            if (s.status !== "running") refreshHistory();
          })
          .catch((e) => setError(e.message)),
      700,
    );
    return () => clearInterval(t);
  }, [scan?.id, scan?.status]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDetail(null);
        setHelp(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    if (!detail && !help) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const dialog = document.querySelector('[role="dialog"]');
      const items = dialog?.querySelectorAll<HTMLElement>(
        "button:not([disabled]),a[href],select,input,textarea",
      );
      if (!items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [Boolean(detail), help]);
  const start = async (sample = false) => {
    setBusy(true);
    setError("");
    try {
      const target = sample
        ? window.location.origin + "/fixture/"
        : url.trim().match(/^https?:\/\//)
          ? url.trim()
          : "https://" + url.trim();
      const data = await api<{ id: string }>("/api/scans", {
        url: target,
        limit,
        sample,
      });
      setRepairs([]);
      setScan(await api<Scan>("/api/scans/" + data.id));
      setView("overview");
      setDetail(null);
      setQuery("");
      refreshHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const running = scan?.status === "running";
  const issues = scan?.issues || [];
  const pages = scan?.pages || [];
  const high = issues.filter((i) => i.severity === "high").length;
  const affected = new Set(
    issues.filter((i) => i.severity !== "info").map((i) => i.url),
  ).size;
  const filtered = issues.filter(
    (i) =>
      (severity === "all" || i.severity === severity) &&
      `${i.url} ${i.label} ${i.detail}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const groups = useMemo(
    () =>
      Object.values(
        issues.reduce<
          Record<
            string,
            { label: string; count: number; type: string; severity: string }
          >
        >((m, i) => {
          m[i.type] ??= {
            label: i.label,
            count: 0,
            type: i.type,
            severity: i.severity,
          };
          m[i.type].count++;
          return m;
        }, {}),
      ),
    [issues],
  );
  const choose = (v: View) => {
    setView(v);
    setQuery("");
    setSeverity("all");
  };
  const openAi = (task: AiTask, pageUrl = "") => {
    if (!scan) return;
    setAiLaunch({ task, pageUrl, scanId: scan.id });
    setDetail(null);
    choose("ai");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const addRepair = (repair: Repair) => {
    setRepairs((prev) => [...prev.filter((r) => r.id !== repair.id), repair]);
    setToast("Saved to your local repair plan.");
  };
  const exportPlan = () => {
    if (!scan) return;
    download("seo-repair-plan.json", {
      schema: "local-seo-plan/v1",
      site: new URL(pages[0]?.finalUrl || scan.url).origin,
      scanStartedAt: scan.startedAt,
      createdAt: new Date().toISOString(),
      repairs,
    });
    setToast("Repair plan exported. Check your browser downloads.");
  };
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            choose("overview");
          }}
        >
          <span className="brand-symbol">
            <GitBranch size={22} />
          </span>
          <span>
            SEO<span className="brand-light">workbench</span>
            <small>YOUR LOCAL WORKSPACE</small>
          </span>
        </a>
        <div className="workspace">
          <span className="site-icon">
            <Globe2 size={17} />
          </span>
          <div>
            <strong>{scan ? host(scan.url) : "Your next website"}</strong>
            <small>
              {scan ? "Local audit workspace" : "Add a site to get started"}
            </small>
          </div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "nav-item active" : "nav-item"}
              onClick={() => choose(n.id)}
              aria-current={view === n.id ? "page" : undefined}
            >
              <n.icon size={18} />
              {n.label}
              {n.id === "repairs" && repairs.length > 0 && (
                <span className="nav-count">{repairs.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
            How this works
          </button>
          <div className="local-note">
            <span className="status-dot" />
            <div>
              <strong>
                {hosted ? "Private owner workspace" : "Runs on your computer"}
              </strong>
              <small>
                {hosted
                  ? "Private workspace. Your AI key."
                  : "Local scans. Optional NVIDIA AI."}
              </small>
            </div>
          </div>
        </div>
      </aside>
      <div className="shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <span>{nav.find((n) => n.id === view)?.label}</span>
          </div>
          <div className="topbar-actions">
            <span className="local-badge">
              <ShieldCheck size={14} />{" "}
              {view === "ai"
                ? "AI via NVIDIA"
                : hosted
                  ? "Private workspace"
                  : "Local workspace"}
            </span>
            {hosted && (
              <button className="workspace-signout" onClick={owner.logout}>
                Sign out
              </button>
            )}
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">A LITTLE CLARITY. A BETTER WEBSITE.</div>
              <h1>
                {view === "overview"
                  ? "Make the next fix count."
                  : view === "issues"
                    ? "Know what needs attention."
                    : view === "pages"
                      ? "Every page, in context."
                      : view === "links"
                        ? "Connect the useful pages."
                        : view === "ai"
                          ? "Give your SEO a research partner."
                          : "Review before you change."}
              </h1>
              <p>
                {view === "overview"
                  ? "Scan your website. Understand the evidence. Make a plan."
                  : view === "issues"
                    ? "Clear findings with a reason and a practical next step."
                    : view === "pages"
                      ? "The response HTML, metadata and links we actually read."
                      : view === "links"
                        ? "Candidates from shared words in existing page content. Always review the placement."
                        : view === "ai"
                          ? "Use your NVIDIA key to turn page evidence into keyword ideas, content plans and reviewable improvements."
                          : "Your drafts stay on this computer until you export and apply them."}
              </p>
            </div>
            {scan && scan.status !== "running" && (
              <a
                className="button secondary"
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  exportScan(scan);
                }}
              >
                <ArrowDownToLine size={16} /> Export report
              </a>
            )}
          </div>
          {(view === "overview" || (!scan && view !== "ai")) && (
            <section className="scan-panel">
              <div className="scan-label">
                <span className="scan-icon">
                  <Search size={19} />
                </span>
                <div>
                  <h2>Start with a website</h2>
                  <p>Read-only scan · one website · up to 200 pages</p>
                </div>
                <span className="html-label">HTML CRAWLER</span>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void start();
                }}
              >
                <label className="url-field">
                  <Globe2 size={18} />
                  <span className="sr-only">Website URL</span>
                  <input
                    type="text"
                    inputMode="url"
                    placeholder="yourwebsite.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    disabled={running || busy}
                  />
                </label>
                <label className="limit-field">
                  <span>Page limit</span>
                  <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    disabled={running}
                  >
                    {[10, 40, 100, 200].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <button className="button primary" disabled={busy || running}>
                  {busy ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Search size={17} />
                  )}{" "}
                  {running ? "Scan in progress" : "Scan website"}
                  <ArrowRight size={16} />
                </button>
              </form>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="scan-footer">
                <span>
                  <Check size={13} /> Respects robots.txt
                </span>
                <span>
                  <Check size={13} /> No website changes
                </span>
                <button
                  className="text-button"
                  disabled={busy || running}
                  onClick={() => void start(true)}
                >
                  {hosted ? "Load sample audit" : "Try the local sample"}{" "}
                  <ArrowUpRight size={13} />
                </button>
              </div>
            </section>
          )}
          {view === "overview" && (
            <ScanBackup
              scan={scan}
              repairs={repairs}
              imported={(value) => {
                setScan(value);
                setView("overview");
                refreshHistory();
                setToast(
                  "Scan imported into this browser. Review draft changes before export.",
                );
              }}
            />
          )}
          {running && (
            <section className="progress-panel" aria-live="polite">
              <LoaderCircle size={20} className="spin" />
              <div>
                <strong>Reading page {pages.length + 1}</strong>
                <span>{scan.current || "Checking robots.txt…"}</span>
                <small>
                  {pages.length} read · {scan.discovered} discovered ·{" "}
                  {scan.skipped} excluded by robots.txt
                </small>
              </div>
              <button
                className="button secondary"
                onClick={() =>
                  void api("/api/scans/" + scan.id + "/stop", {}).catch((e) =>
                    setError(e.message),
                  )
                }
              >
                <CircleStop size={16} />
                Stop scan
              </button>
              <div className="indeterminate" />
            </section>
          )}
          {view === "ai" ? (
            <AiStudio
              key={scan?.id || "setup"}
              scan={scan}
              addRepair={addRepair}
              repairs={repairs}
              initialTask={
                aiLaunch?.scanId === scan?.id ? aiLaunch?.task : undefined
              }
              initialPageUrl={
                aiLaunch?.scanId === scan?.id ? aiLaunch?.pageUrl : undefined
              }
              inspect={(target) => {
                setUrl(target);
                choose("overview");
              }}
            />
          ) : !scan ? (
            <>
              <section className="empty-intro">
                <div className="section-heading">
                  <h2>A clear path from scan to action</h2>
                  <span>THREE SIMPLE STEPS</span>
                </div>
                <div className="steps">
                  {[
                    {
                      n: "01",
                      icon: FileSearch,
                      title: "See what’s there",
                      text: "Read the pages, metadata, headings and internal links your site serves.",
                    },
                    {
                      n: "02",
                      icon: SlidersHorizontal,
                      title: "Understand the evidence",
                      text: "Separate errors, review suggestions and intentional choices.",
                    },
                    {
                      n: "03",
                      icon: ListChecks,
                      title: "Make a repair plan",
                      text: "Draft changes, export your plan and review it before applying.",
                    },
                  ].map((s) => (
                    <article key={s.n}>
                      <div className="step-top">
                        <span className="step-icon">
                          <s.icon size={22} />
                        </span>
                        <span>{s.n}</span>
                      </div>
                      <h3>{s.title}</h3>
                      <p>{s.text}</p>
                    </article>
                  ))}
                </div>
              </section>
              <HistoryPanel
                history={history}
                select={(id) =>
                  api<Scan>("/api/scans/" + id)
                    .then(setScan)
                    .catch((e) => setError(e.message))
                }
              />
            </>
          ) : (
            <>
              {!running && (
                <div className="scan-context">
                  <span
                    className={
                      "status-dot " +
                      (scan.status === "completed" ? "" : "muted")
                    }
                  />
                  <strong>
                    {scan.status === "completed"
                      ? "Scan finished"
                      : scan.status === "cancelled"
                        ? "Scan stopped"
                        : scan.status === "failed"
                          ? "Scan could not finish"
                          : "Scan in progress"}
                  </strong>
                  <span>{host(scan.url)}</span>
                  <time>{new Date(scan.startedAt).toLocaleString()}</time>
                </div>
              )}
              {scan.error && (
                <div className="error-box" role="alert">
                  {scan.error}
                </div>
              )}
              {view === "overview" && (
                <>
                  <div className="metrics">
                    <Metric
                      label="Pages read"
                      value={pages.length}
                      note={`${scan.discovered} discovered · limit ${scan.limit}`}
                      icon={Files}
                    />
                    <Metric
                      label="Pages to review"
                      value={affected}
                      note="At least one actionable finding"
                      icon={FileSearch}
                    />
                    <Metric
                      label="High-priority findings"
                      value={high}
                      note="HTTP errors, missing titles or broken links"
                      icon={ListChecks}
                    />
                    <Metric
                      label="Link candidates"
                      value={scan.suggestions.length}
                      note="Text matches for editorial review"
                      icon={Link2}
                    />
                  </div>
                  <section
                    className="panel scan-ai-actions"
                    aria-labelledby="scan-ai-heading"
                  >
                    <div className="section-heading">
                      <div>
                        <h2 id="scan-ai-heading">
                          <Sparkles size={19} /> Explore this website with AI
                        </h2>
                        <p>
                          Choose an analysis for{" "}
                          <strong>{host(scan.url)}</strong>. Uses this scan’s
                          page evidence and your NVIDIA connection.
                        </p>
                      </div>
                      <span className="ai-chip">
                        {
                          pages.filter(
                            (p) =>
                              p.status >= 200 && p.status < 300 && !p.error,
                          ).length
                        }{" "}
                        successful pages
                      </span>
                    </div>
                    <div className="scan-ai-grid">
                      {AI_TOOLS.map((tool) => (
                        <button
                          key={tool.id}
                          className="scan-ai-action"
                          disabled={
                            running ||
                            !pages.some(
                              (p) =>
                                p.status >= 200 && p.status < 300 && !p.error,
                            )
                          }
                          onClick={() => openAi(tool.id)}
                        >
                          <div>
                            <strong>{tool.name}</strong>
                            <span>{tool.description}</span>
                          </div>
                          <ArrowUpRight size={17} />
                        </button>
                      ))}
                    </div>
                    <p className="ai-small">
                      Choose an option to review its settings before running. AI
                      ideas require review; search volume and rankings are not
                      measured.
                    </p>
                  </section>
                  <div className="overview-grid">
                    <section className="panel findings-summary">
                      <div className="section-heading">
                        <div>
                          <h2>Your next useful fixes</h2>
                          <p>Grouped by check across the scanned pages</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => choose("issues")}
                        >
                          All findings <ArrowRight size={14} />
                        </button>
                      </div>
                      {groups.length ? (
                        groups.slice(0, 6).map((g) => (
                          <button
                            className="finding-group"
                            key={g.type}
                            onClick={() => {
                              choose("issues");
                              setQuery(g.label);
                            }}
                          >
                            <span className={"severity-marker " + g.severity} />
                            <span>
                              <strong>{g.label}</strong>
                              <small>
                                {icons[g.severity as keyof typeof icons]}
                              </small>
                            </span>
                            <span className="count-pill">{g.count}</span>
                            <ChevronRight size={16} />
                          </button>
                        ))
                      ) : (
                        <div className="quiet-empty">
                          <CheckCheck size={30} />
                          <h3>
                            {running
                              ? "Findings appear when the scan finishes."
                              : "No findings from these checks."}
                          </h3>
                          <p>
                            That covers this HTML scan, rather than every aspect
                            of SEO.
                          </p>
                        </div>
                      )}
                    </section>
                    <section className="panel coverage">
                      <div className="section-heading">
                        <h2>Know the scan’s limits</h2>
                        <CircleHelp size={18} />
                      </div>
                      <div className="coverage-icon">
                        <Globe2 size={38} />
                      </div>
                      <h3>Evidence, with the edges visible.</h3>
                      <p>
                        This scan reads server HTML. It does not run page
                        JavaScript or measure search rankings.
                      </p>
                      <dl>
                        <div>
                          <dt>Pages with responses</dt>
                          <dd>{pages.filter((p) => p.status > 0).length}</dd>
                        </div>
                        <div>
                          <dt>Robots-excluded URLs</dt>
                          <dd>{scan.skipped}</dd>
                        </div>
                        <div>
                          <dt>External links</dt>
                          <dd>Not checked</dd>
                        </div>
                        <div>
                          <dt>Search demand</dt>
                          <dd>Unknown</dd>
                        </div>
                      </dl>
                      <button
                        className="text-button"
                        onClick={() => setHelp(true)}
                      >
                        Read the check definitions <ArrowRight size={14} />
                      </button>
                    </section>
                  </div>
                  {scan.notice.map((n, i) => (
                    <p className="notice" key={i}>
                      <CircleHelp size={14} />
                      {n}
                    </p>
                  ))}
                  <HistoryPanel
                    history={history.filter((h) => h.id !== scan.id)}
                    select={(id) => api<Scan>("/api/scans/" + id).then(setScan)}
                  />
                </>
              )}
              {view === "issues" && (
                <section className="panel">
                  <div className="table-toolbar">
                    <label className="search-input">
                      <Search size={17} />
                      <input
                        aria-label="Search findings"
                        placeholder="Search findings or URLs"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    <select
                      aria-label="Filter by severity"
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value)}
                    >
                      <option value="all">All priorities</option>
                      {Object.entries(icons).map(([key, label]) => (
                        <option value={key} key={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <a
                      className="button secondary"
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        exportCsv(scan);
                      }}
                    >
                      <ArrowDownToLine size={15} />
                      CSV
                    </a>
                  </div>
                  <div className="finding-list">
                    {filtered.map((i) => (
                      <article className="finding" key={i.id}>
                        <span className={"severity-tag " + i.severity}>
                          {icons[i.severity]}
                        </span>
                        <div>
                          <h3>{i.label}</h3>
                          <button
                            className="page-link"
                            onClick={() =>
                              setDetail(
                                pages.find((p) => p.url === i.url) || null,
                              )
                            }
                          >
                            {short(i.url)}
                          </button>
                          <p className="evidence">{i.detail}</p>
                          <p className="next-action">
                            <ArrowRight size={14} />
                            {i.action}
                          </p>
                        </div>
                        <button
                          className="button secondary"
                          onClick={() =>
                            setDetail(
                              pages.find((p) => p.url === i.url) || null,
                            )
                          }
                        >
                          Review page
                          <ChevronRight size={14} />
                        </button>
                      </article>
                    ))}
                    {!filtered.length && (
                      <Empty text="No findings match this view." />
                    )}
                  </div>
                </section>
              )}
              {view === "pages" && (
                <section className="panel">
                  <div className="table-toolbar">
                    <label className="search-input">
                      <Search size={17} />
                      <input
                        aria-label="Search pages"
                        placeholder="Search page title or URL"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    <span>{pages.length} pages read</span>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Page</th>
                          <th>Status</th>
                          <th>Words</th>
                          <th>Findings</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {pages
                          .filter((p) =>
                            (p.url + " " + p.title)
                              .toLowerCase()
                              .includes(query.toLowerCase()),
                          )
                          .map((p) => (
                            <tr key={p.url}>
                              <td>
                                <button
                                  className="page-link"
                                  onClick={() => setDetail(p)}
                                >
                                  {p.title || "Untitled page"}
                                </button>
                                <small>{short(p.url)}</small>
                              </td>
                              <td>
                                <span
                                  className={
                                    "http-status " +
                                    (p.status >= 400 || !p.status ? "bad" : "")
                                  }
                                >
                                  {p.status || "Unread"}
                                </span>
                              </td>
                              <td>{p.wordCount}</td>
                              <td>
                                {issues.filter((i) => i.url === p.url).length}
                              </td>
                              <td>
                                <button
                                  className="icon-button"
                                  aria-label={"Review " + p.url}
                                  onClick={() => setDetail(p)}
                                >
                                  <ArrowUpRight size={18} />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {view === "links" && (
                <>
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Page connections</h2>
                        <p>
                          Unique links between scanned pages. Depth starts at
                          the first page; counts include nofollow links.
                        </p>
                      </div>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Page</th>
                            <th>Incoming pages</th>
                            <th>Outgoing pages</th>
                            <th>Click depth</th>
                          </tr>
                        </thead>
                        <tbody>
                          {connections(pages).map((row) => (
                            <tr key={row.page.url}>
                              <td>
                                <button
                                  className="page-link"
                                  onClick={() => setDetail(row.page)}
                                >
                                  {short(row.page.url)}
                                </button>
                              </td>
                              <td>{row.incoming}</td>
                              <td>{row.outgoing}</td>
                              <td>{row.depth ?? "Unreached"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="notice">
                      Zero incoming links only describes this scanned subset. It
                      does not establish that a page is orphaned across the
                      whole site.
                    </p>
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Internal link candidates</h2>
                        <p>
                          Shared words, not an AI confidence or ranking
                          prediction.
                        </p>
                      </div>
                      <span className="count-pill">
                        {scan.suggestions.length}
                      </span>
                    </div>
                    {scan.suggestions.map((s, i) => (
                      <article className="link-candidate" key={i}>
                        <div className="link-route">
                          <span>
                            FROM <strong>{short(s.source)}</strong>
                          </span>
                          <ArrowRight size={16} />
                          <span>
                            TO <strong>{short(s.target)}</strong>
                          </span>
                        </div>
                        <p>{s.context}</p>
                        <div>
                          <span className="anchor-label">Candidate anchor</span>
                          <strong className="anchor-text">{s.anchor}</strong>
                          <span className="overlap">
                            Shared: {s.overlap.join(", ")}
                          </span>
                        </div>
                      </article>
                    ))}
                    {!scan.suggestions.length && (
                      <Empty text="No eligible text-match candidates in this scan. That does not mean the site needs no links." />
                    )}
                  </section>
                </>
              )}
              {view === "repairs" && (
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>Drafts you can stand behind</h2>
                      <p>
                        Review a page to add a title, description or image-alt
                        draft.
                      </p>
                    </div>
                    <button
                      className="button primary"
                      disabled={!repairs.length}
                      onClick={exportPlan}
                    >
                      <ArrowDownToLine size={16} /> Export plan
                    </button>
                  </div>
                  {repairs.map((r) => (
                    <article className="repair" key={r.id}>
                      <div className="repair-head">
                        <strong>{r.field.replaceAll("_", " ")}</strong>
                        <span>{short(r.url)}</span>
                        <button
                          className="icon-button"
                          aria-label="Remove draft"
                          onClick={() =>
                            setRepairs((prev) =>
                              prev.filter((x) => x.id !== r.id),
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="diff">
                        <div>
                          <small>CURRENT HTML</small>
                          <p>{r.original || "(empty)"}</p>
                        </div>
                        <div>
                          <small>YOUR DRAFT</small>
                          <p>{r.value}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                  {!repairs.length && (
                    <Empty text="Your repair plan is empty. Open a page, review its evidence, and write a draft." />
                  )}
                  <div className="plugin-note">
                    <ShieldCheck size={22} />
                    <div>
                      <h3>Apply supported changes in WordPress</h3>
                      {hosted && (
                        <a
                          className="text-button"
                          href="/downloads/local-seo-repairs.zip"
                          download
                        >
                          Download companion plugin{" "}
                          <ArrowDownToLine size={14} />
                        </a>
                      )}
                      <p>
                        The included companion plugin lets a WordPress
                        administrator import this plan, preview changes and
                        apply or restore supported fields. A JSON export does
                        not publish anything.
                      </p>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
          <footer>
            <span>
              {hosted ? "SEO Workbench · Private" : "Local SEO Workbench"}
            </span>
            <span>Clear evidence. Human decisions.</span>
            <button className="text-button" onClick={() => setHelp(true)}>
              About the checks <ArrowUpRight size={13} />
            </button>
          </footer>
        </main>
      </div>
      {detail && (
        <PageDrawer
          page={detail}
          repairs={repairs}
          save={addRepair}
          close={() => setDetail(null)}
          findings={issues.filter((i) => i.url === detail.url).length}
          analyze={() => openAi("optimize", detail.url)}
        />
      )}{" "}
      {help && (
        <div className="scrim" onClick={() => setHelp(false)}>
          <section
            className="help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              className="icon-button close"
              aria-label="Close help"
              onClick={() => setHelp(false)}
            >
              <X />
            </button>
            <h2 id="help-title">Useful checks. Honest limits.</h2>
            <p>
              Every finding comes from the response HTML or a URL fetched in
              this scan. Your site is never edited by crawling.
            </p>
            <h3>No mysterious score</h3>
            <p>
              High priority means an HTTP error, missing title, or a link to a
              crawled error page. Length, short content and canonical
              differences require judgment. No ranking or traffic score is
              invented.
            </p>
            <h3>What is outside this scan?</h3>
            <p>
              JavaScript rendering, external link health, search rankings,
              Google index status and search demand. “Unknown” stays unknown.
            </p>
            <h3>WordPress repair plans</h3>
            <p>
              Title, description and attachment-alt drafts can be exported to
              the companion plugin. H1 and internal-link candidates remain
              editorial work. Applying or restoring requires an administrator’s
              explicit action.
            </p>
            <button className="button primary" onClick={() => setHelp(false)}>
              Got it
              <Check size={16} />
            </button>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: number;
  note: string;
  icon: typeof Files;
}) {
  return (
    <article className="metric">
      <div>
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="quiet-empty">
      <FileSearch size={28} />
      <p>{text}</p>
    </div>
  );
}
function HistoryPanel({
  history,
  select,
}: {
  history: History[];
  select: (id: string) => void;
}) {
  return (
    history.length > 0 && (
      <section className="panel history">
        <div className="section-heading">
          <h2>Previous scans</h2>
          <span>Saved locally</span>
        </div>
        {history.slice(0, 6).map((h) => (
          <button key={h.id} onClick={() => select(h.id)}>
            <Globe2 size={18} />
            <strong>{host(h.url)}</strong>
            <span>{h.pages} pages</span>
            <span>{h.issues} findings</span>
            <time>{new Date(h.startedAt).toLocaleDateString()}</time>
            <ChevronRight size={16} />
          </button>
        ))}
      </section>
    )
  );
}
function PageDrawer({
  page,
  repairs,
  save,
  close,
  findings,
  analyze,
}: {
  page: Page;
  repairs: Repair[];
  save: (r: Repair) => void;
  close: () => void;
  findings: number;
  analyze: () => void;
}) {
  const [field, setField] = useState<Repair["field"]>("title"),
    [image, setImage] = useState(0),
    [value, setValue] = useState("");
  const original =
    field === "title"
      ? page.title
      : field === "meta_description"
        ? page.description
        : page.images[image]?.alt || "";
  const id =
    page.url + field + (field === "alt_text" ? page.images[image]?.src : "");
  const existing = repairs.find((r) => r.id === id);
  useEffect(() => setValue(existing?.value || original), [id]);
  return (
    <div className="scrim" onClick={close}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header">
          <span className="eyebrow">PAGE REVIEW</span>
          <button
            autoFocus
            className="icon-button"
            onClick={close}
            aria-label="Close page review"
          >
            <X size={21} />
          </button>
        </div>
        <h2 id="page-title">{page.title || "Untitled page"}</h2>
        <button
          className="button secondary page-ai-button"
          disabled={page.status < 200 || page.status >= 300 || !!page.error}
          onClick={analyze}
        >
          <Sparkles size={16} /> Improve this page with AI
        </button>
        <a
          href={page.url}
          target="_blank"
          rel="noreferrer"
          className="external-url"
        >
          {page.url}
          <ArrowUpRight size={15} />
        </a>
        <div className="drawer-stats">
          <span>HTTP {page.status || "unknown"}</span>
          <span>{page.wordCount} words</span>
          <span>{findings} findings</span>
        </div>
        <h3>What the page serves</h3>
        <dl className="page-data">
          <div>
            <dt>Title</dt>
            <dd>{page.title || "Missing"}</dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{page.description || "Missing"}</dd>
          </div>
          <div>
            <dt>H1 headings</dt>
            <dd>{page.h1.join(" / ") || "None found"}</dd>
          </div>
          <div>
            <dt>Canonical</dt>
            <dd>{page.canonical || "Not declared"}</dd>
          </div>
          <div>
            <dt>Robots</dt>
            <dd>{page.robots || "No restriction found in response"}</dd>
          </div>
          <div>
            <dt>Links / schema blocks</dt>
            <dd>
              {page.links.length} links · {page.schemaCount} JSON-LD blocks
            </dd>
          </div>
        </dl>
        <section className="draft-editor">
          <div className="section-heading">
            <h3>Draft a change</h3>
            <span className="local-badge">Not published</span>
          </div>
          <label>
            Field
            <select
              value={field}
              onChange={(e) => setField(e.target.value as Repair["field"])}
            >
              <option value="title">SEO title</option>
              <option value="meta_description">Meta description</option>
              <option value="alt_text" disabled={!page.images.length}>
                Image alt text
              </option>
            </select>
          </label>
          {field === "alt_text" && (
            <label>
              Image
              <select
                value={image}
                onChange={(e) => setImage(Number(e.target.value))}
              >
                {page.images.map((i, n) => (
                  <option key={n} value={n}>
                    {short(i.src)}
                  </option>
                ))}
              </select>
              <small>
                Attachment alt text may be shared across several WordPress
                pages.
              </small>
            </label>
          )}
          <label>
            Your replacement
            <textarea
              rows={4}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Write an accurate replacement…"
            />
          </label>
          <div className="editor-footer">
            <small>{value.length} characters · written by you</small>
            <button
              className="button primary"
              disabled={!value.trim() || value === original}
              onClick={() =>
                save({
                  id,
                  url: page.url,
                  field,
                  original,
                  value: value.trim(),
                  ...(field === "alt_text"
                    ? { imageSrc: page.images[image]?.src }
                    : {}),
                })
              }
            >
              <Plus size={16} />
              Save draft
            </button>
          </div>
          <p className="notice">
            Saving creates a local draft. Export and review it in WordPress
            before applying.
          </p>
        </section>
      </aside>
    </div>
  );
}
const mount = document.getElementById("root")! as HTMLElement & {
  seoRoot?: ReturnType<typeof createRoot>;
};
(mount.seoRoot ??= createRoot(mount)).render(
  <AccessGate>
    <App />
  </AccessGate>,
);
