"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase-browser";
import { parseISO, format, isAfter, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

// --- Tipos ---

// Tipo para el resumen de cada compra
export interface CompraResumen {
  idCompra: string; // pago_original_id
  descripcion: string;
  totalCuotas: number;
  montoCuota: number; // Asume fijo
  fechaProximaCuota: string | null; // Fecha ISO de la próxima cuota pendiente
  proximaCuotaMonto: number | null; // Monto de la próxima cuota
  cuotasPagadas: number;
}

// Tipo para el detalle de cada cuota individual
export interface CuotaDetalle {
  idCuota: string; // id del pago
  numeroCuota: number; // cuota_actual
  fechaVencimiento: string; // fecha del pago (ISO)
  monto: number;
  cicloCierre: string | null; // ciclo_cierre
}

// Tipo intermedio para la consulta de resumen
type PagoCuotaRaw = {
  id: string;
  pago_original_id: string | null;
  descripcion: string;
  monto: number;
  fecha: string; // Fecha de vencimiento/pago de la cuota
  cuota_actual: number;
  cuotas: number;
  ciclo_cierre: string | null;
};

// Tipo para los resultados de la eliminación de pagos
export interface ResultadoEliminacionPago {
  pago_id: string;
  exito: boolean;
  mensaje: string;
}

// --- Funciones Helper ---

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount);
}

function formatShortDate(dateString: string | null): string {
    if (!dateString) return 'N/A';
    try {
        return format(parseISO(dateString), "d MMM yy", { locale: es });
    } catch {
        return 'Fecha inválida';
    }
}


// --- Hooks ---

/**
 * Hook para obtener el resumen de compras en cuotas.
 * Agrupa los pagos por pago_original_id.
 */
export function useComprasResumen() {
  return useQuery<CompraResumen[], Error>({
    queryKey: ["comprasResumen"],
    queryFn: async () => {
      const supabase = createClient();
      const hoy = startOfDay(new Date());

      // 1. Obtener todos los pagos que son cuotas y tienen un pago_original_id
      const { data: pagosCuotas, error } = await supabase
        .from("pagos")
        .select("id, pago_original_id, descripcion, monto, fecha, cuota_actual, cuotas, ciclo_cierre")
        .eq("es_cuota", true)
        .not("pago_original_id", "is", null) // Asegura que tengamos ID para agrupar
        .order("pago_original_id") // Ordenar facilita la agrupación
        .order("fecha", { ascending: true }); // Para encontrar la próxima fecha fácilmente

      if (error) {
        console.error("Error fetching quota payments:", error);
        throw new Error(error.message);
      }

      if (!pagosCuotas) {
        return [];
      }

      // 2. Agrupar por pago_original_id en el cliente
      const comprasMap = new Map<string, PagoCuotaRaw[]>();
      (pagosCuotas as PagoCuotaRaw[]).forEach((pago) => {
        // Asegurarse de que pago_original_id no es null (aunque ya filtramos)
        if (pago.pago_original_id) {
            if (!comprasMap.has(pago.pago_original_id)) {
                comprasMap.set(pago.pago_original_id, []);
            }
            comprasMap.get(pago.pago_original_id)!.push(pago);
        }
      });

      // 3. Procesar cada grupo para crear el resumen
      const resumen: CompraResumen[] = [];
      comprasMap.forEach((cuotas, idCompra) => {
        if (cuotas.length === 0) return; // Saltar si no hay cuotas (no debería pasar)

        const primeraCuota = cuotas[0]; // Usar la primera para datos comunes
        const totalCuotas = primeraCuota.cuotas; // Asumimos que es constante por compra
        const montoCuota = primeraCuota.monto; // Asumimos que es constante por compra
        const descripcion = primeraCuota.descripcion;

        let fechaProximaCuota: string | null = null;
        let proximaCuotaMonto: number | null = null;
        let cuotasPagadas = 0; // Contar las ya pasadas o pagadas (aproximación por fecha)

        // Encontrar la próxima cuota pendiente y contar pagadas
        // Ordenamos por fecha al traer los datos, así que la primera futura es la próxima
        for (const cuota of cuotas) {
            try {
                const fechaCuota = parseISO(cuota.fecha);
                if (!isAfter(fechaCuota, hoy)) { // Si la fecha es hoy o anterior
                    cuotasPagadas++;
                } else if (!fechaProximaCuota) { // Si es futura y aún no encontramos la próxima
                    fechaProximaCuota = cuota.fecha;
                    proximaCuotaMonto = cuota.monto;
                    // No hacemos break para seguir contando las pagadas si están desordenadas
                }
            } catch {
                console.warn(`Fecha inválida para cuota ${cuota.id}`);
            }
        }


        resumen.push({
          idCompra,
          descripcion,
          totalCuotas,
          montoCuota,
          fechaProximaCuota,
          proximaCuotaMonto,
          cuotasPagadas
        });
      });

      // Ordenar resumen por fecha de próxima cuota (las que no tienen van al final)
      resumen.sort((a, b) => {
          if (a.fechaProximaCuota && b.fechaProximaCuota) {
              return parseISO(a.fechaProximaCuota).getTime() - parseISO(b.fechaProximaCuota).getTime();
          } else if (a.fechaProximaCuota) {
              return -1; // a tiene fecha, b no -> a va primero
          } else if (b.fechaProximaCuota) {
              return 1; // b tiene fecha, a no -> b va primero
          } else {
              return 0; // ninguna tiene fecha próxima
          }
      });


      return resumen;
    },
     // Opcional: configurar staleTime y cacheTime si se necesita
     // staleTime: 5 * 60 * 1000, // 5 minutos
     // cacheTime: 15 * 60 * 1000, // 15 minutos
  });
}

/**
 * Hook para obtener el detalle de las cuotas de una compra específica.
 * @param idCompra - El pago_original_id de la compra. Si es null, la query no se ejecuta.
 */
export function useCuotasDetalle(idCompra: string | null) {
  return useQuery<CuotaDetalle[], Error>({
    queryKey: ["cuotasDetalle", idCompra],
    queryFn: async () => {
      if (!idCompra) return []; // No ejecutar si no hay idCompra

      const supabase = createClient();
      const { data, error } = await supabase
        .from("pagos")
        .select("id, cuota_actual, fecha, monto, ciclo_cierre")
        .eq("pago_original_id", idCompra)
        .eq("es_cuota", true)
        .order("cuota_actual", { ascending: true }); // Ordenar por número de cuota

      if (error) {
        console.error(`Error fetching quota details for ${idCompra}:`, error);
        throw new Error(error.message);
      }

      // Mapear al tipo CuotaDetalle
      return (data || []).map(p => ({
        idCuota: p.id as string,
        numeroCuota: p.cuota_actual as number,
        fechaVencimiento: p.fecha as string,
        monto: p.monto as number,
        cicloCierre: p.ciclo_cierre as string | null,
      }));
    },
    enabled: !!idCompra, // La query solo se activa si idCompra tiene un valor
    staleTime: 10 * 60 * 1000, // Cachear detalle por 10 minutos
  });
}

/**
 * Hook para eliminar múltiples pagos en lote.
 * Permite eliminar uno o varios pagos, incluyendo pagos en cuotas.
 */
export function useEliminarPagosBatch() {
  const queryClient = useQueryClient();

  return useMutation<ResultadoEliminacionPago[], Error, string[]>({
    mutationFn: async (pagoIds: string[]) => {
      const supabase = createClient();

      // Llamar a la función RPC para eliminar múltiples pagos
      const { data, error } = await supabase
        .rpc('eliminar_pagos_batch', {
          _pago_ids: pagoIds
        });

      if (error) throw error;
      return data as ResultadoEliminacionPago[]; // Devuelve resultados para cada pago
    },
    onSuccess: () => {
      // Invalidar consultas para actualizar la UI
      queryClient.invalidateQueries({ queryKey: ['resumenBase'] });
      queryClient.invalidateQueries({ queryKey: ['comprasResumen'] });
    }
  });
}

// Exportar helpers para uso en el componente
export { formatCurrency, formatShortDate }; 