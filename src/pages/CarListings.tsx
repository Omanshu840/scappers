import { useMemo, useState } from "react";
import { CarListingCard } from "@/components/car-listings/CarListingCard";
import { CarListingFilters } from "@/components/car-listings/CarListingFilters";
import { CarListingsHeader } from "@/components/car-listings/CarListingsHeader";
import { ListingState } from "@/components/car-listings/ListingState";
import { useCars, useLiveCars } from "@/hooks/useCars";
import type {
  SortOption,
  SourceFilter,
} from "@/components/car-listings/types";

export default function CarListings() {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("price-asc");
  const cachedCarsQuery = useCars();
  const liveCarsQuery = useLiveCars();

  const cars = liveCarsQuery.data ?? cachedCarsQuery.data ?? [];
  const isLoading = cachedCarsQuery.isLoading && !cachedCarsQuery.data;
  const error = cachedCarsQuery.error ?? liveCarsQuery.error;

  const filteredCars = useMemo(() => {
    const q = search.trim().toLowerCase();

    let result = cars.filter((car) => {
      const haystack = [
        car.brand,
        car.carName,
        car.variant,
        car.location ?? "",
        car.source,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || haystack.includes(q);
      const matchesSource = sourceFilter === "all" || car.source === sourceFilter;

      return matchesSearch && matchesSource;
    });

    result = [...result].sort((a, b) =>
      sortBy === "price-asc" ? a.price - b.price : b.price - a.price
    );

    return result;
  }, [cars, search, sourceFilter, sortBy]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-6 sm:py-5 lg:px-8">
      <CarListingsHeader count={filteredCars.length} />

      <CarListingFilters
        search={search}
        sourceFilter={sourceFilter}
        sortBy={sortBy}
        onSearchChange={setSearch}
        onSourceFilterChange={setSourceFilter}
        onSortByChange={setSortBy}
      />

      {liveCarsQuery.isFetching && cachedCarsQuery.data && !liveCarsQuery.data && (
        <ListingState>Refreshing live listings...</ListingState>
      )}
      {isLoading && <ListingState>Loading cars...</ListingState>}
      {!cars.length && error && (
        <ListingState tone="error">
          {error instanceof Error ? error.message : "Failed to load cars"}
        </ListingState>
      )}

      {!isLoading && (cars.length > 0 || !error) && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredCars.map((car) => (
              <CarListingCard key={car.id} car={car} />
            ))}
          </div>

          {filteredCars.length === 0 && (
            <ListingState>No cars match your filters.</ListingState>
          )}
        </>
      )}
    </main>
  );
}
