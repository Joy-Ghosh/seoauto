import { createHash, randomBytes } from "node:crypto";
import { cookie, seal, setCookie, unseal, securityHeaders, type AuthConfig } from "./hosted-auth.js";
import { validSearchDate } from "../src/search-data.js";
const scope = "https://www.googleapis.com/auth/webmasters.readonly";
type Credentials = { clientId: string; clientSecret: string };
type GoogleSession = { token: string; owner: string; expires: number };
type OAuthState = { nonce: string; verifier: string; owner: string; redirect: string; expires: number };
export function createSearchConsoleApi(config: AuthConfig, fetcher: typeof fetch = fetch, credentials: Credentials = { clientId: process.env.GOOGLE_CLIENT_ID || "", clientSecret: process.env.GOOGLE_CLIENT_SECRET || "" }) {
  const configured = Boolean(credentials.clientId && credentials.clientSecret && config.secret.length >= 40);
  const json = (value: unknown, status = 200, cookies: string[] = []) => { const headers = new Headers({ ...securityHeaders(), "Content-Type": "application/json" }); cookies.forEach(value => headers.append("Set-Cookie", value)); return new Response(JSON.stringify(value), { status, headers }); };
  const redirect = (path: string, cookies: string[]) => { const headers = new Headers({ ...securityHeaders(), Location: path }); cookies.forEach(value => headers.append("Set-Cookie", value)); return new Response(null, { status: 303, headers }); };
  const google = async (url: string, init: RequestInit = {}) => {
    const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(15000), redirect: "error" });
    if (!response.ok) { await response.body?.cancel(); throw new Error(response.status === 403 ? "Google denied access. Check the property permission, enabled Search Console API and quota." : response.status === 401 ? "Google access expired. Reconnect your account." : `Google returned HTTP ${response.status}. Retry or use CSV import.`); }
    return response.json();
  };
  return async (request: Request, route: string, owner?: string): Promise<Response> => {
    try {
      const url = new URL(request.url);
      if (route.endsWith("/callback") && request.method === "GET") {
        if (!configured) return json({ error: "Google OAuth is not configured. CSV import remains available." }, 503);
        const state = unseal<OAuthState>(cookie(request, "gsc-state", config), config, "gsc-state");
        if (!state || state.expires < Date.now() || !state.owner || !state.verifier || !state.redirect || state.nonce !== url.searchParams.get("state")) return json({ error: "Google connection state expired or did not match. Start the connection again." }, 400);
        if (new URL(state.redirect).origin !== url.origin) return json({ error: "Google callback origin did not match." }, 400);
        if (url.searchParams.has("error")) return redirect("/#search", [setCookie("gsc-state", "", config, 0)]);
        const code = url.searchParams.get("code"); if (!code || code.length > 4096) return json({ error: "Google did not provide a valid authorization code." }, 400);
        const token = await google("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: credentials.clientId, client_secret: credentials.clientSecret, redirect_uri: state.redirect, grant_type: "authorization_code", code_verifier: state.verifier }) });
        if (typeof token.access_token !== "string" || token.access_token.length > 3000 || !String(token.scope || "").split(" ").includes(scope)) throw new Error("Google did not grant read-only Search Console access.");
        const age = Math.max(1, Math.min(3600, Number(token.expires_in) || 3600));
        return redirect("/#search", [setCookie("gsc", seal({ token: token.access_token, owner: state.owner, expires: Date.now() + age * 1000 }, config, "gsc"), config, age), setCookie("gsc-state", "", config, 0)]);
      }
      if (!owner) return json({ error: "Sign in to your workspace." }, 401);
      const session = unseal<GoogleSession>(cookie(request, "gsc", config), config, "gsc");
      const connected = Boolean(session && session.owner === owner && session.expires > Date.now());
      if (route.endsWith("/status") && request.method === "GET") return json({ configured, connected, callbackUrl: new URL("/api/search-console/callback", url.origin).href });
      if (route.endsWith("/disconnect") && request.method === "POST") return json({ ok: true }, 200, [setCookie("gsc", "", config, 0), setCookie("gsc-state", "", config, 0)]);
      if (route.endsWith("/connect") && request.method === "GET") {
        if (!configured) return json({ error: "Configure server-only GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and APP_SECRET to enable Google connection. You can use CSV or skip Search Console." }, 503);
        const state: OAuthState = { nonce: randomBytes(24).toString("base64url"), verifier: randomBytes(48).toString("base64url"), owner, redirect: new URL("/api/search-console/callback", url.origin).href, expires: Date.now() + 600000 };
        const target = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        target.search = new URLSearchParams({ client_id: credentials.clientId, redirect_uri: state.redirect, response_type: "code", scope, state: state.nonce, access_type: "online", code_challenge: createHash("sha256").update(state.verifier).digest("base64url"), code_challenge_method: "S256", prompt: "select_account" }).toString();
        // Only the short-lived OAuth state cookie is Lax so Google's top-level callback can return it. Owner/credential cookies remain Strict.
        return redirect(target.href, [setCookie("gsc-state", seal(state, config, "gsc-state"), config, 600).replace("SameSite=Strict", "SameSite=Lax")]);
      }
      if (!connected) return json({ error: "Connect Google first or import a CSV." }, 401);
      const headers = { Authorization: "Bearer " + session!.token, "Content-Type": "application/json" };
      if (route.endsWith("/properties") && request.method === "GET") { const value = await google("https://www.googleapis.com/webmasters/v3/sites", { headers }); return json({ properties: (value.siteEntry || []).slice(0, 500).map((site: any) => ({ siteUrl: String(site.siteUrl), permissionLevel: String(site.permissionLevel) })) }); }
      if (route.endsWith("/query") && request.method === "POST") {
        const raw = await request.text(); if (raw.length > 10000) return json({ error: "Search request is too large." }, 413);
        const body = JSON.parse(raw);
        if (typeof body.property !== "string" || body.property.length > 2000 || !/^(https?:\/\/|sc-domain:)/.test(body.property) || !validSearchDate(body.start || "") || !validSearchDate(body.end || "") || body.start > body.end) return json({ error: "Choose a property and valid date range." }, 400);
        const value = await google(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(body.property)}/searchAnalytics/query`, { method: "POST", headers, body: JSON.stringify({ startDate: body.start, endDate: body.end, dimensions: ["query", "page"], rowLimit: 5000, type: "web", dataState: "final" }) });
        return json({ rows: (value.rows || []).slice(0, 5000).map((row: any) => ({ query: String(row.keys?.[0] || ""), page: String(row.keys?.[1] || ""), clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position })), warnings: ["Google returns top rows and may omit anonymized queries. Up to 5,000 query/page rows are loaded; totals represent returned rows, not necessarily the property total."] });
      }
      return json({ error: "Search Console route not found." }, 404);
    } catch (error) { return json({ error: error instanceof Error && error.message.startsWith("Google") ? error.message : "Search Console request could not be completed. Retry or use CSV import." }, 400); }
  };
}
