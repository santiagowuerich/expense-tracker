export interface PerfilEmpresa {
  businessName: string;
  cuit: string;
  address: string;
  ivaCondition: string;
  // Podrías añadir más campos como teléfono, email, etc. si los tienes
}

export interface ClienteDetalle {
  nombre: string;
  dniCuit: string;
  direccion?: string;
  email?: string;
  telefono?: string;
}

export interface ProductoVendido {
  id: string | number;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number; // cantidad * precioUnitario
}

export interface VentaDetalle {
  idVenta: string | number;
  fecha: Date | string;
  cliente: ClienteDetalle;
  productos: ProductoVendido[];
  subtotalVenta: number;
  impuestos?: number; // Opcional, o un objeto más detallado de impuestos
  totalVenta: number;
  mensaje_interno?: string | null;
  mensaje_externo?: string | null;
  // Podrías añadir notas, método de pago, etc.
} 