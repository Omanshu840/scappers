import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export type SaveCarNotesVariables = {
  carId: string
  notes: string | null
}

export function useSaveCarNotes() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ carId, notes }: SaveCarNotesVariables) => {
      const { data, error } = await supabase
        .from("cars")
        .update({ notes })
        .eq("id", carId)
        .select("id, notes")
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error("Failed to update notes: row not found or permission denied")
      return data
    },
    onSuccess: (_data, variables) => {

      queryClient.setQueryData(["all-cars-with-price-info"], (oldData: any) =>
        oldData?.map((car: any) =>
          car && typeof car === "object" && "id" in car && car.id === variables.carId
            ? { ...car, notes: variables.notes }
            : car
        ) ?? oldData
      )
    },
  })
}
