export type DailyCounts = { day: string; menuViews: number; itemViews: number; arOpens: number };

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * SQL only returns days that had events. The chart needs every day in the range,
 * otherwise one busy day stretches across the whole width.
 * `start` defaults to the first day with data (for the "all time" range).
 */
export function fillDailySeries(rows: DailyCounts[], end: Date, start?: Date | null): DailyCounts[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const firstDay = start ? utcDay(start) : rows.map((r) => r.day).sort()[0];
  if (!firstDay) return [];

  const out: DailyCounts[] = [];
  const last = utcDay(end);
  for (let t = Date.parse(`${firstDay}T00:00:00Z`); ; t += DAY_MS) {
    const day = utcDay(new Date(t));
    if (day > last) break;
    out.push(byDay.get(day) ?? { day, menuViews: 0, itemViews: 0, arOpens: 0 });
  }
  return out;
}
