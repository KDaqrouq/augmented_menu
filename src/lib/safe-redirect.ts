/**
 * Only allow same-site paths after login, so a crafted `?from=` link cannot
 * send someone to another site (open redirect).
 */
export function safeRedirectPath(from: string | null | undefined, fallback = "/admin"): string {
  if (!from || typeof from !== "string") return fallback;
  if (!from.startsWith("/") || from.startsWith("//") || from.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(from)) return fallback;
  return from;
}
