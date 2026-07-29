import { useQuery } from "@tanstack/react-query";
import { getCarPriceHistory } from "../api/carPriceHistory";

export function useCarPriceHistory(carId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["car-price-history", carId],
    queryFn: () => getCarPriceHistory(carId),
    enabled: enabled && Boolean(carId),
    staleTime: 5 * 60_000, // price history updates at most once/day, no need to refetch often
    gcTime: 30 * 60_000, // keep it cached after collapsing so re-expanding is instant
  });
}