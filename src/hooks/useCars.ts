import { useQuery } from "@tanstack/react-query";
import { getCars, getLiveCars, type CarCard } from "../api/cars";

const CARS_QUERY_KEY = ["cars"] as const;
const LIVE_CARS_QUERY_KEY = ["cars-live"] as const;

export function useCars() {
    return useQuery({
        queryKey: CARS_QUERY_KEY,
        queryFn: getCars,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
        retry: 1,
    });
}

export function useLiveCars(existingCars: CarCard[] = []) {
    return useQuery({
        queryKey: [...LIVE_CARS_QUERY_KEY, existingCars],
        queryFn: () => getLiveCars(existingCars),
        enabled: existingCars.length > 0,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
        retry: 1,
    });
}
