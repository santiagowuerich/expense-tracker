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

// Tipos de inventario (asegúrate que la ruta sea correcta)
import type { MovimientoStock } from "@/types/inventario.types";

// Hook para obtener movimientos de stock por producto
export function useMovimientosStockQuery(productoId: string | null, enabled: boolean = true) {
  return useQuery<
    (MovimientoStock & { usuario_email?: string | null; producto_nombre?: string | null })[]
  >({
    queryKey: ["movimientos_stock", productoId],
    queryFn: async () => {
      if (!productoId) return [];
      const supabase = createClient();
      // Primero, obtenemos los movimientos de stock
      const { data: movimientosData, error: movimientosError } = await supabase
        .from("movimientos_stock")
        .select(`
          id,
          producto_id,
          fecha,
          tipo_movimiento,
          cantidad,
          stock_anterior,
          stock_nuevo,
          referencia_id,
          notas,
          creado_en,
          creado_por
        `)
        .eq("producto_id", productoId)
        .order("fecha", { ascending: false })
        .order("creado_en", { ascending: false });

      if (movimientosError) {
        console.error("Error fetching stock movements (fase 1 - movimientos):", movimientosError);
        // Intenta devolver más información del error si está disponible
        const message = movimientosError.message || JSON.stringify(movimientosError);
        throw new Error(`Error en movimientos_stock: ${message}`);
      }

      if (!movimientosData) return [];

      // Luego, enriquecemos con el email del usuario
      const enrichedData = await Promise.all(
        movimientosData.map(async (movimiento) => {
          let usuario_email: string | null = null;
          if (movimiento.creado_por) {
            try {
              // Llamada a la función RPC para obtener el email
              const { data: emailData, error: emailError } = await supabase.rpc(
                'get_user_email_by_id',
                { user_id: movimiento.creado_por }
              );

              if (emailError) {
                console.warn(
                  `Error fetching email for user ${movimiento.creado_por} via RPC:`, 
                  emailError.message || JSON.stringify(emailError)
                );
              } else {
                usuario_email = typeof emailData === 'string' ? emailData : null;
              }
            } catch (e: any) {
              console.warn(
                `Exception fetching email for user ${movimiento.creado_por} via RPC:`, 
                e.message
              );
            }
          }
          return {
            ...movimiento,
            fecha: String(movimiento.fecha),
            creado_en: String(movimiento.creado_en),
            usuario_email, // Asignar el email obtenido
          };
        })
      );
      
      return enrichedData as (MovimientoStock & { usuario_email?: string | null; producto_nombre?: string | null })[];
    },
    enabled: !!productoId && enabled,
  });
}
