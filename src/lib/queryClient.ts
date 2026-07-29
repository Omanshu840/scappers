import { QueryClient } from "@tanstack/react-query";

// Module-level singleton: created exactly once when this file is first
// imported. As long as the page doesn't do a full reload, this instance
// (and its cache) persists across every route change / re-render.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});