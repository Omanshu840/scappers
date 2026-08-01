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

type CarListingFiltersProps = {
  search: string
  sourceFilter: SourceFilter
  sortBy: SortOption
  bodyTypeFilter: BodyTypeFilter
  onSearchChange: (value: string) => void
  onSourceFilterChange: (value: SourceFilter) => void
  onSortByChange: (value: SortOption) => void
  onBodyTypeFilterChange: (value: BodyTypeFilter) => void
}

const BODY_TYPE_PILLS: { value: BodyTypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "suv", label: "SUV" },
  { value: "sedan", label: "Sedan" },
  { value: "hatchback", label: "Hatchback" },
]

export function CarListingFilters({
  search,
  sourceFilter,
  sortBy,
  bodyTypeFilter,
  onSearchChange,
  onSourceFilterChange,
  onSortByChange,
  onBodyTypeFilterChange,
}: CarListingFiltersProps) {
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

      <div className="flex flex-wrap gap-1.5 px-0.5">
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
      </div>
    </div>
  )
}