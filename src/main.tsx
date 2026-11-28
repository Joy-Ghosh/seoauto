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
  Code2,
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
import type { Issue, Page, Repair, Scan } from "./types";
import { connections } from "./topology";
import { pollScan } from "./poll-scan";
import DeferredTool from "./DeferredTool";
import { AI_TOOLS } from "./ai-types";
import type { AiTask } from "./ai-types";
import { api, hosted } from "./client";
import AccessGate, { useOwnerSession } from "./AccessGate";
import { exportScan, exportCsv } from "./exports";
import "./workspace.css";
import "./studio-shell.css";
import WebsiteTechnology from "./WebsiteTechnology";
import SavedWebsites from "./SavedWebsites";
import SiteFavicon from "./SiteFavicon";
import BrandMark from "./BrandMark";
import PlanPanel from "./PlanPanel";
import { readRepairPlan, savePlanDraft } from "./repair-plan";
import { emptyContext, readContexts, readWorkspaceRoute, type ViewContext } from "./workspace-context";
import { editableField } from "./page-evidence";
import "./phase-one.css";
import PipNote, { Pip } from "./Pip";
import { nextTask } from "./next-task";
import "./first-use.css";
const AiStudio = lazy(() => import("./AiStudio"));
const ScanBackup = lazy(() => import("./ScanBackup"));
const SearchConsolePanel = lazy(() => import("./SearchConsolePanel"));
const ResultsPanel = lazy(() => import("./ResultsPanel"));
const BatchTitles = lazy(() => import("./BatchTitles"));
const PageSpeedPanel = lazy(() => import("./PageSpeedPanel"));
const PageEvidence = lazy(() => import("./PageEvidence"));
const LinkOpportunities = lazy(() => import("./LinkOpportunities"));
const TechnologyPanel = lazy(() => import("./TechnologyPanel"));
type View = "overview" | "issues" | "pages" | "links" | "repairs" | "ai" | "search" | "verify" | "titles" | "speed";
const views: View[] = ["overview", "issues", "pages", "links", "repairs", "ai", "search", "verify", "titles", "speed"];
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
  { id: "issues", label: "Opportunities", icon: FileSearch },
  { id: "repairs", label: "Plan", icon: ListChecks },
  { id: "verify", label: "Results", icon: CheckCheck },
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
  const crawlCap = hosted ? 200 : 1000;
  const owner = useOwnerSession();
  const [composerOpen, setComposerOpen] = useState(false);
  const [repairsScanId, setRepairsScanId] = useState("");
  const [backupOpen, setBackupOpen] = useState(false);
  const [manageWebsites, setManageWebsites] = useState(false);
  const [detailIssueId, setDetailIssueId] = useState<string>();
  const [linkEvidenceUrl, setLinkEvidenceUrl] = useState<string>();
  const [detailTrail, setDetailTrail] = useState<Page[]>([]);
  const scanInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
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
        views.find(item => item === readWorkspaceRoute(location.hash).view) || "overview",
    ),
    [scan, setScan] = useState<Scan | null>(null),
    [history, setHistory] = useState<History[]>([]),
    [url, setUrl] = useState(""),
    [limit, setLimit] = useState(40),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [detail, setDetail] = useState<Page | null>(null),
    [repairs, setRepairs] = useState<Repair[]>([]),
    [help, setHelp] = useState(false),
    [toast, setToast] = useState("");
  const [contexts, setContexts] = useState<Record<string, ViewContext>>(() => { try { return readContexts(sessionStorage.getItem("seo:view-contexts")); } catch { return {}; } });
  const contextKey = (scan?.id || "none") + ":" + view;
  const contextKeyRef = useRef(contextKey); contextKeyRef.current = contextKey;
  const scrollPositions = useRef(new Map<string, number>());
  const routeLoading = useRef("");
  const currentContext = contexts[contextKey] || emptyContext;
  const { query, severity, problemType } = currentContext;
  const updateContext = (patch: Partial<ViewContext>) => setContexts(previous => Object.fromEntries(Object.entries({ ...previous, [contextKey]: { ...(previous[contextKey] || emptyContext), ...patch } }).slice(-30)));
  const setQuery = (query: string) => updateContext({ query });
  const setFindingFilter = (patch: Partial<ViewContext>) => setContexts(previous => ({ ...previous, [(scan?.id || "none") + ":issues"]: { ...(previous[(scan?.id || "none") + ":issues"] || emptyContext), ...patch } }));
  const setSeverity = (severity: string) => updateContext({ severity });
  const setProblemType = (problemType: string) => updateContext({ problemType });
  const [routeFinding, setRouteFinding] = useState(() => readWorkspaceRoute(location.hash).finding);
  useEffect(() => { try { sessionStorage.setItem("seo:view-contexts", JSON.stringify(contexts)); } catch {} }, [contexts]);
  useEffect(() => { const key = contextKey; const frame = requestAnimationFrame(() => { if (contextKeyRef.current === key) window.scrollTo({ top: scrollPositions.current.get(key) || 0, behavior: "auto" }); }); return () => cancelAnimationFrame(frame); }, [contextKey]);
  const selectedScanId = useRef<string | null>(null);
  selectedScanId.current = scan?.id || null;
  const refreshHistory = () =>
    api<History[]>("/api/scans")
      .then(setHistory)
      .catch(() => {});
  useEffect(() => {
    refreshHistory();
    const previous = readWorkspaceRoute(location.hash).scan || sessionStorage.getItem("seo:last-scan");
    const request = selection.current;
    if (previous)
      void api<Scan>("/api/scans/" + encodeURIComponent(previous))
        .then((value) => {
          if (request === selection.current) setScan(value);
        })
        .catch(() => {
          if (request === selection.current) {
            sessionStorage.removeItem("seo:last-scan");
            if (readWorkspaceRoute(location.hash).scan) setError("The linked scan is unavailable. It may be in Trash or absent from this workspace. Open an available saved scan.");
          }
        });
  }, []);
  useEffect(() => {
    const restoreView = () => {
      const route = readWorkspaceRoute(location.hash);
      const next = views.find(item => item === route.view);
      if (next) {
        scrollPositions.current.set(contextKeyRef.current, window.scrollY);
        setRouteFinding(route.finding);
        setView(next);
        setDetail(null);
        if (route.scan && route.scan !== selectedScanId.current && routeLoading.current !== route.scan) {
          routeLoading.current = route.scan;
          const request = ++selection.current;
          void api<Scan>("/api/scans/" + encodeURIComponent(route.scan)).then(value => {
            if (request === selection.current) { setError(""); setScan(value); }
          }).catch(() => { if (request === selection.current) setError("The linked scan is unavailable. Open an available saved scan."); }).finally(() => { if (routeLoading.current === route.scan) routeLoading.current = ""; });
        }
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
        readRepairPlan(localStorage.getItem("repairs:" + scan.id)),
      );
    } catch {
      setRepairs([]);
      setError("This saved plan could not be read. Keep a browser backup before changing stored data.");
      setRepairsScanId("");
      return;
    }
    setRepairsScanId(scan.id);
  }, [scan?.id]);
  useEffect(() => {
    if (scan && repairsScanId === scan.id) {
      try { localStorage.setItem("repairs:" + scan.id, JSON.stringify(repairs)); setError(current => current === "Your draft changes could not be saved to browser storage. Export the plan before closing this page." ? "" : current); }
      catch { setError("Your draft changes could not be saved to browser storage. Export the plan before closing this page."); }
    }
  }, [repairs, repairsScanId, scan?.id]);
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
        if (readWorkspaceRoute(location.hash).finding) window.history.replaceState(null, "", "#" + readWorkspaceRoute(location.hash).view);
        setRouteFinding("");
        setDetail(null);
        setHelp(false);
        setManageWebsites(false);
      }
    };
    const rememberFocus = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target !== document.body && !target.closest('[role="dialog"], [role="alertdialog"]')) returnFocus.current = target;
    };
    window.addEventListener("keydown", close);
    document.addEventListener("focusin", rememberFocus);
    return () => { window.removeEventListener("keydown", close); document.removeEventListener("focusin", rememberFocus); };
  }, []);
  useEffect(() => {
    if (!detail && !help && !manageWebsites) return;
    const previous = returnFocus.current;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const dialog = document.querySelector('[role="alertdialog"], [role="dialog"]');
      const items = [...(dialog?.querySelectorAll<HTMLElement>(
        "button:not([disabled]),a[href],select:not([disabled]),input:not([disabled]),textarea:not([disabled]),summary",
      ) || [])].filter(item => item.getClientRects().length > 0);
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
      if (previous?.isConnected) previous.focus({ preventScroll: true });
      else heading.current?.focus({ preventScroll: true });
    };
  }, [Boolean(detail), help, manageWebsites]);
  const start = async (sample = false, retry?: { url: string; limit: number }) => {
    const request = ++selection.current;
    setBusy(true);
    setError("");
    try {
      const requestedUrl = retry?.url ?? url;
      const requestedLimit = retry?.limit ?? limit;
      const target = sample
        ? window.location.origin + "/fixture/"
        : requestedUrl.trim().match(/^https?:\/\//)
          ? requestedUrl.trim()
          : "https://" + requestedUrl.trim();
      const data = await api<{ id: string }>("/api/scans", {
        url: target,
        limit: requestedLimit,
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
      (problemType === "all" || i.type === problemType) &&
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
    const tools = document.querySelector<HTMLDetailsElement>(".studio-menu");
    if (tools) tools.open = false;
    if (v !== "ai") setAiLaunch(null);
    if (location.hash !== "#" + v) window.history.pushState(null, "", "#" + v);
    scrollPositions.current.set(contextKeyRef.current, window.scrollY);
    setRouteFinding("");
    setView(v);
    setDetail(null);
    requestAnimationFrame(() =>
      heading.current?.focus({ preventScroll: true }),
    );
  };
  const reviewIssue = (issue: Issue) => {
    setDetailTrail([]);
    setDetailIssueId(issue.id);
    const hash = "#" + view + "?finding=" + encodeURIComponent(issue.id) + "&scan=" + encodeURIComponent(scan!.id);
    if (location.hash !== hash) window.history.pushState(null, "", hash);
    setRouteFinding(issue.id);
    setDetail(pages.find(page => page.url === issue.url) || null);
  };
  useEffect(() => {
    if (!routeFinding || !scan || scan.status === "running") return;
    if (readWorkspaceRoute(location.hash).scan && readWorkspaceRoute(location.hash).scan !== scan.id) return;
    const issue = scan.issues.find(item => item.id === routeFinding);
    const page = issue && scan.pages.find(item => item.url === issue.url);
    if (page && issue) { setError(current => current.startsWith("This finding is not available") ? "" : current); setDetailIssueId(issue.id); setDetail(page); }
    else { setDetail(null); setError("This finding is not available in the open scan. Choose the original scan or review the available findings."); }
  }, [routeFinding, scan?.id, scan?.status]);
  const closePage = () => { setDetail(null); setDetailTrail([]); setLinkEvidenceUrl(undefined); setRouteFinding(""); if (readWorkspaceRoute(location.hash).finding) window.history.replaceState(null, "", "#" + view); };
  const selectScan = async (id: string) => {
    const request = ++selection.current;
    setError("");
    try {
      const value = await api<Scan>("/api/scans/" + id);
      if (request !== selection.current) return false;
      setScan(value);
      choose("overview");
      setComposerOpen(false);
      return true;
    } catch (error) {
      if (request === selection.current) setError((error as Error).message);
      return false;
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
    if (!scan || repairsScanId !== scan.id) { setError("This plan is not ready. Reopen the baseline scan before saving."); return false; }
    try {
      const saved = savePlanDraft(repairs.find(r => r.id === repair.id), repair, scan);
      setRepairs(prev => [...prev.filter(r => r.id !== repair.id), saved]);
      setToast("Draft saved to your plan. Your website has not changed.");
      return true;
    } catch (error) { setError((error as Error).message); return false; }
  };
  const recheckPage = async (target: string, repair?: Repair) => {
    if (!scan || running || busy) return;
    setBusy(true); setError("");
    const baseline = scan.id;
    try {
      const result = await api<{ id: string }>("/api/scans", { url: target, limit: 1 });
      try { localStorage.setItem("seo:verify-request:" + result.id, JSON.stringify({ baseline, url: target, ...(repair ? { drafts: [{ id: repair.id, revision: repair.workflow?.revision || 1, value: repair.value }] } : {}) })); } catch { setToast("Re-scan started. Choose the baseline manually in Verify changes if browser storage is full."); }
      ++selection.current;
      setDetail(null); setDetailTrail([]); setComposerOpen(false); setScan(await api<Scan>("/api/scans/" + result.id)); choose("verify"); refreshHistory();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
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
          aria-label="SEO Workbench home"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            choose("overview");
          }}
        >
          <span className="brand-symbol">
            <BrandMark size={34} />
          </span>
          <span>
            SEO Workbench
            <small>Website intelligence</small>
          </span>
        </a>
        <div className="workspace">
          <span className="site-icon">
            <SiteFavicon url={scan?.url} icon={scan?.pages.find(page => page.url === scan.url || page.finalUrl === scan.url)?.favicon} />
          </span>
          <div>
            <strong>{scan ? host(scan.url) : "Your next website"}</strong>
            <small>{scan ? "Current scan" : "Your private workspace"}</small>
          </div>
        </div>
        <button
          className="button primary sidebar-new"
          aria-label="New scan"
          title="New scan"
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
              aria-label={n.id === "issues" ? "Review opportunities" : n.label}
              title={n.label}
              className={
                (view === n.id || (["pages", "links", "search", "titles", "speed"].includes(view) && n.id === "issues") ? "nav-item active" : "nav-item")
              }
              onClick={() => choose(n.id)}
              aria-current={view === n.id || (["pages", "links", "search", "titles", "speed"].includes(view) && n.id === "issues") ? "page" : undefined}
            >
              <n.icon size={18} />
              <span className="desktop-nav-label">{n.label}</span>
              <span className="mobile-nav-label">
                {n.id === "repairs"
                  ? "Plan"
                  : n.id === "issues" ? "Review"
                    : n.label}
              </span>
              {n.id === "repairs" && repairs.length > 0 && (
                <span className="nav-count">{repairs.length}</span>
              )}
            </button>
          ))}
        </nav>
        <details className="sidebar-bottom studio-menu">
          <summary aria-label="Workspace tools"><SlidersHorizontal size={17} aria-hidden="true" /><span>Tools</span></summary>
          <button className="nav-item" onClick={() => choose("ai")}><Sparkles size={18} /> AI tools</button>
          <button className="nav-item" onClick={() => choose("search")}><Search size={18} /> Search data</button>
          <button className="nav-item" onClick={() => choose("speed")}><SlidersHorizontal size={18} /> Page speed</button>
          <button className="nav-item" onClick={() => choose("titles")}><Files size={18} /> Batch title drafts</button>
          <a className="nav-item" href="/project-guide.html" target="_blank" rel="noreferrer"><GitBranch size={18} /> Project map & guide</a>
          <button className="nav-item" onClick={() => setManageWebsites(true)}><Files size={18} aria-hidden="true" /> Saved websites</button>
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
        </details>
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
                    {running ? "Scanning…" : `${pages.length} ${pages.length === 1 ? "page" : "pages"}`}
                  </option>
                )}
                {history.map((item) => (
                  <option key={item.id} value={item.id}>
                    {host(item.url)} · {item.pages} {item.pages === 1 ? "page" : "pages"} ·{" "}
                    {new Date(item.startedAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="topbar-actions">
            <button className="button secondary compact manage-websites-button" onClick={() => setManageWebsites(true)}><Files size={16} aria-hidden="true" /><span>Saved websites</span></button>
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
                    : "Turn findings into finished fixes."
                  : view === "issues"
                    ? "Opportunities"
                    : view === "pages"
                      ? "Pages"
                      : view === "links"
                        ? "Internal links"
                        : view === "ai"
                          ? "AI tools for this website"
                          : view === "speed" ? "Page speed" : view === "search" ? "Search performance" : view === "verify" ? "Results" : view === "titles" ? "Title suggestions by category" : "Your change plan"}
              </h1>
              <p>
                {view === "overview"
                  ? scan
                    ? "Start with one useful change. Keep the evidence with the work."
                    : "Read your public pages, prepare an exact edit, then check the published response. No AI key is needed to start."
                  : view === "issues"
                    ? "Clear findings with a reason and a practical next step."
                    : view === "pages"
                      ? "The response HTML, metadata and links we actually read."
                      : view === "links"
                        ? "Candidates from shared words in existing page content. Always review the placement."
                        : view === "ai"
                          ? "Use your NVIDIA key to turn page evidence into keyword ideas, content plans and reviewable improvements."
                          : view === "speed" ? "Run a Google speed test or import a free Lighthouse report from your computer." : view === "search" ? "Optional Search Console data: import a CSV, connect Google, or skip it." : view === "verify" ? "Find saved checks, compare expected and observed values, and continue unfinished work." : view === "titles" ? "Select pages, generate evidence-based title drafts, and save the suggestions you approve." : "Review the exact edit, apply it in your website editor, then check the response."}
              </p>
            </div>
            {scan && scan.status !== "running" && view !== "repairs" && (
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
          {scan && !composerOpen && !["repairs", "verify"].includes(view) && <details className="studio-technology"><summary><Code2 size={16} aria-hidden="true" /> Website technology & inspection evidence <ChevronRight size={15} aria-hidden="true" /></summary><WebsiteTechnology key={scan.id} scan={scan} /></details>}
          {(["issues", "pages", "links"].includes(view)) && (
            <div className="page-segments" role="group" aria-label="Page views">
              <button aria-pressed={view === "issues"} onClick={() => choose("issues")}>Findings</button>
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
                    {[1, 10, 40, 100, 200].map((n) => (
                      <option key={n} value={n}>{n} {n === 1 ? "page" : "pages"}</option>
                    ))}
                    {!hosted && <option value={1000}>Whole site · up to 1,000</option>}
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
              <p className="scan-scope-note">{hosted ? "Hosted scans read up to 200 pages within a time limit." : "Start with a sample of pages. Larger scans read up to 1,000 discovered HTML pages."} We do not run the website’s JavaScript.</p>
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
              <Pip mood="reading" size={52} />
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
                viewLinks={() => choose("links")}
                inspectLinks={(page) => { setDetailTrail([]); setDetailIssueId(undefined); setLinkEvidenceUrl(page.url); setDetail(page); }}
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
              <PipNote title="I’m Pip. Let’s make one useful change."><ol><li>Scan a website and inspect a finding.</li><li>Save an exact draft and apply it in your editor.</li><li>Return to check the page response. Saving a draft does not publish it.</li></ol></PipNote>
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
                  <span className="scan-counts">{pages.length} {pages.length === 1 ? "page" : "pages"} read · {scan.issues.length} findings</span>
                  {host(scan.url) === "sample.example" && (
                    <span className="ai-chip">
                      Sample audit · demonstration
                    </span>
                  )}
                  <time>{new Date(scan.startedAt).toLocaleString()}</time>
                  <button className="text-button scan-context-action" disabled={busy} onClick={() => void start(false, { url: scan.url, limit: crawlCap })}>
                    <Search size={14} aria-hidden="true" /> Re-scan whole website
                  </button>
                </div>
              )}
              {scan.error && (
                <div className="error-box" role="alert">
                  <strong>Scan could not finish</strong>
                  <p>{scan.error}</p>
                  <div className="error-actions">
                    <button className="button secondary" disabled={busy || running} onClick={() => void start(false, { url: scan.url, limit: Math.min(scan.limit, crawlCap) })}>
                      <Search size={15} aria-hidden="true" /> Retry same scan
                    </button>
                    <button className="button secondary" disabled={busy || running} onClick={() => void start(false, { url: scan.url, limit: crawlCap })}>
                      <Search size={15} aria-hidden="true" /> Re-scan whole website
                    </button>
                  </div>
                </div>
              )}
              {view === "overview" && (
                <>

                  {!running && pages.length > 0 && (() => { const task = nextTask(scan, repairs); return <section className="next-step concrete-task" aria-labelledby="next-step-heading"><Pip mood="ready" size={64} /><div><span className="eyebrow">YOUR NEXT STEP · BASED ON THIS SCAN</span><h2 id="next-step-heading">{task.title}</h2><small className="task-page">Page: {short(task.pageUrl)}</small><p>{task.detail}</p></div><button className="button primary" onClick={() => { if (task.kind === "finding") { const issue = scan.issues.find(item => item.id === task.issueId); if (issue) reviewIssue(issue); } else choose(task.kind === "plan" ? "repairs" : "pages"); }}>{task.action}<ArrowRight size={16} aria-hidden="true" /></button></section>; })()}

                  <section className="seo-workboard" aria-label="Website improvement workboard">
                    <div className="workboard-main">
                      <h2 className="sr-only">Facts from this scan</h2>
                      <div className="workboard-stats" aria-label="Current scan facts">
                        <button onClick={() => choose("pages")}><Files size={18} aria-hidden="true" /><strong>{pages.length}</strong><span>Pages read</span></button>
                        <button onClick={() => choose("issues")}><FileSearch size={18} aria-hidden="true" /><strong>{affected}</strong><span>Pages with findings</span></button>
                        <button onClick={() => choose("repairs")}><ListChecks size={18} aria-hidden="true" /><strong>{repairs.length}</strong><span>Drafts in this scan</span></button>
                      </div>
                    </div>
                  </section>
                  <details className="audit-details"><summary>Scan statistics & coverage · {pages.length} {pages.length === 1 ? "page" : "pages"} read · {high} high-priority findings</summary>
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
                              setFindingFilter({ query: "", problemType: g.type, severity: "all" });
                              choose("issues");
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
                  </details>
                  <details className="optional-research"><summary>Optional research: AI, keywords and competitors</summary>
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
                  </details>
                  {scan.notice.map((n, i) => (
                    <p className="notice" key={i}>
                      <CircleHelp size={14} />
                      {n}
                    </p>
                  ))}
                  <details className="audit-details"><summary>Other saved scans</summary><HistoryPanel
                    history={history.filter((h) => h.id !== scan.id)}
                    select={(id) => void selectScan(id)}
                  /></details>
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
                    <select aria-label="Filter by problem type" value={problemType} onChange={event => setProblemType(event.target.value)}><option value="all">All problem types</option>{groups.map(group => <option value={group.type} key={group.type}>{group.label} ({group.count})</option>)}</select>
                    {(query || severity !== "all" || problemType !== "all") && <button className="button secondary" onClick={() => { setQuery(""); setSeverity("all"); setProblemType("all"); }}>Clear filters</button>}
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
                            onClick={() => reviewIssue(i)}
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
                          onClick={() => reviewIssue(i)}
                        >
                          Review problem
                          <ChevronRight size={14} />
                        </button>
                      </article>
                    ))}
                    {!filtered.length && (
                      <Empty text={issues.length ? "No findings match these filters. Clear filters to see all problems." : "No findings were reported in this scanned subset. Add PageSpeed or review page coverage for checks beyond HTML."} />
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
                    <DeferredTool label="Internal link opportunities"><LinkOpportunities key={scan.id} scan={scan} inspect={page => { setDetailIssueId(undefined); setDetailTrail([]); setLinkEvidenceUrl(page.url); setDetail(page); }} /></DeferredTool>
                  </section>
                </>
              )}
              {view === "search" && <DeferredTool label="Search Console"><SearchConsolePanel key={scan.id} scan={scan} inspect={setDetail} /></DeferredTool>}
              {view === "speed" && <DeferredTool label="Page speed"><PageSpeedPanel key={scan.id} scan={scan} /></DeferredTool>}
              {view === "verify" && <DeferredTool label="Change verification"><ResultsPanel key={scan.id} scan={scan} repairs={repairs} inspect={setDetail} openPlan={async id => { if (await selectScan(id)) choose("repairs"); }} /></DeferredTool>}
              {view === "titles" && <DeferredTool label="Title suggestions"><BatchTitles key={scan.id} scan={scan} repairs={repairs} save={addRepair} setup={() => openAi("optimize")} plan={() => choose("repairs")} /></DeferredTool>}
              {view === "repairs" && (
                <section className="panel">
                  <PlanPanel key={scan.id} scan={scan} repairs={repairs} busy={busy || running} inspect={setDetail} revise={addRepair}
                    change={repair => setRepairs(prev => prev.map(item => item.id === repair.id ? repair : item))}
                    remove={repair => { setUndoRepair({ scanId: scan.id, repair }); setRepairs(prev => prev.filter(item => item.id !== repair.id)); setToast("Draft removed from your plan."); }}
                    verify={repair => void recheckPage(repair.url, repair)} exportPlan={exportPlan} choosePage={() => choose("issues")} />
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
                        not publish anything. Empty-alt drafts need manual application; the companion rejects empty replacements.
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
            <a className="guide-link" href="/project-guide.html" target="_blank" rel="noreferrer">Project map & guide</a>
            <button className="text-button" onClick={() => setHelp(true)}>
              About the checks <ArrowUpRight size={13} />
            </button>
          </footer>
        </main>

      </div>
      {detail && (
        <PageDrawer
          key={scan!.id + detail.url + (detailIssueId || "") + (linkEvidenceUrl || "")}
          page={detail}
          scan={scan!}
          initialIssueId={detailIssueId}
          initialEvidenceTab={linkEvidenceUrl === detail.url ? "links" : "issues"}
          inspect={(page) => { setDetailTrail(previous => [...previous, detail]); setDetailIssueId(undefined); setDetail(page); }}
          back={detailTrail.length ? () => { setDetail(detailTrail[detailTrail.length - 1]); setDetailTrail(previous => previous.slice(0, -1)); setDetailIssueId(undefined); } : undefined}
          repairs={repairs}
          save={addRepair}
          close={closePage}
          analyze={() => openAi("optimize", detail.url)}
          rescan={() => void recheckPage(detail.url)}
          viewPlan={() => {
            setDetail(null);
            choose("repairs");
          }}
        />
      )}{" "}
      {manageWebsites && <SavedWebsites close={() => setManageWebsites(false)} select={id => { setManageWebsites(false); void selectScan(id); }} changed={(id, trashed) => {
        refreshHistory();
        if (trashed && selectedScanId.current === id) { ++selection.current; setDetail(null); setDetailTrail([]); setUndoRepair(null); setAiLaunch(null); setScan(null); setRepairs([]); sessionStorage.removeItem("seo:last-scan"); choose("overview"); }
      }} />}
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
          {toast.startsWith("Draft saved") && !error ? <Pip mood="saved" size={32} /> : <Check size={16} />}
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
          <span>{hosted ? "Saved in this browser" : "Scans saved on this computer"}</span>
        </div>
        {history.slice(0, 6).map((h) => (
          <button key={h.id} onClick={() => select(h.id)}>
            <Globe2 size={18} />
            <strong>{host(h.url)}</strong>
            <span>{h.pages} {h.pages === 1 ? "page" : "pages"}</span>
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
  scan,
  initialIssueId,
  initialEvidenceTab,
  inspect,
  back,
  repairs,
  save,
  close,
  analyze,
  rescan,
  viewPlan,
}: {
  page: Page;
  scan: Scan;
  initialIssueId?: string;
  initialEvidenceTab?: "issues" | "links";
  inspect: (page: Page) => void;
  back?: () => void;
  repairs: Repair[];
  save: (r: Repair) => void;
  close: () => void;
  analyze: () => void;
  rescan: () => void;
  viewPlan: () => void;
}) {
  const [field, setField] = useState<Repair["field"]>(() => { const issue = scan.issues.find(item => item.id === initialIssueId); return issue?.type.includes("description") ? "meta_description" : issue?.type.includes("alt") ? "alt_text" : "title"; }),
    [image, setImage] = useState(() => Math.max(0, page.images.findIndex(image => image.alt === null))),
    [value, setValue] = useState("");
  const [editorError, setEditorError] = useState("");
  const [decorative, setDecorative] = useState(false);
  useEffect(() => setDecorative(false), [field, image]);
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
  const focusedIssue = scan.issues.find(issue => issue.id === initialIssueId);
  const focusedEditable = !!focusedIssue && !!editableField(focusedIssue);
  const draftEditor = page.status >= 200 && page.status < 300 && !page.error ? <section className="draft-editor">
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
              id="page-draft-value"
              rows={4}
              maxLength={20000}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                try {
                  localStorage.setItem(
                    "seo:editor:" + id,
                    JSON.stringify({ original, value: e.target.value }),
                  );
                } catch {
                  setEditorError("This edit is only in memory because browser storage is unavailable. Copy it before leaving.");
                }
              }}
              placeholder="Write an accurate replacement…"
            />
          </label>
          {field === "alt_text" && <label className="ai-consent"><input type="checkbox" checked={decorative} onChange={event => { setDecorative(event.target.checked); if (event.target.checked) setValue(""); }} /><span>I visually checked that this image is decorative. Save an empty alt attribute.</span></label>}
          {editorError && <p className="error-box" role="alert">{editorError}</p>}
          <p className="evidence-hint">Observed baseline: {original || "Empty or missing"}. Check the wording against this page’s content before approving it in your plan.</p>
          <div className="editor-footer">
            <small>
              {value.length} characters · editing stays in this browser
            </small>
            <button
              className="button primary"
              disabled={
                (!value.trim() && !(field === "alt_text" && decorative)) ||
                (value === original && !(field === "alt_text" && decorative && page.images[image]?.alt === null)) ||
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
            Saving creates a browser-local draft. Review it in your plan, then apply it in your website editor.
          </p>
        </section> : <p className="notice">Restore this page’s response in your website or hosting settings before drafting metadata. Use the problem instructions and incoming links above to plan the fix.</p>;
  const pageEvidence = (<DeferredTool label="Page evidence"><PageEvidence page={page} scan={scan} initialIssueId={initialIssueId} initialTab={initialEvidenceTab} inspect={inspect} save={save} setup={analyze} draft={(next) => {
          setField(next);
          if (next === "alt_text") setImage(Math.max(0, page.images.findIndex(image => image.alt === null)));
          requestAnimationFrame(() => { const editor = document.getElementById("page-draft-value"); editor?.scrollIntoView({ block: "center" }); editor?.focus({ preventScroll: true }); });
        }} /></DeferredTool>);
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
        {back && <button className="text-button page-review-back" onClick={back}>← Back to previous page</button>}
        <h2 id="page-title">{page.title || "Untitled page"}</h2>
        {!focusedEditable && <button
          className="button secondary page-ai-button"
          disabled={page.status < 200 || page.status >= 300 || !!page.error}
          onClick={analyze}
        >
          <Sparkles size={16} /> Improve this page with AI
        </button>}
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
          <span>{scan.issues.filter(issue => issue.url === page.url).length} findings</span>
        </div>
        {focusedIssue && <section className="focused-observation" aria-labelledby="focused-finding-title"><span className="eyebrow">SELECTED FINDING · RESPONSE HTML</span><h3 id="focused-finding-title">{focusedIssue.label}</h3><p>{focusedIssue.detail}</p><p>{focusedIssue.action}</p><p className="evidence-hint">Observed {new Date(scan.startedAt).toLocaleString()}. {focusedIssue.type.includes("length") || focusedIssue.type.includes("multiple") ? "This is an editorial review signal, not a ranking rule." : "Review page purpose before changing it."}</p></section>}
        {focusedEditable && draftEditor}
        {focusedEditable ? <details className="focused-more"><summary>Inspect page content, links and other findings</summary>{pageEvidence}</details> : pageEvidence}
        <details className="metadata-details"><summary>Page metadata, technology & response evidence</summary>
        <button className="button secondary" onClick={rescan}><Search size={16} />Re-scan this page & verify</button>
        <DeferredTool label="Technology signals"><TechnologyPanel page={page} /></DeferredTool>
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
        </details>
        {!focusedEditable && draftEditor}

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
