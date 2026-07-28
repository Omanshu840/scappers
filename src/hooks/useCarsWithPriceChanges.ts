import { useQuery } from "@tanstack/react-query";
import { getCarsWithPriceChanges, type PriceChangeCarCard } from "../api/priceChangedCars";

export function useCarsWithPriceChanges() {
  return useQuery({
    queryKey: ["cars-with-price-changes"],
    queryFn: getCarsWithPriceChanges,
    staleTime: 60_000,
  });
}

export function splitByActive(cars: PriceChangeCarCard[] = []) {
  return {
    active: cars.filter((c) => c.isActive),
    inactive: cars.filter((c) => !c.isActive),
  };
}