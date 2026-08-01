import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CarListingFilters } from "@/components/car-listings/CarListingFilters";
import { CarListingsHeader } from "@/components/car-listings/CarListingsHeader";
import { ListingState } from "@/components/car-listings/ListingState";
import { CarSection } from "@/components/car-listings/CarSection";
import { CarSectionSkeleton } from "@/components/car-listings/CarSectionSkeleton";
import { useCars, useLiveCars } from "@/hooks/useCars";
import { useAllCarsWithPriceInfo } from "@/hooks/useCarsWithPriceChanges";
import type { BodyTypeFilter, SortOption, SourceFilter } from "@/components/car-listings/types";

export default function CarListings() {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [bodyTypeFilter, setBodyTypeFilter] = useState<BodyTypeFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("price-asc");

  const queryClient = useQueryClient();

  // Background sync only — this runs your existing scrape/upsert pipeline
  // so the DB (and therefore the view-based query below) reflects fresh
  // prices. We don't render `liveCarsQuery.data` directly: it only covers
  // active cars and doesn't carry price-change history, whereas the query
  // below already has everything (active + inactive + price movement).
  const cachedCarsQuery = useCars();
  const liveCarsQuery = useLiveCars(cachedCarsQuery.data ?? []);

  useEffect(() => {
    if (liveCarsQuery.isSuccess) {
      queryClient.invalidateQueries({ queryKey: ["all-cars-with-price-info"] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveCarsQuery.dataUpdatedAt]);

  const allCarsQuery = useAllCarsWithPriceInfo();

  const cars = allCarsQuery.data ?? [];
  const isLoading = allCarsQuery.isLoading && !allCarsQuery.data;
  const isRefreshing = liveCarsQuery.isFetching || allCarsQuery.isFetching;
  const error = allCarsQuery.error;

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
      const matchesBodyType = bodyTypeFilter === "all" || car.bodyType === bodyTypeFilter;

      return matchesSearch && matchesSource && matchesBodyType;
    });

    result = [...result].sort((a, b) =>
      sortBy === "price-asc" ? a.price - b.price : b.price - a.price
    );

    return result;
  }, [cars, search, sourceFilter, bodyTypeFilter, sortBy]);

  const activeCars = filteredCars.filter((car) => car.isActive);
  const inactiveCars = filteredCars.filter((car) => !car.isActive);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-6 sm:py-5 lg:px-8">
      <CarListingsHeader count={filteredCars.length} />

      <CarListingFilters
        search={search}
        sourceFilter={sourceFilter}
        sortBy={sortBy}
        bodyTypeFilter={bodyTypeFilter}
        onSearchChange={setSearch}
        onSourceFilterChange={setSourceFilter}
        onSortByChange={setSortBy}
        onBodyTypeFilterChange={setBodyTypeFilter}
      />

      {!cars.length && error && (
        <ListingState tone="error">
          {error instanceof Error ? error.message : "Failed to load cars"}
        </ListingState>
      )}

      {isLoading && (
        <div className="space-y-8">
          <CarSectionSkeleton />
          <CarSectionSkeleton />
        </div>
      )}

      {!isLoading && (cars.length > 0 || !error) && (
        <div className="space-y-8">
          {isRefreshing && (
            <p className="text-xs text-muted-foreground">Refreshing listings…</p>
          )}

          <CarSection
            title="Active listings"
            description="Currently live listings. Cars with a price-change badge have moved in price since first tracked."
            cars={activeCars}
            emptyMessage="No active cars match your filters."
          />

          <CarSection
            title="Inactive listings"
            description="Delisted or sold cars, kept for price-history reference."
            cars={inactiveCars}
            emptyMessage="No inactive cars match your filters."
            tone="muted"
          />

          {filteredCars.length === 0 && (
            <ListingState>No cars match your filters.</ListingState>
          )}
        </div>
      )}
    </main>
  );
}