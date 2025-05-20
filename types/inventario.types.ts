export interface ProductoInventario {
  id: string;
  nombre: string;
  descripcion?: string;
  precio_venta: number;
  precio_costo?: number;
  stock_actual: number;
  stock_minimo?: number;
  codigo_barras?: string;
  categoria_id?: string;
  imagen_url?: string;
  created_at?: string;
  updated_at?: string;
  unidad_medida?: string;
  marca?: string;
  proveedor_id?: string;
  estado?: 'activo' | 'inactivo';
  stock?: number; // Alias de stock_actual para compatibilidad
  sku?: string | null; // Código SKU del producto
  costo_unit?: number | null; // Costo unitario (alias de precio_costo)
  precio_unit?: number | null; // Precio unitario (alias de precio_venta)
}

export type TipoMovimientoStock = 'stock_inicial' | 'entrada_compra' | 'salida_venta' | 'ajuste_manual_positivo' | 'ajuste_manual_negativo' | 'devolucion_cliente' | 'perdida_rotura';

export interface MovimientoStock {
  id: string;
  producto_id: string;
  tipo_movimiento: TipoMovimientoStock;
  cantidad: number;
  stock_anterior: number;
  stock_nuevo: number;
  fecha: string;
  referencia_id?: string;
  notas?: string;
  usuario_email?: string;
  creado_por?: string;
  creado_en?: string;
}

export interface CategoriaProducto {
  id: string;
  nombre: string;
  descripcion?: string;
  created_at?: string;
  color?: string;
  icono?: string;
}

export interface Proveedor {
  id: string;
  nombre: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  notas?: string;
  created_at?: string;
}

export interface AjusteStockPayload {
  producto_id: string;
  cantidad: number;
  tipo_movimiento: MovimientoStock['tipo_movimiento'];
  notas?: string;
  referencia_id?: string;
}

export interface AjusteStockFormValues {
  producto_id: string;
  tipo_movimiento: TipoMovimientoStock;
  cantidad: number;
  notas?: string;
} 