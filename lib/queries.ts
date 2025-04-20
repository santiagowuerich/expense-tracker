"use client"

import type React from "react"

import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase-browser"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutos
    },
  },
})

// Hook para obtener productos
export function useProductsQuery() {
  return useQuery({
    queryKey: ["productos"],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from("productos").select("id, nombre").order("nombre")

      if (error) {
        throw new Error(error.message)
      }

      return data || []
    },
  })
}

// Hook para guardar un producto
export function useSaveProductMutation() {
  return useMutation({
    mutationFn: async (productoData: any) => {
      const supabase = createClient()
      const { data, error } = await supabase.from("productos").insert(productoData).select()

      if (error) {
        throw new Error(error.message)
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos"] })
    },
  })
}
