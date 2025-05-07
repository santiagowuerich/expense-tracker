// Tipos para el sistema de ventas

export interface Cliente {
  id?: string;
  nombre: string;
  dni_cuit: string;
  direccion?: string;
  ciudad?: string;
  codigo_postal?: string;
  telefono?: string;
  email?: string;
}

export interface ProductoParaVenta {
  id: string;
  nombre: string;
  precio: number;
  stock: number;
  cantidad?: number; // Para el formulario de venta
}

export interface VentaItem {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  subtotal?: number; // Calculado: cantidad * precio_unitario
}

export interface VentaPago {
  metodo_pago: string;
  monto: number;
}

export interface CrearVentaParams {
  cliente: Cliente;
  items: VentaItem[];
  pagos: VentaPago[];
  mensajeInterno?: string;
  mensajeExterno?: string;
}

export interface Venta {
  id: string;
  cliente_id: string;
  fecha: string;
  total: number;
  created_at: string;
  cliente?: Cliente;
  items?: (VentaItem & { producto_nombre?: string })[]; // Mantenemos el tipo detallado para items
  pagos?: VentaPago[]; // Añadido para los pagos
  mensajeInterno?: string;
  mensajeExterno?: string | null;
} 