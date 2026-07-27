type CarListingsHeaderProps = {
  count: number
}

export function CarListingsHeader({ count }: CarListingsHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start justify-between gap-3 sm:block sm:space-y-1">
        <div className="min-w-0 space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Used Cars
        </h1>
        <p className="text-sm text-muted-foreground">
          Cars24 and Spinny listings with adjusted final pricing.
        </p>
        </div>

        <div className="shrink-0 rounded-md bg-primary px-2.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm sm:hidden">
          {count}
        </div>
      </div>

      <div className="hidden rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm sm:block">
        {count} cars
      </div>
    </div>
  )
}
