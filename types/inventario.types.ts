export type TipoMovimientoStock =
  | "stock_inicial"
  | "entrada_compra"
  | "salida_venta"
  | "ajuste_manual_positivo"
  | "ajuste_manual_negativo"
  | "devolucion_cliente"
  | "perdida_rotura";

export interface MovimientoStock {
  id: string; // UUID
  producto_id: string; // UUID
  producto_nombre?: string; // Para mostrar en la UI, se obtendrá con un JOIN
  fecha: string; // ISO Date String
  tipo_movimiento: TipoMovimientoStock;
  cantidad: number; // Positivo para entradas, negativo para salidas
  stock_anterior: number;
  stock_nuevo: number;
  referencia_id?: string | null;
  notas?: string | null;
  creado_por?: string | null; // UUID del usuario
  creado_en: string; // ISO Date String
  usuario_email?: string; // Para mostrar en la UI
}

export interface AjusteStockFormValues {
  producto_id: string;
  tipo_movimiento: Extract<TipoMovimientoStock, "ajuste_manual_positivo" | "ajuste_manual_negativo" | "entrada_compra" | "perdida_rotura" | "stock_inicial" | "devolucion_cliente">;
  cantidad: number; // Siempre positivo en el form, el signo se infiere del tipo_movimiento
  notas?: string;
}

// Podrías también querer un tipo para tu producto si no lo tienes ya globalmente
export interface ProductoInventario {
  id: string;
  nombre: string;
  sku?: string | null;
  stock: number;
  costo_unit?: number | null;
  precio_unit?: number | null;
  created_at: string;
  // Cualquier otro campo que tengas
} 