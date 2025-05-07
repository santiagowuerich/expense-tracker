'use server'

import { createClient } from '../supabase-server'
import type { VentaDetalle, ClienteDetalle, ProductoVendido, PerfilEmpresa } from '@/lib/types/venta.types'

// Simulación: Deberías tener estas tablas y relaciones en Supabase
// - una tabla 'ventas' (o 'sales')
// - una tabla 'clientes' (o 'customers') relacionada a 'ventas'
// - una tabla 'productos_vendidos' (o 'sale_items') relacionada a 'ventas'
// - una tabla 'productos' (o 'products') referenciada por 'productos_vendidos'

export async function getVentaDetalleById(idVenta: string | number): Promise<{ data: VentaDetalle | null; error: string | null }> {
  const supabase = createClient()
  console.log(`[Server Action] Fetching REAL sale details for ID: ${idVenta}`);

  try {
    const selectVentaQuery = `
      id,
      fecha,
      total,
      cliente_id,
      mensaje_interno,
      mensaje_externo,
      clientes!inner (
        nombre,
        dni_cuit,
        direccion,
        ciudad,
        codigo_postal,
        telefono,
        email
      )
    `;
    const { data: ventaData, error: ventaError } = await supabase
      .from('ventas')
      .select(selectVentaQuery)
      .eq('id', idVenta)
      .single();

    if (ventaError) {
      console.error('[Server Action] Error fetching sale or client data:', JSON.stringify(ventaError, null, 2));
      if (ventaError.code === 'PGRST116') {
        return { data: null, error: 'Venta no encontrada.' };
      }
      return { data: null, error: `Error al obtener datos de la venta: ${ventaError.message}` };
    }

    if (!ventaData) {
      return { data: null, error: 'Venta no encontrada.' };
    }

    const clienteData = Array.isArray(ventaData.clientes) ? ventaData.clientes[0] : ventaData.clientes;
    if (!clienteData) { 
        return { data: null, error: 'Datos del cliente asociados a la venta no encontrados.' };
    }

    const cliente: ClienteDetalle = {
      nombre: clienteData.nombre,
      dniCuit: clienteData.dni_cuit,
      direccion: clienteData.direccion || undefined,
      email: clienteData.email || undefined,
      telefono: clienteData.telefono || undefined,
    };

    const selectItemsQuery = `
      cantidad,
      precio_unitario,
      subtotal,
      productos!inner (
        id,
        nombre
      )
    `;
    const { data: itemsData, error: itemsError } = await supabase
      .from('ventas_items')
      .select(selectItemsQuery)
      .eq('venta_id', idVenta);

    if (itemsError) {
      console.error('[Server Action] Error fetching sale items:', JSON.stringify(itemsError, null, 2));
      return { data: null, error: `Error al obtener productos de la venta: ${itemsError.message}` };
    }

    if (!itemsData || itemsData.length === 0) {
      return { data: null, error: 'No se encontraron productos para esta venta.' };
    }

    const productos: ProductoVendido[] = itemsData.map(item => {
      const productoData = Array.isArray(item.productos) ? item.productos[0] : item.productos;
      if (!productoData) {
        console.warn(`Item de venta sin datos de producto anidados. Venta ID: ${idVenta}, Item:`, item);
        return {
          id: 'desconocido',
          descripcion: 'Producto Desconocido',
          cantidad: item.cantidad,
          precioUnitario: item.precio_unitario,
          subtotal: item.subtotal,
        } as ProductoVendido; // Type assertion
      }
      return {
        id: productoData.id,
        descripcion: productoData.nombre, 
        cantidad: item.cantidad,
        precioUnitario: item.precio_unitario,
        subtotal: item.subtotal,
      };
    }).filter(Boolean) as ProductoVendido[]; // filter(Boolean) para eliminar cualquier nulo/undefined si la lógica anterior lo permitiera

    const subtotalVentaCalculado = productos.reduce((sum, p) => sum + p.subtotal, 0);
    let impuestosCalculados = ventaData.total - subtotalVentaCalculado;
    if (Math.abs(impuestosCalculados) < 0.01) impuestosCalculados = 0;
    if (impuestosCalculados < 0) {
        console.warn(`[Server Action] Total de venta (${ventaData.total}) es menor que la suma de subtotales de items (${subtotalVentaCalculado}) para la venta ID ${idVenta}.`);
    }

    const ventaDetalleFinal: VentaDetalle = {
      idVenta: ventaData.id,
      fecha: ventaData.fecha, 
      cliente: cliente,
      productos: productos,
      subtotalVenta: parseFloat(subtotalVentaCalculado.toFixed(2)),
      impuestos: parseFloat(impuestosCalculados.toFixed(2)), 
      totalVenta: ventaData.total,
      mensaje_interno: ventaData.mensaje_interno || undefined,
      mensaje_externo: ventaData.mensaje_externo || undefined,
    };

    return { data: ventaDetalleFinal, error: null };

  } catch (e: any) {
    console.error('[Server Action] Unexpected error in getVentaDetalleById:', e);
    return { data: null, error: e.message || 'Error inesperado al procesar la solicitud.' };
  }
} 