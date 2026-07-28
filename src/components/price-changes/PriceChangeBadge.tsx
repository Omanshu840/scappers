import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/format";

type Props = {
  change: number;
  className?: string;
};

export function PriceChangeBadge({ change, className }: Props) {
  const isDrop = change < 0;
  const isFlat = change === 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        isFlat && "bg-muted text-muted-foreground",
        isDrop && "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
        !isDrop && !isFlat && "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
        className
      )}
    >
      {isFlat ? (
        <Minus className="h-3 w-3" />
      ) : isDrop ? (
        <ArrowDownRight className="h-3 w-3" />
      ) : (
        <ArrowUpRight className="h-3 w-3" />
      )}
      ₹{formatINR(Math.abs(change))}
    </span>
  );
}