import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase-browser';

// Interfaz para los resultados de la eliminación de productos
export interface ResultadoEliminacionProducto {
  producto_id: string;
  exito: boolean;
  mensaje: string;
}

// Hook para obtener la lista de productos (si aún no existe, puedes añadirlo aquí)
// export function useProductosList() { ... }


// Hook para eliminar productos en lote
export function useEliminarProductosBatch() {
  const queryClient = useQueryClient();

  return useMutation<ResultadoEliminacionProducto[], Error, string[]>({
    mutationFn: async (productoIds: string[]) => {
      const supabase = createClient();

      // Llamar a la función RPC para eliminar productos en lote
      const { data, error } = await supabase.rpc('eliminar_productos_batch', {
        _producto_ids: productoIds,
      });

      if (error) {
        console.error('Error en RPC eliminar_productos_batch:', error);
        throw new Error(error.message || 'Error al llamar RPC para eliminar productos.');
      }
      return data as ResultadoEliminacionProducto[];
    },
    onSuccess: () => {
      // Invalidar consultas para actualizar la UI, principalmente la lista de productos.
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      // Si tienes otras queries relacionadas con productos que deban actualizarse, añádelas aquí.
    },
    onError: (error) => {
      // Puedes manejar errores globales aquí si lo deseas, o dejar que el componente lo haga.
      console.error("Error en la mutación eliminarProductosBatch:", error);
    }
  });
} 