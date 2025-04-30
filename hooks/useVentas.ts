import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase-browser';
import type { Cliente, CrearVentaParams, Venta, VentaItem, VentaPago } from '@/types/venta';

// Hook para obtener lista de clientes
export function useClientes() {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      return (data || []) as any as Cliente[];
    }
  });
}

// Hook para obtener productos para usarlos en el selector de ventas
export function useProductos() {
  return useQuery({
    queryKey: ['productos'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  });
}

// Hook para crear una venta
export function useCreateVenta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CrearVentaParams) => {
      const supabase = createClient();
      // Calcular subtotales para cada item (si es necesario aquí, aunque RPC lo recalcula)
      const itemsWithSubtotal = params.items.map(item => ({
        ...item,
        subtotal: item.cantidad * item.precio_unitario
      }));

      // Asegurarse de que solo se envían pagos con monto > 0
      const pagosValidos = params.pagos.filter(p => p.monto > 0);

      // Llamar a la función RPC para realizar la venta atomicamente
      const { data, error } = await supabase
        .rpc('realizar_venta', {
          _cliente_data: params.cliente,
          _items: itemsWithSubtotal,
          _pagos: pagosValidos // Pasar los pagos válidos
        });

      if (error) throw error;
      return data as string; // ID de la venta
    },
    onSuccess: () => {
      // Invalidar consultas para actualizar la UI
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      queryClient.invalidateQueries({ queryKey: ['ventas'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    }
  });
}

// Hook para obtener historial de ventas
export function useVentas() {
  return useQuery({
    queryKey: ['ventas'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('ventas')
        .select(`
          *,
          clientes (*)
        `)
        .order('fecha', { ascending: false });

      if (error) throw error;
      
      // Transformar los datos para ajustarlos a nuestra interfaz
      return (data || []).map((venta: any) => ({
        id: venta.id,
        cliente_id: venta.cliente_id,
        fecha: venta.fecha,
        total: venta.total,
        created_at: venta.created_at,
        cliente: venta.clientes as any as Cliente
      })) as Venta[];
    }
  });
}

// Hook para obtener detalle de una venta específica
export function useVentaDetalle(ventaId: string | null) {
  return useQuery({
    queryKey: ['venta', ventaId],
    queryFn: async () => {
      if (!ventaId) return null;
      const supabase = createClient();

      // Obtener venta, cliente y *pagos*
      const { data: ventaData, error: ventaError } = await supabase
        .from('ventas')
        .select(`
          *,
          clientes (*),
          ventas_pagos (*)
        `)
        .eq('id', ventaId)
        .single();

      if (ventaError) throw ventaError;

      // Obtener items de la venta
      const { data: items, error: itemsError } = await supabase
        .from('ventas_items')
        .select(`*, productos (nombre, precio_unit)`)
        .eq('venta_id', ventaId);

      if (itemsError) throw itemsError;

      // Combinar los datos
      return {
        id: ventaData.id,
        cliente_id: ventaData.cliente_id,
        fecha: ventaData.fecha,
        total: ventaData.total,
        created_at: ventaData.created_at,
        cliente: ventaData.clientes as any as Cliente,
        pagos: (ventaData.ventas_pagos as unknown as VentaPago[] | undefined) ?? [],
        items: (items || []).map((item: any) => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          subtotal: item.subtotal,
          producto_nombre: item.productos?.nombre
        }))
      } as Venta;
    },
    enabled: !!ventaId
  });
} 