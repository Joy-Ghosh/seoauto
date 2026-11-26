import React, { lazy, useEffect, useMemo, useRef, useState } from "react";
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
import { pollScan } from "./poll-scan";
import DeferredTool from "./DeferredTool";
import { AI_TOOLS } from "./ai-types";
import type { AiTask } from "./ai-types";
import { api, hosted } from "./client";
import AccessGate, { useOwnerSession } from "./AccessGate";
import { exportScan, exportCsv } from "./exports";
import "./workspace.css";
const AiStudio = lazy(() => import("./AiStudio"));
const ScanBackup = lazy(() => import("./ScanBackup"));
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
  { id: "links", label: "Links", icon: GitBranch },
  { id: "repairs", label: "Repair plan", icon: ListChecks },
  { id: "ai", label: "AI Research", icon: Sparkles },
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
  const [composerOpen, setComposerOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const scanInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const selection = useRef(0);
  const [undoRepair, setUndoRepair] = useState<{
    scanId: string;
    repair: Repair;
  } | null>(null);
  const [aiLaunch, setAiLaunch] = useState<{
    task: AiTask;
    pageUrl: string;
    scanId: string;
  } | null>(null);
  const [view, setView] = useState<View>(
      () =>
        nav.find((item) => "#" + item.id === location.hash)?.id || "overview",
    ),
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
    const request = selection.current;
    if (previous)
      void api<Scan>("/api/scans/" + previous)
        .then((value) => {
          if (request === selection.current) setScan(value);
        })
        .catch(() => {
          if (request === selection.current)
            sessionStorage.removeItem("seo:last-scan");
        });
  }, []);
  useEffect(() => {
    const restoreView = () => {
      const next = nav.find((item) => "#" + item.id === location.hash)?.id;
      if (next) {
        setView(next);
        setQuery("");
        setSeverity("all");
        setDetail(null);
      } else if (!location.hash) setView("overview");
    };
    window.addEventListener("popstate", restoreView);
    window.addEventListener("hashchange", restoreView);
    return () => {
      window.removeEventListener("popstate", restoreView);
      window.removeEventListener("hashchange", restoreView);
    };
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
    const t = setTimeout(() => {
      setToast("");
      setUndoRepair(null);
    }, 6500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (scan?.status !== "running") return;
    return pollScan(
      () => api<Scan>("/api/scans/" + scan.id),
      (value) => {
        setScan((current) => (current?.id === value.id ? value : current));
        if (value.status !== "running") refreshHistory();
      },
      (error) => setError(error.message),
    );
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
      if (!dialog?.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
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
    const request = ++selection.current;
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
      const value = await api<Scan>("/api/scans/" + data.id);
      if (request !== selection.current) return;
      setRepairs([]);
      setScan(value);
      choose("overview");
      setComposerOpen(false);
      setDetail(null);
      setQuery("");
      refreshHistory();
    } catch (e) {
      if (request === selection.current) setError((e as Error).message);
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
    if (v !== "ai") setAiLaunch(null);
    if (location.hash !== "#" + v) window.history.pushState(null, "", "#" + v);
    setView(v);
    setQuery("");
    setSeverity("all");
    window.scrollTo({ top: 0, behavior: "auto" });
    requestAnimationFrame(() =>
      heading.current?.focus({ preventScroll: true }),
    );
  };
  const selectScan = async (id: string) => {
    const request = ++selection.current;
    setError("");
    try {
      const value = await api<Scan>("/api/scans/" + id);
      if (request !== selection.current) return;
      setScan(value);
      choose("overview");
      setComposerOpen(false);
    } catch (error) {
      if (request === selection.current) setError((error as Error).message);
    }
  };
  const newScan = () => {
    choose("overview");
    setComposerOpen(true);
    requestAnimationFrame(() => scanInput.current?.focus());
  };
  const openAi = (task: AiTask, pageUrl = "") => {
    if (!scan) return;
    setAiLaunch({ task, pageUrl, scanId: scan.id });
    setDetail(null);
    choose("ai");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const addRepair = (repair: Repair) => {
    setUndoRepair(null);
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
      <a className="skip-link" href="#workspace-content">
        Skip to content
      </a>
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
            SEO Workbench
            <small>Website intelligence</small>
          </span>
        </a>
        <div className="workspace">
          <span className="site-icon">
            <Globe2 size={17} />
          </span>
          <div>
            <strong>{scan ? host(scan.url) : "Your next website"}</strong>
            <small>{scan ? "Current scan" : "Your private workspace"}</small>
          </div>
        </div>
        <button
          className="button primary sidebar-new"
          onClick={newScan}
          disabled={running || busy}
        >
          <Plus size={17} /> New scan
        </button>
        <p className="nav-label">Workspace</p>
        <nav aria-label="Workspace navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              className={
                (view === n.id ? "nav-item active" : "nav-item") +
                (view === "links" && n.id === "pages" ? " mobile-parent" : "")
              }
              onClick={() => choose(n.id)}
              aria-current={view === n.id ? "page" : undefined}
            >
              <n.icon size={18} />
              <span className="desktop-nav-label">{n.label}</span>
              <span className="mobile-nav-label">
                {n.id === "repairs"
                  ? "Plan"
                  : n.id === "ai"
                    ? "Research"
                    : n.label}
              </span>
              {n.id === "repairs" && repairs.length > 0 && (
                <span className="nav-count">{repairs.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
            Help & scan limits
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
            <Globe2 size={17} />
            <label className="site-switcher">
              <span className="sr-only">Open a saved scan</span>
              <select
                value={scan?.id || ""}
                onChange={(event) => {
                  if (!event.target.value) return;
                  void selectScan(event.target.value);
                }}
              >
                <option value="" disabled>
                  Choose a website
                </option>
                {scan && !history.some((item) => item.id === scan.id) && (
                  <option value={scan.id}>
                    {host(scan.url)} ·{" "}
                    {running ? "Scanning…" : `${pages.length} pages`}
                  </option>
                )}
                {history.map((item) => (
                  <option key={item.id} value={item.id}>
                    {host(item.url)} · {item.pages} pages ·{" "}
                    {new Date(item.startedAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="topbar-actions">
            <button
              className="button secondary compact new-scan-button"
              onClick={newScan}
              disabled={running || busy}
            >
              <Plus size={16} /> New scan
            </button>
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
        <main id="workspace-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {scan ? host(scan.url) : "YOUR WORKSPACE"}
              </div>
              <h1 ref={heading} tabIndex={-1}>
                {view === "overview"
                  ? scan
                    ? "Website overview"
                    : "A better website starts here."
                  : view === "issues"
                    ? "Findings"
                    : view === "pages"
                      ? "Pages"
                      : view === "links"
                        ? "Internal links"
                        : view === "ai"
                          ? "AI Research"
                          : "Repair plan"}
              </h1>
              <p>
                {view === "overview"
                  ? scan
                    ? "Your scan, the priorities, and what to do next."
                    : "Find what needs attention. Make your next change with confidence."
                  : view === "issues"
                    ? "Clear findings with a reason and a practical next step."
                    : view === "pages"
                      ? "The response HTML, metadata and links we actually read."
                      : view === "links"
                        ? "Candidates from shared words in existing page content. Always review the placement."
                        : view === "ai"
                          ? "Use your NVIDIA key to turn page evidence into keyword ideas, content plans and reviewable improvements."
                          : "Review your saved drafts, then export them when you’re ready."}
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
          {(view === "pages" || view === "links") && (
            <div className="page-segments" role="group" aria-label="Page views">
              <button
                aria-pressed={view === "pages"}
                onClick={() => choose("pages")}
              >
                Page inventory
              </button>
              <button
                aria-pressed={view === "links"}
                onClick={() => choose("links")}
              >
                Connections & links
              </button>
            </div>
          )}
          {error && scan && !composerOpen && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          {((view === "overview" && (!scan || composerOpen)) ||
            (!scan && view !== "ai")) && (
            <section className="scan-panel">
              <div className="scan-label">
                <span className="scan-icon">
                  <Search size={19} />
                </span>
                <div>
                  <h2>
                    {scan
                      ? "Start another scan"
                      : "Which website would you like to improve?"}
                  </h2>
                  <p>
                    Enter a public website. We’ll review its pages without
                    changing anything.
                  </p>
                </div>
                {scan && (
                  <button
                    className="icon-button"
                    aria-label="Close new scan"
                    onClick={() => setComposerOpen(false)}
                  >
                    <X size={18} />
                  </button>
                )}
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
                    ref={scanInput}
                    type="text"
                    inputMode="url"
                    placeholder="https://yourwebsite.com"
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
                  Explore a sample <ArrowUpRight size={13} />
                </button>
              </div>
            </section>
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
            <DeferredTool label="AI research">
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
            </DeferredTool>
          ) : !scan ? (
            <>
              <section className="empty-intro">
                <div className="section-heading">
                  <h2>From evidence to a better page.</h2>
                </div>
                <div className="steps">
                  {[
                    {
                      n: "01",
                      icon: FileSearch,
                      title: "Scan your website",
                      text: "Read the pages, metadata, headings and internal links your site serves.",
                    },
                    {
                      n: "02",
                      icon: SlidersHorizontal,
                      title: "Find your next improvement",
                      text: "Separate errors, review suggestions and intentional choices.",
                    },
                    {
                      n: "03",
                      icon: ListChecks,
                      title: "Review every change",
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
                select={(id) => void selectScan(id)}
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
                  {host(scan.url) === "sample.example" && (
                    <span className="ai-chip">
                      Sample audit · demonstration
                    </span>
                  )}
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
                  <section
                    className="next-step"
                    aria-labelledby="next-step-heading"
                  >
                    <div
                      className={
                        "next-step-symbol " + (high ? "attention" : "")
                      }
                    >
                      <FileSearch size={24} />
                    </div>
                    <div>
                      <span className="eyebrow">
                        {running ? "SCAN IN PROGRESS" : "START HERE"}
                      </span>
                      <h2 id="next-step-heading">
                        {running
                          ? "Your website is coming into focus."
                          : high
                            ? `${high} high-priority ${high === 1 ? "finding needs" : "findings need"} a closer look.`
                            : affected
                              ? `${affected} ${affected === 1 ? "page is" : "pages are"} ready for your review.`
                              : scan.status === "failed"
                                ? "Let’s get this scan back on track."
                                : "Explore the pages behind your results."}
                      </h2>
                      <p>
                        {running
                          ? "Pages are available as they’re read. You can keep exploring while the scan runs."
                          : high
                            ? "Start with response errors, missing titles and broken internal links."
                            : "Review the evidence, then save the changes that make sense for your site."}
                      </p>
                    </div>
                    <button
                      className="button primary"
                      disabled={running && !pages.length}
                      onClick={() => {
                        if (!pages.length) {
                          setUrl(scan.url);
                          newScan();
                          return;
                        }
                        choose(affected ? "issues" : "pages");
                        if (high) setSeverity("high");
                      }}
                    >
                      {!pages.length
                        ? running
                          ? "Reading your website…"
                          : "Try scan again"
                        : affected
                          ? "Review findings"
                          : "Explore pages"}
                      <ArrowRight size={16} />
                    </button>
                  </section>
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
                  <div className="overview-grid">
                    <section className="panel findings-summary">
                      <div className="section-heading">
                        <div>
                          <h2>What needs attention</h2>
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
                        <h2>Scan coverage</h2>
                        <CircleHelp size={18} />
                      </div>
                      <div className="coverage-icon">
                        <Globe2 size={38} />
                      </div>
                      <h3>What this scan includes</h3>
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
                  <section
                    className="panel scan-ai-actions"
                    aria-labelledby="scan-ai-heading"
                  >
                    <div className="section-heading">
                      <div>
                        <h2 id="scan-ai-heading">
                          <Sparkles size={19} /> Go further with AI
                        </h2>
                        <p>
                          Choose an analysis for{" "}
                          <strong>{host(scan.url)}</strong>. Uses this scan’s
                          page evidence and your NVIDIA connection.
                        </p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => openAi("keywords")}
                      >
                        All 9 research tools <ArrowRight size={14} />
                      </button>
                      <span className="ai-chip sr-only">
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
                      {AI_TOOLS.filter((tool) =>
                        ["keywords", "competitors", "optimize"].includes(
                          tool.id,
                        ),
                      ).map((tool) => (
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
                  {scan.notice.map((n, i) => (
                    <p className="notice" key={i}>
                      <CircleHelp size={14} />
                      {n}
                    </p>
                  ))}
                  <HistoryPanel
                    history={history.filter((h) => h.id !== scan.id)}
                    select={(id) => void selectScan(id)}
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
                    <span className="result-count" aria-live="polite">
                      {filtered.length} of {issues.length} findings
                    </span>
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
                <section className="panel page-inventory">
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
                    <span aria-live="polite">
                      {
                        pages.filter((p) =>
                          (p.url + " " + p.title)
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                        ).length
                      }{" "}
                      of {pages.length} pages
                    </span>
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
                  {!pages.some((p) =>
                    (p.url + " " + p.title)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  ) && (
                    <Empty text="No pages match your search. Try a different title or URL." />
                  )}
                </section>
              )}
              {view === "links" && (
                <>
                  <section className="panel connections-panel">
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
                      <h2>Saved drafts</h2>
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
                          onClick={() => {
                            setUndoRepair({ scanId: scan.id, repair: r });
                            setRepairs((prev) =>
                              prev.filter((x) => x.id !== r.id),
                            );
                            setToast("Draft removed from your plan.");
                          }}
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
          {view === "overview" && (
            <details
              className="data-disclosure"
              onToggle={(event) => setBackupOpen(event.currentTarget.open)}
            >
              <summary>
                <ArrowDownToLine size={15} /> Import & backup{" "}
                <ChevronRight size={14} />
              </summary>
              {backupOpen && (
                <DeferredTool label="backup tools">
                  <ScanBackup
                    scan={scan}
                    repairs={repairs}
                    imported={(value) => {
                      setScan(value);
                      choose("overview");
                      refreshHistory();
                      setToast(
                        "Scan imported into this browser. Review draft changes before export.",
                      );
                    }}
                  />
                </DeferredTool>
              )}
            </details>
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
          viewPlan={() => {
            setDetail(null);
            choose("repairs");
          }}
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
          {undoRepair && undoRepair.scanId === scan?.id && (
            <button
              onClick={() => {
                const repair = undoRepair.repair;
                setRepairs((prev) => [
                  ...prev.filter((r) => r.id !== repair.id),
                  repair,
                ]);
                setUndoRepair(null);
                setToast("Draft restored.");
              }}
            >
              Undo
            </button>
          )}
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
          <h2>Recent scans</h2>
          <span>Saved in this browser</span>
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
  viewPlan,
}: {
  page: Page;
  repairs: Repair[];
  save: (r: Repair) => void;
  close: () => void;
  findings: number;
  analyze: () => void;
  viewPlan: () => void;
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
  useEffect(() => {
    try {
      const draft = JSON.parse(
        localStorage.getItem("seo:editor:" + id) || "null",
      );
      setValue(
        draft?.original === original && typeof draft.value === "string"
          ? draft.value
          : existing?.value || original,
      );
    } catch {
      setValue(existing?.value || original);
    }
  }, [id]);
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
              onChange={(e) => {
                setValue(e.target.value);
                try {
                  localStorage.setItem(
                    "seo:editor:" + id,
                    JSON.stringify({ original, value: e.target.value }),
                  );
                } catch {
                  /* The editor remains usable when browser storage is full. */
                }
              }}
              placeholder="Write an accurate replacement…"
            />
          </label>
          <div className="editor-footer">
            <small>
              {value.length} characters · editing stays in this browser
            </small>
            <button
              className="button primary"
              disabled={
                !value.trim() ||
                value === original ||
                existing?.value === value.trim()
              }
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
          {existing?.value === value.trim() && (
            <div className="draft-saved">
              <Check size={15} /> Saved in your repair plan{" "}
              <button className="text-button" onClick={viewPlan}>
                View plan <ArrowRight size={14} />
              </button>
            </div>
          )}
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
