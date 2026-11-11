/**
 * Loads a page the way a diner's phone would and reports what it costs:
 * bytes transferred (total and images), request count and Largest Contentful Paint.
 *
 * Throttling matches Lighthouse's mobile preset (slow 4G: 150 ms RTT, ~1.6 Mbps down,
 * 4x CPU slowdown). Every run uses a fresh browser context, so nothing is cached.
 * Analytics posts are answered locally so test visits never reach the database.
 *
 * Usage:
 *   npx tsx scripts/measure-page-weight.ts <url> [--runs 3] [--chrome <path to chrome>]
 */
import { chromium, devices } from "playwright-core";

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--") && /^https?:/.test(a));
const argValue = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const runs = Number(argValue("--runs") ?? 3);
const chromePath =
  argValue("--chrome") ?? process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

if (!url) {
  console.error("Usage: npx tsx scripts/measure-page-weight.ts <url> [--runs 3] [--chrome <path>]");
  process.exit(1);
}

type Run = { totalBytes: number; imageBytes: number; requests: number; imageRequests: number; lcpMs: number };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function measureOnce(browserUrl: string): Promise<Run> {
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  try {
    const context = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await context.newPage();
    await page.route("**/api/analytics/event", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' })
    );

    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1638.4 * 1024) / 8,
      uploadThroughput: (675 * 1024) / 8,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

    const types = new Map<string, string>();
    const sizes = new Map<string, number>();
    cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.type));
    cdp.on("Network.loadingFinished", (e) => sizes.set(e.requestId, e.encodedDataLength));

    await page.addInitScript(() => {
      (window as unknown as { __lcp: number }).__lcp = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) (window as unknown as { __lcp: number }).__lcp = entry.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });

    await page.goto(browserUrl, { waitUntil: "load", timeout: 180_000 });
    await page.waitForLoadState("networkidle", { timeout: 180_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const lcpMs = await page.evaluate(() => (window as unknown as { __lcp: number }).__lcp);

    let totalBytes = 0;
    let imageBytes = 0;
    let imageRequests = 0;
    for (const [id, bytes] of sizes) {
      totalBytes += bytes;
      if (types.get(id) === "Image") {
        imageBytes += bytes;
        imageRequests += 1;
      }
    }
    return { totalBytes, imageBytes, requests: sizes.size, imageRequests, lcpMs };
  } finally {
    await browser.close();
  }
}

async function main() {
  const results: Run[] = [];
  for (let i = 0; i < runs; i++) results.push(await measureOnce(url!));
  const kb = (b: number) => (b / 1024).toFixed(0);
  for (const [i, r] of results.entries()) {
    console.log(
      `run ${i + 1}: ${kb(r.totalBytes)} KB total, ${kb(r.imageBytes)} KB images (${r.imageRequests} requests), ` +
        `${r.requests} requests, LCP ${r.lcpMs.toFixed(0)} ms`
    );
  }
  const summary = {
    url,
    runs,
    medianTotalKB: Number(kb(median(results.map((r) => r.totalBytes)))),
    medianImageKB: Number(kb(median(results.map((r) => r.imageBytes)))),
    medianRequests: median(results.map((r) => r.requests)),
    medianLcpMs: Math.round(median(results.map((r) => r.lcpMs))),
  };
  console.log(JSON.stringify(summary));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
