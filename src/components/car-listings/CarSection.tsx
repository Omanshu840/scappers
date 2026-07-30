import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CarListingCard } from "./CarListingCard";
import type { PriceChangeCarCard } from "@/api/priceChangedCars";

type Props = {
  title: string;
  description: string;
  cars: PriceChangeCarCard[];
  emptyMessage: string;
  tone?: "default" | "muted";
};

export function CarSection({ title, description, cars, emptyMessage, tone = "default" }: Props) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 border-b border-border pb-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h2
              className={cn(
                "text-base font-semibold tracking-tight",
                tone === "muted" ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {title}
            </h2>
            <Badge variant="secondary">{cars.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {cars.length === 0 ? (
        <div className="flex min-h-[100px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {cars.map((car) => (
            <CarListingCard key={car.id} car={car} />
          ))}
        </div>
      )}
    </section>
  );
}