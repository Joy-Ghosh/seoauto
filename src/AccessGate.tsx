import React, { createContext, useContext, useEffect, useState } from "react";
import { KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { cancelAll, configureClient, http } from "./client";
export interface RuntimeStatus {
  mode: "local" | "hosted";
  authenticated: boolean;
  configured?: boolean;
}
const OwnerContext = createContext<{ logout: () => void }>({
  logout: () => {},
});
export function useOwnerSession() {
  return useContext(OwnerContext);
}
export default function AccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<RuntimeStatus | null>(null),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function check() {
    try {
      const response = await fetch("/api/system", { cache: "no-store" });
      if (
        response.status === 404 &&
        ["localhost", "127.0.0.1"].includes(location.hostname)
      ) {
        configureClient(false);
        setStatus({ mode: "local", authenticated: true });
        return;
      }
      if (!response.ok) throw new Error("Could not verify workspace access.");
      const result = await response.json();
      if (!["hosted", "local"].includes(result.mode))
        throw new Error("Invalid workspace response.");
      configureClient(result.mode === "hosted");
      setStatus(result);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void check();
  }, []);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await http("/api/login", { password });
      setPassword("");
      await check();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function logout() {
    cancelAll();
    void http("/api/logout", {})
      .then(() => location.reload())
      .catch((e) => setError(e.message));
  }
  if (status?.authenticated)
    return (
      <OwnerContext.Provider value={{ logout }}>
        {children}
        {error && (
          <div className="toast" role="alert">
            {error}
          </div>
        )}
      </OwnerContext.Provider>
    );
  return (
    <main className="access-shell">
      <section className="access-card">
        <span className="access-symbol">
          <ShieldCheck size={30} />
        </span>
        <p className="eyebrow">SEO WORKBENCH · PRIVATE WORKSPACE</p>
        <h1>Owner workspace</h1>
        <p>
          This hosted dashboard is currently private. Use the workspace password supplied by its owner, or start with the public tools below.
        </p>
        {!status && !error ? (
          <p role="status">
            <LoaderCircle className="spin" size={18} /> Checking workspace…
          </p>
        ) : status?.configured === false ? (
          <p className="error">
            Workspace access has not been configured. The owner must set the
            server access secrets before use.
          </p>
        ) : (
          <form onSubmit={(e) => void login(e)}>
            <label>
              Workspace password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={200}
                disabled={busy}
                autoFocus
              />
            </label>
            <button className="button primary" disabled={busy || !password}>
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <KeyRound size={17} />
              )}{" "}
              Sign in
            </button>
          </form>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <small>
          This password is separate from your NVIDIA API key. It is not a public account registration.
        </small>
        <a className="button secondary public-tools-link" href="/public.html">Use free tools without signing in</a>
        <details className="access-explanation"><summary>Why do I need a workspace password?</summary><p>It protects the owner's hosted crawler and AI endpoints from unrestricted use. Scan history stays in the browser; this is a single-owner workspace, not separate customer accounts.</p><p>For a full audit without using the owner's compute, run the open-source app locally. Public PageSpeed and Lighthouse tools are available without this password.</p><a href="https://github.com/Joy-Ghosh/seoauto" target="_blank" rel="noreferrer">Get the open-source workbench</a></details>
      </section>
    </main>
  );
}
