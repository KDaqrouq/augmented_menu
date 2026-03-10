import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

/**
 * v1 admin auth: simple password gate (IMPLEMENTATION_PLAN Checkpoint 1C).
 * Session is a signed cookie; no user table. Document in README.
 * Uses Web Crypto so middleware (Edge) and server can share logic.
 */
async function getAdminPasswordHash(): Promise<string> {
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd) return "";
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(pwd)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function getSessionToken(): Promise<string> {
  return getAdminPasswordHash();
}

export async function verifySessionToken(token: string): Promise<boolean> {
  const expected = await getAdminPasswordHash();
  return !!expected && constantTimeEqual(token, expected);
}

export async function getAdminSession(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return !!token && verifySessionToken(token);
}

export async function setAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, await getSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
