import { useQuery } from '@tanstack/react-query';
import { getVentaDetalleById } from '@/lib/actions/venta.actions';
import type { VentaDetalle } from '@/lib/types/venta.types';

export const RQ_KEY_VENTA_DETALLE = (idVenta: string | number | undefined) => ['ventaDetalle', idVenta];

async function fetchVentaDetalle(idVenta: string | number): Promise<VentaDetalle | null> {
  if (!idVenta) return null; // No intentar buscar si no hay ID
  const result = await getVentaDetalleById(idVenta);
  if (result.error || !result.data) {
    console.error(`Error fetching sale detail for ID ${idVenta}:`, result.error);
    // Podrías lanzar un error aquí para que React Query lo maneje:
    // throw new Error(result.error || "No se encontraron detalles de la venta.");
    return null;
  }
  return result.data;
}

export function useVentaDetalle(idVenta: string | number | undefined, options?: { enabled?: boolean }) {
  return useQuery<VentaDetalle | null, Error>({
    queryKey: RQ_KEY_VENTA_DETALLE(idVenta),
    queryFn: () => fetchVentaDetalle(idVenta!), // El ! es seguro aquí debido a la comprobación `enabled`
    enabled: !!idVenta && (options?.enabled !== undefined ? options.enabled : true),
    // Configuraciones adicionales de React Query si son necesarias (ej. staleTime, gcTime)
  });
} 