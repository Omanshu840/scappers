import { useQuery } from "@tanstack/react-query";
import {
  getAllCarsWithPriceInfo,
  getCarsWithPriceChanges,
  type PriceChangeCarCard,
} from "../api/priceChangedCars";

/** Only cars whose price has actually changed — used where you specifically
 * want just the movers (e.g. a dedicated report), not the merged listings
 * screen. */
export function useCarsWithPriceChanges() {
  return useQuery({
    queryKey: ["cars-with-price-changes"],
    queryFn: getCarsWithPriceChanges,
    staleTime: 60_000,
  });
}

/** Every car (active + inactive), each annotated with price-change info.
 * This is what the merged CarListings screen renders from. */
export function useAllCarsWithPriceInfo() {
  return useQuery({
    queryKey: ["all-cars-with-price-info"],
    queryFn: getAllCarsWithPriceInfo,
    staleTime: 60_000,
  });
}

export function splitByActive(cars: PriceChangeCarCard[] = []) {
  return {
    active: cars.filter((c) => c.isActive),
    inactive: cars.filter((c) => !c.isActive),
  };
}