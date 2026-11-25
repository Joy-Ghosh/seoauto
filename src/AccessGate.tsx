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
        <h1>Your website research, protected.</h1>
        <p>
          Sign in to crawl public websites, review SEO evidence and work with
          your own AI connection.
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
          Scan history and research are saved in this browser. AI credentials
          use encrypted, HttpOnly session cookies.
        </small>
      </section>
    </main>
  );
}
