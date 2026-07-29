import { useState } from "react"
import { ChevronDown, LineChart as LineChartIcon } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useCarPriceHistory } from "@/hooks/useCarPriceHistory"
import { PriceHistoryChart } from "./PriceHistoryChart"
import type { Granularity } from "@/lib/priceHistoryAggregation"

type Props = {
  carId: string
}

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "month", label: "Monthly" },
]

export function PriceHistorySection({ carId }: Props) {
  const [open, setOpen] = useState(false)
  const [granularity, setGranularity] = useState<Granularity>("day")

  // enabled only while expanded — collapsing doesn't drop the cache (gcTime),
  // so re-expanding the same card is instant and re-expanding after 30 min
  // triggers a fresh fetch
  const { data, isLoading, isError, refetch, isFetching } = useCarPriceHistory(carId, open)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t border-border">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
        <span className="flex items-center gap-1.5">
          <LineChartIcon className="h-3.5 w-3.5" />
          Price history
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-2 border-t border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-md border border-border p-0.5">
              {GRANULARITIES.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGranularity(g.value)}
                  className={cn(
                    "rounded-sm px-2 py-1 text-[11px] font-medium transition-colors",
                    granularity === g.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
            {isFetching && !isLoading && (
              <span className="text-[11px] text-muted-foreground">Refreshing…</span>
            )}
          </div>

          {isLoading ? (
            <Skeleton className="h-[180px] w-full rounded-md" />
          ) : isError ? (
            <div className="flex h-[180px] flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <span>Couldn't load price history.</span>
              <button
                type="button"
                onClick={() => refetch()}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Retry
              </button>
            </div>
          ) : (
            <PriceHistoryChart data={data ?? []} granularity={granularity} />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}