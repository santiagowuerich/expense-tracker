import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase-browser';
import type { Cliente, CrearVentaParams, Venta, VentaItem, VentaPago } from '@/types/venta';
import { endOfDay } from 'date-fns'; // Importar endOfDay

// Hook para obtener lista de clientes (modificado para búsqueda)
export function useClientes(searchTerm?: string) {
  return useQuery<Cliente[], Error>({
    queryKey: ['clientes', searchTerm],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('clientes')
        .select('*')
        .order('nombre', { ascending: true });

      if (searchTerm && searchTerm.trim() !== '') {
        const cleanedSearchTerm = searchTerm.trim();
        // Filtrar por nombre o dni_cuit usando ilike
        query = query.or(`nombre.ilike.%${cleanedSearchTerm}%,dni_cuit.ilike.%${cleanedSearchTerm}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error en Supabase (useClientes):", error);
        throw new Error(error.message);
      }
      
      // Filtrar clientes duplicados por dni_cuit
      const clientesFiltrados: Cliente[] = [];
      const dniCuitSet = new Set<string>();
      
      (data || []).forEach(cliente => {
        if (!dniCuitSet.has(cliente.dni_cuit)) {
          dniCuitSet.add(cliente.dni_cuit);
          clientesFiltrados.push(cliente);
        }
      });
      
      return clientesFiltrados as Cliente[];
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

// Hook para obtener ventas por cliente
export function useVentasPorCliente(clienteId: string | null) {
  return useQuery<Venta[], Error>({
    queryKey: ['ventas_cliente', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      
      const supabase = createClient();
      
      // Primero obtenemos el cliente para conocer su DNI/CUIT
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('dni_cuit')
        .eq('id', clienteId)
        .single();
        
      if (clienteError) {
        console.error('Error al obtener datos del cliente:', clienteError);
        throw new Error(clienteError.message);
      }
      
      if (!clienteData || !clienteData.dni_cuit) {
        console.error('Cliente no encontrado o sin DNI/CUIT');
        return [];
      }
      
      // Luego obtenemos todos los clientes con ese mismo DNI/CUIT
      const { data: clientesIds, error: clientesError } = await supabase
        .from('clientes')
        .select('id')
        .eq('dni_cuit', clienteData.dni_cuit);
        
      if (clientesError) {
        console.error('Error al obtener IDs de clientes con mismo DNI/CUIT:', clientesError);
        throw new Error(clientesError.message);
      }
      
      if (!clientesIds || clientesIds.length === 0) {
        return [];
      }
      
      // Extraemos los IDs para la consulta IN
      const ids = clientesIds.map(c => c.id);
      
      // Ahora buscamos ventas para todos los IDs de clientes con el mismo DNI/CUIT
      const { data: ventasData, error: ventasError } = await supabase
        .from('ventas')
        .select('*, clientes(*)')
        .in('cliente_id', ids)
        .order('fecha', { ascending: false });
        
      if (ventasError) {
        console.error('Error al obtener ventas de los clientes:', ventasError);
        throw new Error(ventasError.message);
      }
      
      return (ventasData || []).map((venta: any) => ({
        id: venta.id,
        cliente_id: venta.cliente_id,
        fecha: venta.fecha,
        total: venta.total,
        created_at: venta.created_at,
        cliente: venta.clientes as any as Cliente,
        pagos: venta.pagos || [],
      })) as Venta[];
    },
    enabled: !!clienteId
  });
}

// Hook para crear una venta
export function useCreateVenta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CrearVentaParams) => {
      const supabase = createClient();
      
      try {
        // ENFOQUE COMPLETAMENTE MANUAL: construir objetos nuevos con solo los campos necesarios
        
        // Cliente: incluir solo los campos básicos
        const clienteData = {
          nombre: params.cliente.nombre,
          dni_cuit: params.cliente.dni_cuit,
          direccion: params.cliente.direccion || null,
          ciudad: params.cliente.ciudad || null,
          codigo_postal: params.cliente.codigo_postal || null,
          telefono: params.cliente.telefono || null,
          email: params.cliente.email || null
        };
        
        // Items: solo los tres campos requeridos
        const itemsData = params.items.map(item => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
        subtotal: item.cantidad * item.precio_unitario
      }));

        // Pagos: incluir metodo_pago, monto, y opcionalmente cuotas y recargo
        const pagosData = params.pagos
          .filter(pago => typeof pago.monto === 'number' && pago.monto >= 0) // Permitir monto 0 si es necesario
          .map(pago => {
            const pagoParaEnviar: any = { // Usar 'any' temporalmente o definir un tipo local más estricto si se prefiere
              metodo_pago: pago.metodo_pago,
              monto: pago.monto
            };
            // Incluir cuotas y recargo solo si están definidos y son relevantes
            if (pago.metodo_pago === "Tarjeta Crédito") {
              if (typeof pago.cuotas === 'number') {
                pagoParaEnviar.cuotas = pago.cuotas;
              }
              if (typeof pago.recargo === 'number') {
                pagoParaEnviar.recargo = pago.recargo;
              }
            }
            return pagoParaEnviar;
          });
        
        // Construir parámetros para la RPC directamente, sin JSON.parse/stringify
        const rpcParams = {
          _cliente_data: clienteData,
          _items: itemsData,
          _pagos: pagosData,
          _mensaje_interno: params.mensajeInterno || null,
          _mensaje_externo: params.mensajeExterno || null
        };
        
        console.log("Enviando RPC realizar_venta con parámetros:", JSON.stringify(rpcParams, null, 2));

      // Llamar a la función RPC para realizar la venta atomicamente
      const { data, error } = await supabase
        .rpc('realizar_venta', rpcParams);

        if (error) {
          console.error("Error detallado de RPC:", JSON.stringify(error, null, 2));
          throw error;
        }
        
      return data as string; // ID de la venta
      } catch (err) {
        console.error("Error en try/catch de RPC:", err);
        throw err;
      }
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

// Interfaz para los resultados de eliminación de ventas
export interface ResultadoEliminacionVenta {
  venta_id: string;
  exito: boolean;
  mensaje: string;
}

// Hook para obtener historial de ventas con filtro de fecha opcional y filtro de búsqueda
export function useVentas(filterRange?: DateFilterRange, searchTerm?: string) {
  const queryKey = ['ventas', filterRange?.from?.toISOString(), filterRange?.to?.toISOString(), searchTerm];

  return useQuery({
    queryKey: queryKey,
    queryFn: async () => {
      const supabase = createClient();
      let query;
      const trimmedSearchTerm = searchTerm?.trim();

      if (trimmedSearchTerm) {
        // Cuando se busca, queremos un INNER JOIN implícito con clientes
        // y filtrar por el nombre DEL CLIENTE o su DNI/CUIT.
        query = supabase
          .from('ventas')
          .select('*, clientes!inner(*)') // Forza INNER JOIN
          .or(
            `nombre.ilike.%${trimmedSearchTerm}%,` +
            `dni_cuit.ilike.%${trimmedSearchTerm}%`,
            { referencedTable: 'clientes' }
          );
      } else {
        // Comportamiento por defecto: LEFT JOIN con clientes
        query = supabase
          .from('ventas')
          .select('*, clientes(*)');
      }

      // Aplicar ordenamiento común y filtros de fecha
      query = query.order('fecha', { ascending: false });

      if (filterRange?.from) {
        query = query.gte('fecha', filterRange.from.toISOString());
      }
      if (filterRange?.to) {
        const endOfDayTo = endOfDay(filterRange.to);
        query = query.lte('fecha', endOfDayTo.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error en la consulta de Supabase para ventas:', error);
        throw error;
      }

      // Transformar los datos para ajustarlos a nuestra interfaz
      return (data || []).map((venta: any) => ({
        id: venta.id,
        cliente_id: venta.cliente_id,
        fecha: venta.fecha,
        total: venta.total,
        created_at: venta.created_at,
        cliente: venta.clientes as any as Cliente,
        pagos: venta.pagos || [],
      })) as Venta[];
    },
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

// Hook para eliminar ventas en lote
export function useEliminarVentasBatch() {
  const queryClient = useQueryClient();
  
  return useMutation<ResultadoEliminacionVenta[], Error, string[]>({
    mutationFn: async (ventaIds: string[]) => {
      const supabase = createClient();
      
      // Llamar a la función RPC para eliminar ventas en lote
      const { data, error } = await supabase.rpc('eliminar_ventas_batch', {
        _venta_ids: ventaIds
      });
      
      if (error) throw new Error(error.message);
      return data as ResultadoEliminacionVenta[];
    },
    onSuccess: () => {
      // Invalidar consultas para actualizar la UI
      queryClient.invalidateQueries({ queryKey: ['ventas'] });
      queryClient.invalidateQueries({ queryKey: ['productos'] }); // Por si se restaura stock
    }
  });
} 