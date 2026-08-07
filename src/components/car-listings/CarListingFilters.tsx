import { useEffect, useRef, useState } from "react"
import { Plus, Settings2, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { BodyTypeFilter, SortOption, SourceFilter } from "./types"

const INTERESTED_CARS_STORAGE_KEY = "carListing.interestedCars"

type CarListingFiltersProps = {
  search: string
  sourceFilter: SourceFilter
  sortBy: SortOption
  bodyTypeFilter: BodyTypeFilter
  /** Whether the "Interested Cars" pill is currently active */
  interestedOnly: boolean
  onSearchChange: (value: string) => void
  onSourceFilterChange: (value: SourceFilter) => void
  onSortByChange: (value: SortOption) => void
  onBodyTypeFilterChange: (value: BodyTypeFilter) => void
  onInterestedOnlyChange: (value: boolean) => void
  /**
   * Called whenever the saved list of interested car names changes
   * (including once on mount, after it's been read from localStorage).
   * The parent should use this list + `interestedOnly` to filter listings,
   * e.g. by checking if a car's model/brand includes one of these names.
   */
  onInterestedCarsChange?: (cars: string[]) => void
}

const BODY_TYPE_PILLS: { value: BodyTypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "suv", label: "SUV" },
  { value: "sedan", label: "Sedan" },
  { value: "hatchback", label: "Hatchback" },
]

function loadInterestedCars(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(INTERESTED_CARS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []
  } catch {
    return []
  }
}

export function CarListingFilters({
  search,
  sourceFilter,
  sortBy,
  bodyTypeFilter,
  interestedOnly,
  onSearchChange,
  onSourceFilterChange,
  onSortByChange,
  onBodyTypeFilterChange,
  onInterestedOnlyChange,
  onInterestedCarsChange,
}: CarListingFiltersProps) {
  const [interestedCars, setInterestedCars] = useState<string[]>([])
  const [isManagerOpen, setIsManagerOpen] = useState(false)
  const [newCarName, setNewCarName] = useState("")
  const managerRef = useRef<HTMLDivElement>(null)

  // Load saved interests from localStorage on mount and report them up.
  useEffect(() => {
    const saved = loadInterestedCars()
    setInterestedCars(saved)
    onInterestedCarsChange?.(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close the manager popover when clicking outside of it.
  useEffect(() => {
    if (!isManagerOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (managerRef.current && !managerRef.current.contains(event.target as Node)) {
        setIsManagerOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isManagerOpen])

  function persistInterestedCars(next: string[]) {
    setInterestedCars(next)
    onInterestedCarsChange?.(next)
    try {
      window.localStorage.setItem(INTERESTED_CARS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Ignore write failures (e.g. storage disabled/full).
    }
  }

  function handleAddCar() {
    const trimmed = newCarName.trim()
    if (!trimmed) return
    const alreadyExists = interestedCars.some(
      (car) => car.toLowerCase() === trimmed.toLowerCase()
    )
    if (!alreadyExists) {
      persistInterestedCars([...interestedCars, trimmed])
    }
    setNewCarName("")
  }

  function handleRemoveCar(car: string) {
    const next = interestedCars.filter((c) => c !== car)
    persistInterestedCars(next)
    // If the list becomes empty, there's nothing left to filter by.
    if (next.length === 0 && interestedOnly) {
      onInterestedOnlyChange(false)
    }
  }

  function handlePillClick() {
    // If there's nothing saved yet, open the manager instead of toggling
    // an empty filter on.
    if (interestedCars.length === 0) {
      setIsManagerOpen(true)
      return
    }
    onInterestedOnlyChange(!interestedOnly)
  }

  return (
    <div className="space-y-2 rounded-lg border bg-card p-2 shadow-sm">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_12rem]">
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search brand, model, variant, location..."
          className="col-span-2 h-10 rounded-md border-transparent bg-input sm:col-span-1"
        />

        <Select
          value={sourceFilter}
          onValueChange={(value) => onSourceFilterChange(value as SourceFilter)}
        >
          <SelectTrigger className="h-10 rounded-md border-transparent bg-input font-medium">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="cars24">Cars24</SelectItem>
            <SelectItem value="spinny">Spinny</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sortBy}
          onValueChange={(value) => onSortByChange(value as SortOption)}
        >
          <SelectTrigger className="h-10 rounded-md border-transparent bg-input font-medium">
            <SelectValue placeholder="Sort by price" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="price-asc">Price: Low to High</SelectItem>
            <SelectItem value="price-desc">Price: High to Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-0.5">
        {BODY_TYPE_PILLS.map((pill) => (
          <button
            key={pill.value}
            type="button"
            onClick={() => onBodyTypeFilterChange(pill.value)}
            aria-pressed={bodyTypeFilter === pill.value}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              bodyTypeFilter === pill.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            {pill.label}
          </button>
        ))}

        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />

        <div className="relative" ref={managerRef}>
          <button
            type="button"
            onClick={handlePillClick}
            aria-pressed={interestedOnly}
            className={cn(
              "flex items-center gap-1 rounded-full border py-1 pl-3 pr-1.5 text-xs font-medium transition-colors",
              interestedOnly
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            Interested Cars
            {interestedCars.length > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                  interestedOnly
                    ? "bg-primary-foreground/20"
                    : "bg-muted text-foreground/70"
                )}
              >
                {interestedCars.length}
              </span>
            )}
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                setIsManagerOpen((open) => !open)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsManagerOpen((open) => !open)
                }
              }}
              aria-label="Manage interested cars"
              className={cn(
                "ml-0.5 flex h-5 w-5 items-center justify-center rounded-full transition-colors",
                interestedOnly
                  ? "hover:bg-primary-foreground/20"
                  : "hover:bg-muted"
              )}
            >
              <Settings2 className="h-3 w-3" />
            </span>
          </button>

          {isManagerOpen && (
            <div className="absolute left-0 top-[calc(100%+0.5rem)] z-20 w-64 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md">
              <p className="mb-2 text-xs font-medium text-foreground">
                Your interested cars
              </p>

              <div className="mb-2 flex gap-1.5">
                <Input
                  value={newCarName}
                  onChange={(e) => setNewCarName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddCar()
                    }
                  }}
                  placeholder="e.g. Kiger, Magnite"
                  className="h-8 flex-1 rounded-md border-transparent bg-input text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddCar}
                  disabled={!newCarName.trim()}
                  aria-label="Add car"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {interestedCars.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No cars added yet. Add a brand or model above to start
                  filtering your favorites.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {interestedCars.map((car) => (
                    <span
                      key={car}
                      className="flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-foreground"
                    >
                      {car}
                      <button
                        type="button"
                        onClick={() => handleRemoveCar(car)}
                        aria-label={`Remove ${car}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}