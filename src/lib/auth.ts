import { cookies } from "next/headers";
import {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "./session";

export { verifySessionToken, verifyAdminPassword, SESSION_COOKIE_NAME } from "./session";

/**
 * v1 admin auth: single password gate, no user table.
 * The cookie holds an HMAC-signed, expiring token (see ./session.ts), never the password or its hash.
 */
export async function getAdminSession(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return !!token && verifySessionToken(token);
}

export async function setAdminSessionCookie(): Promise<void> {
  const token = await createSessionToken();
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}
