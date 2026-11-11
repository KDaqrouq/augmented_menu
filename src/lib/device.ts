export type MobilePlatform = "ios" | "android" | "other";

/** Detect iOS Safari / WebKit (iPhone, iPad, iPod) from User-Agent. */
export function isIOSUserAgent(userAgent: string): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent);
}

export function isAndroidUserAgent(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

export function getMobilePlatform(userAgent: string): MobilePlatform {
  if (isIOSUserAgent(userAgent)) return "ios";
  if (isAndroidUserAgent(userAgent)) return "android";
  return "other";
}
