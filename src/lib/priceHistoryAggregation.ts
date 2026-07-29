import type { PriceHistoryPoint } from "@/api/carPriceHistory";

export type Granularity = "day" | "month";

export function aggregatePriceHistory(
  points: PriceHistoryPoint[],
  granularity: Granularity
): PriceHistoryPoint[] {
  if (granularity === "day") return points;

  // one point per month: the latest price observed within that month
  const byMonth = new Map<string, PriceHistoryPoint>();
  for (const point of points) {
    const monthKey = point.date.slice(0, 7); // YYYY-MM
    const existing = byMonth.get(monthKey);
    if (!existing || point.date >= existing.date) {
      byMonth.set(monthKey, point);
    }
  }

  return Array.from(byMonth.values()).sort((a, b) => a.date.localeCompare(b.date));
}