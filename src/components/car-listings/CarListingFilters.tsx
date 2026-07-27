import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SortOption, SourceFilter } from "./types"

type CarListingFiltersProps = {
  search: string
  sourceFilter: SourceFilter
  sortBy: SortOption
  onSearchChange: (value: string) => void
  onSourceFilterChange: (value: SourceFilter) => void
  onSortByChange: (value: SortOption) => void
}

export function CarListingFilters({
  search,
  sourceFilter,
  sortBy,
  onSearchChange,
  onSourceFilterChange,
  onSortByChange,
}: CarListingFiltersProps) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border bg-card p-2 shadow-sm sm:grid-cols-[minmax(0,1fr)_10rem_12rem]">
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
  )
}
