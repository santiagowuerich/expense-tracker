import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase-browser';
import type { Cliente, CrearVentaParams, Venta, VentaItem, VentaPago } from '@/types/venta';
import { endOfDay } from 'date-fns'; // Importar endOfDay

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

      const rpcParams: any = {
        _cliente_data: params.cliente,
        _items: itemsWithSubtotal,
        _pagos: pagosValidos,
      };

      if (params.mensajeInterno !== undefined) {
        rpcParams._mensaje_interno = params.mensajeInterno;
      }
      
      // Añadir el mensaje externo a los parámetros RPC
      if (params.mensajeExterno !== undefined) {
        rpcParams._mensaje_externo = params.mensajeExterno;
      }

      // Llamar a la función RPC para realizar la venta atomicamente
      const { data, error } = await supabase
        .rpc('realizar_venta', rpcParams);

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

// Interfaz para el rango de fechas del filtro
interface DateFilterRange {
  from?: Date;
  to?: Date;
}

// Hook para obtener historial de ventas con filtro de fecha opcional
export function useVentas(filterRange?: DateFilterRange) {
  // Usar las fechas (convertidas a ISO string) en la queryKey para que React Query detecte cambios
  const queryKey = ['ventas', filterRange?.from?.toISOString(), filterRange?.to?.toISOString()];

  return useQuery({
    queryKey: queryKey,
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('ventas')
        .select(`
          *,
          clientes (*)
        `)
        .order('fecha', { ascending: false });

      // Aplicar filtros de fecha si existen
      if (filterRange?.from) {
        // Asegurarse de usar ISO string para la comparación en Supabase
        query = query.gte('fecha', filterRange.from.toISOString());
      }
      if (filterRange?.to) {
        // Incluir todo el día final usando endOfDay
        const endOfDayTo = endOfDay(filterRange.to);
        query = query.lte('fecha', endOfDayTo.toISOString());
      }

      const { data, error } = await query;

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
    // No es necesario 'enabled' aquí, la queryKey maneja el refetch
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

      // Log para depuración
      console.log('Venta Data Raw:', JSON.stringify(ventaData, null, 2));

      // Combinar los datos
      return {
        id: ventaData.id,
        cliente_id: ventaData.cliente_id,
        fecha: ventaData.fecha,
        total: ventaData.total,
        created_at: ventaData.created_at,
        mensajeInterno: ventaData.mensaje_interno,
        mensajeExterno: ventaData.mensaje_externo,
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