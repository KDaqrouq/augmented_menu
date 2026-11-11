/**
 * Admin session tokens: `<expiresAtSeconds>.<nonce>.<hmacSha256>` signed with SESSION_SECRET.
 * Web Crypto only, so middleware and route handlers share it. No next/headers import here,
 * which keeps it testable outside Next.
 *
 * Signing out everywhere: rotate SESSION_SECRET (or ADMIN_PASSWORD when no secret is set).
 */

export const SESSION_COOKIE_NAME = "admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

const encoder = new TextEncoder();
let warnedAboutFallbackSecret = false;

function getSigningSecret(): string | null {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) return secret;
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  if (!warnedAboutFallbackSecret && process.env.NODE_ENV === "production") {
    warnedAboutFallbackSecret = true;
    console.warn(
      "[auth] SESSION_SECRET is not set; deriving the session key from ADMIN_PASSWORD. Set SESSION_SECRET to a long random string."
    );
  }
  return `admin-password:${password}`;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** Compares digests so timing does not depend on how much of the password matched. */
export async function verifyAdminPassword(candidate: unknown): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof candidate !== "string") return false;
  const [a, b] = await Promise.all([sha256Hex(candidate), sha256Hex(expected)]);
  return constantTimeEqual(a, b);
}

export async function createSessionToken(nowMs: number = Date.now()): Promise<string> {
  const secret = getSigningSecret();
  if (!secret) throw new Error("ADMIN_PASSWORD (and ideally SESSION_SECRET) must be set");
  const expiresAt = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer as ArrayBuffer);
  const payload = `${expiresAt}.${nonce}`;
  return `${payload}.${await hmacHex(secret, payload)}`;
}

export async function verifySessionToken(token: string, nowMs: number = Date.now()): Promise<boolean> {
  const secret = getSigningSecret();
  if (!secret || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expiresAtRaw, nonce, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isInteger(expiresAt) || expiresAt * 1000 <= nowMs) return false;
  const expected = await hmacHex(secret, `${expiresAtRaw}.${nonce}`);
  return constantTimeEqual(signature, expected);
}
