/** Detect iOS Safari / WebKit (iPhone, iPad, iPod) from User-Agent. */
export function isIOSUserAgent(userAgent: string): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent);
}
