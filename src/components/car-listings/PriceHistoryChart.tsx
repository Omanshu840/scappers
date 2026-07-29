import { useMemo } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatCompactINR } from "./formatters"
import { aggregatePriceHistory, type Granularity } from "@/lib/priceHistoryAggregation"
import type { PriceHistoryPoint } from "@/api/carPriceHistory"

type Props = {
  data: PriceHistoryPoint[]
  granularity: Granularity
}

// px per data point — wide enough that many points force horizontal scroll
// rather than squeezing illegibly into the card's width
const POINT_WIDTH: Record<Granularity, number> = { day: 44, month: 72 }
const CHART_HEIGHT = 180

function formatAxisDate(dateStr: string, granularity: Granularity) {
  const date = new Date(dateStr)
  if (granularity === "month") {
    return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
  }
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

// Custom tick renderers using Tailwind's fill-* utility classes (which
// resolve against the app's real theme tokens, whatever color format they're
// defined in) instead of hand-written hsl(var(--x)) strings, which silently
// break if the variable isn't a bare HSL triplet.
function AxisTick({
  x,
  y,
  payload,
  granularity,
}: {
  x?: number
  y?: number
  payload?: { value: string }
  granularity: Granularity
}) {
  if (x === undefined || y === undefined || !payload) return null
  return (
    <text x={x} y={y} dy={12} textAnchor="middle" className="fill-muted-foreground text-[10px]">
      {formatAxisDate(payload.value, granularity)}
    </text>
  )
}

function PriceAxisTick({
  x,
  y,
  payload,
}: {
  x?: number
  y?: number
  payload?: { value: number }
}) {
  if (x === undefined || y === undefined || !payload) return null
  return (
    <text x={x} y={y} dy={4} textAnchor="end" className="fill-muted-foreground text-[10px]">
      {formatCompactINR(payload.value)}
    </text>
  )
}

export function PriceHistoryChart({ data, granularity }: Props) {
  const points = useMemo(() => aggregatePriceHistory(data, granularity), [data, granularity])

  const chartWidth = Math.max(points.length * POINT_WIDTH[granularity], 320)

  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height: CHART_HEIGHT }}
      >
        No price history yet.
      </div>
    )
  }

  if (points.length === 1) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-1 text-sm text-muted-foreground"
        style={{ height: CHART_HEIGHT }}
      >
        <span>Only one data point recorded so far.</span>
        <span className="font-medium text-foreground">₹ {formatCompactINR(points[0].price)}</span>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto overscroll-x-contain rounded-md">
      <div style={{ width: chartWidth, height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid className="stroke-border" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={<AxisTick granularity={granularity} />}
              tickLine={false}
              axisLine={{ className: "stroke-border" }}
              interval={0}
              minTickGap={0}
            />
            <YAxis
              width={56}
              tick={<PriceAxisTick />}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
            />
            <Tooltip
              cursor={{ className: "stroke-border" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const point = payload[0].payload as PriceHistoryPoint
                return (
                  <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
                    <p className="font-medium">{formatAxisDate(label as string, granularity)}</p>
                    <p className="text-muted-foreground">₹ {formatCompactINR(point.price)}</p>
                    {!point.isActive && <p className="text-muted-foreground">Inactive</p>}
                  </div>
                )
              }}
            />
            <Line
              type="monotone"
              dataKey="price"
              className="stroke-primary"
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, className: "fill-primary" }}
              activeDot={{ r: 4, className: "fill-primary" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}