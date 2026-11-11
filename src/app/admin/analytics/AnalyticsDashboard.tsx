"use client";

import { useEffect, useState } from "react";
import { Alert, Card, CardHeader, EmptyState, Spinner, cn, inputClass } from "@/components/ui";
import { ChartIcon } from "@/components/icons";

type Stats = {
  totalEvents: number;
  funnel: { menuViews: number; itemViews: number; arOpens: number; arPlacements: number };
  topItems: { itemId: string; name: string; restaurantName?: string; views: number; arOpens: number }[];
  byDeviceType: Record<string, number>;
  byArMode: Record<string, number>;
  daily: { day: string; menuViews: number; itemViews: number; arOpens: number }[];
};

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "all", label: "All time" },
];

const AR_MODE_LABELS: Record<string, string> = {
  quicklook: "iPhone Quick Look",
  sceneviewer: "Android Scene Viewer",
  webxr: "In-browser AR (WebXR)",
  "3dviewer": "3D viewer",
};

function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–";
}

export function AnalyticsDashboard({ restaurants }: { restaurants: { id: string; name: string }[] }) {
  const [restaurantId, setRestaurantId] = useState("");
  const [range, setRange] = useState("30");
  const query = new URLSearchParams({ days: range, ...(restaurantId && { restaurantId }) }).toString();
  // The previous stats stay on screen (dimmed) while the next query loads.
  const [stats, setStats] = useState<Stats | null>(null);
  const [result, setResult] = useState<{ query: string; error: boolean } | null>(null);
  const loading = result?.query !== query;
  const error = !loading && result?.error ? "Couldn’t load analytics. Try again in a moment." : "";

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/analytics?${query}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((data: Stats) => {
        if (cancelled) return;
        setStats(data);
        setResult({ query, error: false });
      })
      .catch(() => !cancelled && setResult({ query, error: true }));
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={restaurantId}
          onChange={(e) => setRestaurantId(e.target.value)}
          className={cn(inputClass, "w-auto min-w-[200px]")}
          aria-label="Restaurant"
        >
          <option value="">All restaurants</option>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <div className="inline-flex rounded-xl border border-stone-200 bg-white p-1 shadow-card">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium",
                range === r.value ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        {loading && <Spinner className="text-stone-400" />}
      </div>

      {error && <Alert>{error}</Alert>}

      {stats && stats.totalEvents === 0 && !loading && (
        <EmptyState icon={<ChartIcon size={32} />} title="No activity in this period">
          Views and AR opens appear here once diners scan your menu.
        </EmptyState>
      )}

      {stats && stats.totalEvents > 0 && (
        <div className={cn("space-y-6 transition-opacity", loading && "opacity-60")}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Menu views" value={stats.funnel.menuViews} />
            <Kpi
              label="Dish views"
              value={stats.funnel.itemViews}
              sub={`${pct(stats.funnel.itemViews, stats.funnel.menuViews)} of menu views`}
            />
            <Kpi
              label="3D / AR opens"
              value={stats.funnel.arOpens}
              sub={`${pct(stats.funnel.arOpens, stats.funnel.itemViews)} of dish views`}
            />
            <Kpi
              label="Placed on table"
              value={stats.funnel.arPlacements}
              sub="In-browser AR only"
            />
          </div>

          <Card>
            <CardHeader title="Daily activity" />
            <DailyChart daily={stats.daily} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader title="Top dishes" description="By dish views" />
              {stats.topItems.length === 0 ? (
                <p className="px-5 py-6 text-sm text-stone-500">No dish views yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                      <th className="px-5 py-2 font-medium">Dish</th>
                      <th className="px-3 py-2 text-right font-medium">Views</th>
                      <th className="px-5 py-2 text-right font-medium">3D / AR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {stats.topItems.map((item) => (
                      <tr key={item.itemId}>
                        <td className="px-5 py-2.5">
                          <p className="font-medium text-stone-900">{item.name}</p>
                          {!restaurantId && item.restaurantName && (
                            <p className="text-xs text-stone-500">{item.restaurantName}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{item.views}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {item.arOpens}{" "}
                          <span className="text-xs text-stone-400">({pct(item.arOpens, item.views)})</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader title="How diners open 3D" />
                <Breakdown data={stats.byArMode} labels={AR_MODE_LABELS} />
              </Card>
              <Card>
                <CardHeader title="Devices" />
                <Breakdown data={stats.byDeviceType} />
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-stone-900">{value.toLocaleString()}</p>
      {sub && <p className="mt-1 text-xs text-stone-500">{sub}</p>}
    </Card>
  );
}

function Breakdown({ data, labels }: { data: Record<string, number>; labels?: Record<string, string> }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((n, [, v]) => n + v, 0);
  if (total === 0) return <p className="px-5 py-6 text-sm text-stone-500">No data yet.</p>;
  return (
    <ul className="space-y-3 p-5">
      {entries.map(([key, count]) => (
        <li key={key}>
          <div className="flex justify-between text-sm">
            <span className="text-stone-700">{labels?.[key] ?? key}</span>
            <span className="tabular-nums text-stone-500">
              {count} · {pct(count, total)}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${(count / total) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Stacked daily bars: menu views (light), dish views (mid), 3D/AR opens (brand). */
function DailyChart({ daily }: { daily: Stats["daily"] }) {
  if (daily.length === 0) return <p className="px-5 py-6 text-sm text-stone-500">No data yet.</p>;
  const max = Math.max(...daily.map((d) => d.menuViews + d.itemViews + d.arOpens), 1);
  return (
    <div className="p-5">
      <div className="flex h-40 items-end gap-1">
        {daily.map((d) => {
          const total = d.menuViews + d.itemViews + d.arOpens;
          return (
            <div
              key={d.day}
              className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
              title={`${d.day}: ${d.menuViews} menu views, ${d.itemViews} dish views, ${d.arOpens} 3D/AR opens`}
            >
              <div className="flex flex-col overflow-hidden rounded-t-md" style={{ height: `${(total / max) * 100}%` }}>
                <div className="bg-brand-500" style={{ flexGrow: d.arOpens }} />
                <div className="bg-brand-300" style={{ flexGrow: d.itemViews }} />
                <div className="bg-stone-200" style={{ flexGrow: d.menuViews }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-stone-400">
        <span>{daily[0].day}</span>
        <span>{daily[daily.length - 1].day}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-600">
        <Legend className="bg-stone-200" label="Menu views" />
        <Legend className="bg-brand-300" label="Dish views" />
        <Legend className="bg-brand-500" label="3D / AR opens" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-sm", className)} /> {label}
    </span>
  );
}
