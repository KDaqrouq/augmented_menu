/**
 * Android Scene Viewer launch URL (one tap into native AR, like Quick Look on iOS).
 * ar_preferred falls back to Scene Viewer's 3D mode on phones without ARCore,
 * and browser_fallback_url to our web viewer when Google app / Scene Viewer is missing.
 * resizable=false keeps the dish at its real size.
 *
 * https://developers.google.com/ar/develop/scene-viewer
 */
export function sceneViewerIntentUrl(options: { glbUrl: string; title: string; fallbackUrl: string }): string {
  // encodeURIComponent (not URLSearchParams) so spaces become %20, not "+", in the title.
  const query = Object.entries({
    file: options.glbUrl,
    mode: "ar_preferred",
    resizable: "false",
    title: options.title,
  })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return (
    `intent://arvr.google.com/scene-viewer/1.0?${query}` +
    `#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;` +
    `S.browser_fallback_url=${encodeURIComponent(options.fallbackUrl)};end;`
  );
}
