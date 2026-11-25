import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const TTL = 8 * 60 * 60;
export interface AuthConfig {
  secret: string;
  passwordHash: string;
  secure: boolean;
}
export interface OwnerSession {
  id: string;
  expires: number;
}
export function hashPassword(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  return salt + ":" + scryptSync(password, salt, 32).toString("hex");
}
export function passwordMatches(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!/^[a-f0-9]{32}$/.test(salt || "") || !/^[a-f0-9]{64}$/.test(hash || ""))
    return false;
  const actual = scryptSync(password, salt, 32);
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
export function authReady(config: AuthConfig) {
  return (
    config.secret.length >= 40 &&
    /^[a-f0-9]{32}:[a-f0-9]{64}$/.test(config.passwordHash)
  );
}
export function seal(value: unknown, config: AuthConfig, purpose: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    createHash("sha256").update(config.secret).digest(),
    iv,
  );
  cipher.setAAD(Buffer.from(purpose));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}
export function unseal<T>(
  value: string,
  config: AuthConfig,
  purpose: string,
): T | null {
  try {
    if (!value || value.length > 6000) return null;
    const data = Buffer.from(value, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      createHash("sha256").update(config.secret).digest(),
      data.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(data.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        decipher.update(data.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    );
  } catch {
    return null;
  }
}
export function cookieName(kind: string, config: AuthConfig) {
  return (config.secure ? "__Host-" : "") + "seo-" + kind;
}
export function cookie(request: Request, kind: string, config: AuthConfig) {
  const name = cookieName(kind, config) + "=";
  return (
    (request.headers.get("cookie") || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(name))
      ?.slice(name.length) || ""
  );
}
export function setCookie(
  kind: string,
  value: string,
  config: AuthConfig,
  maxAge = TTL,
) {
  return `${cookieName(kind, config)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.secure ? "; Secure" : ""}`;
}
export function session(request: Request, config: AuthConfig) {
  const value = unseal<OwnerSession>(
    cookie(request, "owner", config),
    config,
    "owner",
  );
  return value && typeof value.id === "string" && value.expires > Date.now()
    ? value
    : null;
}
export function newSession(): OwnerSession {
  return {
    id: randomBytes(24).toString("base64url"),
    expires: Date.now() + TTL * 1000,
  };
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const target = new URL(request.url);
  return (
    !["cross-site"].includes(request.headers.get("sec-fetch-site") || "") &&
    (!origin || origin === target.origin)
  );
}
export function securityHeaders() {
  return {
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
  };
}
