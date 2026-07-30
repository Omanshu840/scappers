import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { PriceChangeCarCard } from "@/api/priceChangedCars"
import { cn } from "@/lib/utils"
import {
  formatCompactINR,
  formatKilometers,
  formatSource,
} from "./formatters"
import { PriceChangeBadge } from "./PriceChangeBadge"
import { PriceHistorySection } from "./PriceHistorySection"

type CarListingCardProps = {
  car: PriceChangeCarCard
}

function SpecPill({ children }: { children: React.ReactNode }) {
  return (
    <Badge
      variant="secondary"
      className="h-6 rounded-md px-2 text-xs font-medium"
    >
      {children}
    </Badge>
  )
}

export function CarListingCard({ car }: CarListingCardProps) {
  const hasPriceChange = car.priceChange !== 0
  const isDimmed = car.booked || !car.isActive

  const mainContent = (
    <>
      <div className="relative aspect-[1.85] border-b bg-muted max-sm:aspect-auto max-sm:border-b-0 max-sm:border-r">
        {car.coverImage ? (
          <img
            src={car.coverImage}
            alt={`${car.brand} ${car.carName}`}
            className={cn("h-full w-full object-cover", isDimmed && "grayscale")}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No image
          </div>
        )}

        <div className="absolute left-2 top-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="h-6 rounded-md px-2 text-xs font-medium capitalize">
            {car.source}
          </Badge>
          {car.booked && (
            <Badge variant="default" className="h-6 rounded-md px-2 text-xs shadow-sm">
              Booked
            </Badge>
          )}
        </div>

        {!car.isActive && (
          <Badge
            variant="outline"
            className="absolute right-2 top-2 border-border bg-background/85 text-foreground backdrop-blur"
          >
            Inactive
          </Badge>
        )}
      </div>
      <CardContent className="space-y-2.5 p-3">
        <div className="space-y-0.5">
          <div className="flex items-start justify-between gap-2 max-sm:flex-col max-sm:gap-1">
            <h3 className="min-w-0 truncate font-heading text-base font-semibold leading-tight">
              {car.modelYear ? `${car.modelYear} ` : ""}
              {car.carName}
            </h3>
            <div className="shrink-0 rounded-md bg-primary px-2 py-1 text-sm font-semibold leading-tight text-primary-foreground max-sm:text-xs">
              ₹ {formatCompactINR(car.price)}
            </div>
          </div>
          <p className="truncate text-sm font-medium text-muted-foreground">
            {car.variant || car.brand}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <SpecPill>{formatKilometers(car.kmDriven)}</SpecPill>
          <SpecPill>{car.modelYear ?? "N/A"}</SpecPill>
        </div>
        <div className="flex items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground max-sm:items-start">
          <p className="min-w-0 truncate">
            {car.location ?? "Location not available"}
          </p>
          <Badge
            variant="outline"
            className="shrink-0 rounded-md bg-card"
          >
            {formatSource(car.source)}
          </Badge>
        </div>
        {hasPriceChange && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <PriceChangeBadge change={car.priceChange} />
          </div>
        )}
      </CardContent>
    </>
  )

  return (
    <Card
      size="sm"
      aria-disabled={isDimmed}
      className={cn(
        "gap-0 overflow-hidden rounded-lg py-0 shadow-sm ring-border transition hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/25",
        isDimmed && "bg-muted/50 opacity-75 hover:translate-y-0 hover:shadow-sm"
      )}
    >
      {/* Clickable area is scoped to image + details only, so the price-history
          toggle below can be its own interactive control without nesting a
          <button> inside an <a> (invalid HTML) or fighting click handlers. */}
      {car.detailUrl ? (
        <a
          href={car.detailUrl}
          target="_blank"
          rel="noreferrer"
          className="block outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 max-sm:grid max-sm:grid-cols-[9.25rem_minmax(0,1fr)]"
          aria-label={`Open ${car.carName} on ${formatSource(car.source)}`}
        >
          {mainContent}
        </a>
      ) : (
        <div className="max-sm:grid max-sm:grid-cols-[9.25rem_minmax(0,1fr)]">{mainContent}</div>
      )}

      {/* Always lazy: history only fetches once the user expands this
          section, regardless of whether the car has a recorded price
          change. The badge above is enough of an indicator on its own. */}
      <PriceHistorySection carId={car.id} />
    </Card>
  )
}