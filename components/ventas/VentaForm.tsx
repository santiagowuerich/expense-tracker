"use client";

import { useState, useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCreateVenta, useProductos } from "@/hooks/useVentas";
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, Trash2, AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmationPdfModal from "@/components/confirmation-pdf-modal";
import { Textarea } from "@/components/ui/textarea";

// Métodos de pago disponibles
const METODOS_PAGO = [
  "Efectivo",
  "Tarjeta Débito",
  "Tarjeta Crédito",
  "Transferencia",
  "Mercado Pago",
  // Agrega otros métodos si es necesario
];

// Esquema de validación Zod
const ventaFormSchema = z.object({
  cliente: z.object({
    nombre: z.string().min(3, { message: "El nombre es requerido" }),
    dni_cuit: z.string().min(7, { message: "El DNI/CUIT es requerido" }),
    direccion: z.string().optional(),
    ciudad: z.string().optional(),
    codigo_postal: z.string().optional(),
    telefono: z.string().optional(),
    email: z.string().email({ message: "Email inválido" }).optional().or(z.literal('')),
  }),
  items: z.array(
    z.object({
      producto_id: z.string().min(1, { message: "Seleccione un producto" }),
      cantidad: z.coerce.number().int().positive(),
      precio_unitario: z.coerce.number().positive(),
    })
  ).min(1, { message: "Agregue al menos un producto" }),
  // Nuevo campo para los pagos
  pagos: z.array(
    z.object({
      metodo_pago: z.string(),
      monto: z.coerce.number().min(0, { message: "El monto no puede ser negativo" }),
    })
  ).optional(), // Opcional inicialmente, se valida con refine
  mensajeInterno: z.string().optional(),
  mensajeExterno: z.string().optional(),
})
.refine((data) => {
  // Calcular total de items
  const totalItems = data.items.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
  // Calcular total pagado
  const totalPagado = (data.pagos ?? []).reduce((sum, pago) => sum + pago.monto, 0);
  
  // Permitir una pequeña diferencia por redondeo
  return Math.abs(totalItems - totalPagado) < 0.01;
}, {
  message: "La suma de los pagos debe coincidir con el total de la venta.",
  path: ["pagos"], // Aplicar el error al array de pagos en general
});

type VentaFormValues = z.infer<typeof ventaFormSchema>;

export function VentaForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const createVenta = useCreateVenta();
  const { data: productos, isLoading: isLoadingProductos } = useProductos();
  const [productosDisponibles, setProductosDisponibles] = useState<any[]>([]);

  // Estados para el nuevo modal de PDF
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [generatedVentaId, setGeneratedVentaId] = useState<string | number | undefined>(undefined);

  const form = useForm<VentaFormValues>({
    resolver: zodResolver(ventaFormSchema),
    defaultValues: {
      cliente: { 
        nombre: "", 
        dni_cuit: "",
        direccion: "", // Inicializar explícitamente los opcionales a ""
        ciudad: "",      // Inicializar explícitamente los opcionales a ""
        codigo_postal: "",// Inicializar explícitamente los opcionales a ""
        telefono: "",   // Inicializar explícitamente los opcionales a ""
        email: "",       // Inicializar explícitamente los opcionales a ""
      },
      items: [{ producto_id: "", cantidad: 1, precio_unitario: 0 }],
      pagos: [],
      mensajeInterno: "",
      mensajeExterno: "",
    },
  });

  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({
    name: "items",
    control: form.control,
  });

  const { fields: pagoFields, append: appendPago, remove: removePago } = useFieldArray({
    name: "pagos",
    control: form.control,
  });

  // Obtener valores actuales del formulario para cálculos
  const currentItems = form.watch("items");
  const currentPagos = form.watch("pagos") ?? []; // Asegurar que sea un array

  // --- Cálculos directos (reemplazan useMemo) ---
  const totalVentaCalculado = currentItems.reduce((sum, item) => {
    const cantidad = Number(item.cantidad) || 0;
    const precio = Number(item.precio_unitario) || 0;
    return sum + cantidad * precio;
  }, 0);

  const totalPagadoCalculado = currentPagos.reduce((sum, pago) => {
    return sum + (Number(pago.monto) || 0);
  }, 0);

  const montoRestante = totalVentaCalculado - totalPagadoCalculado;

  // --- Cargar Productos --- 
  useEffect(() => {
    if (productos) {
      const prods = (productos as any[])
        .filter((p) => p.stock > 0)
        .map((p) => ({
          id: p.id,
          nombre: p.nombre,
          precio: p.precio_unit || 0, // Usar precio_unit de la tabla productos
          stock: p.stock,
        }));
      setProductosDisponibles(prods);
    }
  }, [productos]);

  // Estado para rastrear si un monto fue modificado manualmente por el usuario
  // Las claves serán los labels de METODOS_PAGO (ej. "Efectivo", "Tarjeta Débito")
  const [manualOverride, setManualOverride] = useState<Record<string, boolean>>(
    METODOS_PAGO.reduce((acc, methodLabel) => {
      acc[methodLabel] = false;
      return acc;
    }, {} as Record<string, boolean>)
  );

  // Efecto para recalcular montos automáticamente
  useEffect(() => {
    const activePagos = (form.getValues("pagos") || []).filter(p => p !== undefined && p !== null);
    const currentTotalVenta = currentItems.reduce((sum, item) => sum + (Number(item.cantidad) || 0) * (Number(item.precio_unitario) || 0), 0);


    if (activePagos.length === 1) {
      const pagoActual = activePagos[0];
      const metodo = pagoActual.metodo_pago;
      const indexToUpdate = (form.getValues("pagos") || []).findIndex(p => p?.metodo_pago === metodo);

      if (indexToUpdate !== -1 && !manualOverride[metodo]) {
        if (form.getValues(`pagos.${indexToUpdate}.monto`) !== currentTotalVenta) {
          form.setValue(`pagos.${indexToUpdate}.monto`, currentTotalVenta, { shouldValidate: true, shouldDirty: true });
        }
      }
    } else if (activePagos.length === 2) {
      const amountPerMethod = currentTotalVenta / 2;
      activePagos.forEach((pagoActual) => {
        const metodo = pagoActual.metodo_pago;
        const indexToUpdate = (form.getValues("pagos") || []).findIndex(p => p?.metodo_pago === metodo);

        if (indexToUpdate !== -1 && !manualOverride[metodo]) {
          if (form.getValues(`pagos.${indexToUpdate}.monto`) !== amountPerMethod) {
            form.setValue(`pagos.${indexToUpdate}.monto`, amountPerMethod, { shouldValidate: true, shouldDirty: true });
          }
        }
      });
    }
    // Si hay 0, 3 o más métodos seleccionados, no se auto-asigna ningún monto.
    // Los montos se ingresan manualmente o permanecen en 0 si es un nuevo método.
    // Al deseleccionar, el monto se pone a 0 (o el item se remueve) y el override se resetea.
  }, [form.watch("pagos"), totalVentaCalculado, manualOverride, form, currentItems]);

  // --- Manejo de Selección de Pagos MODIFICADO ---
  const handleMetodoPagoChange = (metodo: string, checked: boolean | string) => {
    // Asegurarse que 'checked' es un booleano
    const isChecked = typeof checked === 'boolean' ? checked : checked === 'true';
    const currentPagosArray = form.getValues("pagos") || [];
    const index = currentPagosArray.findIndex((field: any) => field.metodo_pago === metodo);

    if (isChecked && index === -1) {
      // Agregar método si no existe
      appendPago({ metodo_pago: metodo, monto: 0 }); 
      // El useEffect se encargará de la auto-asignación si aplica
    } else if (!isChecked && index !== -1) {
      // Remover método si existe
      removePago(index);
      // Resetear el override manual para este método
      setManualOverride(prev => ({ ...prev, [metodo]: false }));
    }
  };

  // --- Funciones Auxiliares (Refinar onChange para robustez) --- 
  const actualizarPrecioPorProducto = (index: number, productoId: string) => {
    const producto = productosDisponibles.find((p) => p.id === productoId);
    if (producto) {
      // Usar setValue para asegurar la actualización inmediata del estado del form
      form.setValue(`items.${index}.precio_unitario`, producto.precio, { shouldValidate: true });
    }
  };

  const handleCantidadChange = (index: number, valueString: string) => {
    const cantidad = parseInt(valueString) || 0; // Convertir a número, default a 0 si es inválido
    form.setValue(`items.${index}.cantidad`, cantidad, { shouldValidate: true });

    // Validar stock inmediatamente después de actualizar el valor
    const productoId = form.getValues(`items.${index}.producto_id`);
    if (productoId) {
      const producto = productosDisponibles.find(p => p.id === productoId);
      if (producto && cantidad > producto.stock) {
        form.setError(`items.${index}.cantidad`, {
          type: "manual",
          message: `Máx: ${producto.stock}`
        });
      } else {
        form.clearErrors(`items.${index}.cantidad`);
      }
    }
  };
  
  const handlePrecioChange = (index: number, valueString: string) => {
      const precio = parseFloat(valueString) || 0; // Convertir a número float
      form.setValue(`items.${index}.precio_unitario`, precio, { shouldValidate: true });
  };

  // Mover esta función aquí para que esté disponible en onSubmit
  const verificarStockDisponible = (productoId: string, cantidad: number): boolean => {
    const producto = productosDisponibles.find((p) => p.id === productoId);
    return producto ? producto.stock >= cantidad : false;
  };

  // --- Manejo de Cambio de Monto en Pagos MODIFICADO ---
  const handlePagoMontoChange = (index: number, valueString: string) => {
    const monto = parseFloat(valueString); // No default a 0 aquí, permitir NaN para validación
    
    // Permitir que el campo quede vacío temporalmente o sea inválido para que Zod lo maneje
    if (isNaN(monto) && valueString.trim() !== "" && valueString.trim() !== "-") {
        form.setValue(`pagos.${index}.monto`, 0 / 0, { shouldValidate: true, shouldDirty: true }); // Set to NaN
    } else {
        form.setValue(`pagos.${index}.monto`, isNaN(monto) ? 0 : monto, { shouldValidate: true, shouldDirty: true });
    }

    const metodoDelPago = form.getValues(`pagos.${index}.metodo_pago`);
    if (metodoDelPago) {
      // Marcar override manual solo si el valor es un número válido o string vacío (para permitir borrar)
      // Si es un string inválido (ej. "abc"), no necesariamente es un override intencional del *valor*
      if (!isNaN(monto) || valueString.trim() === "") {
        setManualOverride(prev => ({ ...prev, [metodoDelPago]: true }));
      }
    }
  };

  // --- Submit --- 
  const onSubmit = async (values: VentaFormValues) => {
      // Re-validar suma de pagos aquí por si acaso
      const totalItems = values.items.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
      const totalPagado = (values.pagos ?? []).reduce((sum, pago) => sum + pago.monto, 0);
      if (Math.abs(totalItems - totalPagado) >= 0.01) {
          toast({ title: "Error de Validación", description: "La suma de los pagos no coincide con el total.", variant: "destructive" });
          form.setError("pagos", { type: "manual", message: "La suma de los pagos debe coincidir con el total." });
          return;
      }
      
      // Verificar stock antes de enviar
      for (const item of values.items) {
        if (!verificarStockDisponible(item.producto_id, item.cantidad)) {
          const producto = productosDisponibles.find((p) => p.id === item.producto_id);
          toast({ title: "Stock insuficiente", description: `Stock para ${producto?.nombre}: ${producto?.stock}`, variant: "destructive" });
          return;
        }
      }

    try {
      // Filtrar pagos con monto 0 antes de enviar
      const pagosParaEnviar = (values.pagos ?? []).filter(p => p.monto > 0);
      
      // LLAMAR A LA MUTACIÓN Y OBTENER EL ID DE VENTA
      const ventaId = await createVenta.mutateAsync({
          cliente: values.cliente,
          items: values.items,
          pagos: pagosParaEnviar,
          mensajeInterno: values.mensajeInterno,
          mensajeExterno: values.mensajeExterno,
      });
      
      // ABRIR EL MODAL DE CONFIRMACIÓN Y PDF
      setGeneratedVentaId(ventaId); // Guardar el ID de la venta generada
      setIsPdfModalOpen(true); // Abrir el modal de PDF
      
      // El toast de "Venta realizada" se puede mover al modal de PDF o al onPdfGenerated
      
    } catch (error: any) {
      console.error("Error RPC:", error); // Log detallado
      toast({ title: "Error al realizar la venta", description: error.message || "Hubo un problema.", variant: "destructive" });
    }
  };

  const agregarProducto = () => {
    appendItem({ producto_id: "", cantidad: 1, precio_unitario: 0 });
  };

  const handlePdfModalClosed = () => {
    // Esta función se llama cuando el modal de PDF se cierra
    toast({ title: "Proceso de Venta Finalizado", description: "La venta se registró y el PDF se procesó." });
    
    // Primero, resetear el formulario para limpiar los datos.
    form.reset(); 
    
    // Luego, limpiar el ID de venta generado.
    setGeneratedVentaId(undefined); 
    
    // Finalmente, llamar a onSuccess para cerrar el VentaForm (o notificar al padre).
    onSuccess(); 
  };

  // --- Renderizado --- 
  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Sección Cliente (sin cambios) */}
          <div>
            <h3 className="text-lg font-medium mb-4">Datos del Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cliente.nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre completo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Juan Pérez" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cliente.dni_cuit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DNI/CUIT *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: 12345678" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cliente.telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: 3415123456" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cliente.email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="ejemplo@email.com" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cliente.direccion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección</FormLabel>
                    <FormControl>
                      <Input placeholder="Calle y número" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cliente.ciudad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ciudad</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Rosario" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cliente.codigo_postal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código Postal</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: 2000" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator className="my-4" />

          {/* Sección Productos (sin cambios estructurales, solo usa itemFields) */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Productos</h3>
              <Button type="button" onClick={agregarProducto} variant="outline" size="sm">Agregar Producto</Button>
            </div>
            {isLoadingProductos ? (
               <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : productosDisponibles.length === 0 ? (
               <p className="text-muted-foreground">No hay productos con stock.</p>
            ) : (
              <div className="space-y-4">
                {itemFields.map((field, index) => (
                  <Card key={field.id} className="relative">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-12 md:col-span-5">
                          <FormField
                            control={form.control}
                            name={`items.${index}.producto_id`}
                            render={({ field: selectField }) => (
                              <FormItem>
                                <FormLabel>Producto *</FormLabel>
                                <Select
                                  value={selectField.value || ""}
                                  onValueChange={(value) => {
                                    selectField.onChange(value);
                                    actualizarPrecioPorProducto(index, value);
                                  }}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleccionar producto" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {productosDisponibles.map((producto) => (
                                      <SelectItem key={producto.id} value={producto.id}>
                                        {producto.nombre}{" "}
                                        <span className="ml-2 text-muted-foreground">
                                          (Stock: {producto.stock})
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-6 md:col-span-2">
                          <FormField
                            control={form.control}
                            name={`items.${index}.cantidad`}
                            render={({ field: cantidadField }) => (
                              <FormItem>
                                <FormLabel>Cantidad *</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={1}
                                    {...cantidadField}
                                    value={cantidadField.value || 0}
                                    onChange={(e) => handleCantidadChange(index, e.target.value)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-6 md:col-span-3">
                          <FormField
                            control={form.control}
                            name={`items.${index}.precio_unitario`}
                            render={({ field: precioField }) => (
                              <FormItem>
                                <FormLabel>Precio *</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    {...precioField}
                                    value={precioField.value || 0}
                                    onChange={(e) => handlePrecioChange(index, e.target.value)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-10 md:col-span-2 flex items-end">
                          <div className="w-full text-right">
                            <p className="text-sm font-medium">Subtotal:</p>
                            <p className="text-lg font-semibold">
                              ${((form.watch(`items.${index}.cantidad`) || 0) * 
                                 (form.watch(`items.${index}.precio_unitario`) || 0)).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="absolute right-4 top-4">
                          {itemFields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {itemFields.length > 0 && (
              <div className="flex justify-end mt-4">
                <div className="text-right">
                  <p className="text-sm font-medium">Total de la venta:</p>
                  <p className="text-2xl font-bold">${totalVentaCalculado.toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>

          <Separator className="my-4" />

          {/* NUEVO CAMPO: Mensaje Interno / Observaciones */}
          <div>
            <FormField
              control={form.control}
              name="mensajeInterno"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensaje Interno / Observaciones (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Anotaciones para esta venta, detalles de entrega, etc."
                      className="resize-none"
                      {...field}
                      value={field.value || ''} // Para asegurar que sea controlado
                    />
                  </FormControl>
                  <FormDescription>
                    Este mensaje es para uso interno y no aparecerá en el comprobante del cliente por defecto.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* MENSAJE EXTERNO (PARA EL CLIENTE) */}
          <FormField
            control={form.control}
            name="mensajeExterno"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mensaje para el Cliente (visible en PDF)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Ej: Gracias por su compra. Por favor, revisar los productos al recibir."
                    className="resize-none"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Este mensaje aparecerá en el comprobante PDF del cliente.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* FIN MENSAJE EXTERNO */}

          <Separator className="my-6" />

          {/* --- Sección Formas de Pago (NUEVO) --- */}
          <div>
            <h3 className="text-lg font-medium mb-4">Formas de Pago</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
              {METODOS_PAGO.map((metodo) => (
                <FormField
                  key={metodo}
                  control={form.control}
                  name={`_control_pago_${metodo}` as any}
                  render={() => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                      <FormControl>
                         <Checkbox
                            checked={pagoFields.some((field) => field.metodo_pago === metodo)}
                            onCheckedChange={(checked) => handleMetodoPagoChange(metodo, checked)}
                         />
                      </FormControl>
                      <FormLabel className="font-normal">{metodo}</FormLabel>
                    </FormItem>
                  )}
                />
              ))}
            </div>

            {/* Campos de Monto para métodos seleccionados */}
            {pagoFields.length > 0 && (
              <div className="space-y-4 mt-4 border p-4 rounded-md">
                <h4 className="font-medium">Ingresar Montos</h4>
                {pagoFields.map((field, index) => (
                  <FormField
                    key={field.id}
                    control={form.control}
                    name={`pagos.${index}.monto`}
                    render={({ field: montoField }) => (
                      <FormItem className="flex items-center gap-4">
                        <FormLabel className="w-32 shrink-0">{field.metodo_pago}:</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...montoField}
                            value={montoField.value || 0}
                            onChange={(e) => handlePagoMontoChange(index, e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            )}

            {/* Resumen de Pagos y Total */}
            <div className="mt-6 flex justify-end items-center gap-6 border-t pt-4">
               {/* Mostrar error de validación general de pagos si existe */}
               {form.formState.errors.pagos?.message && (
                 <div className="text-sm text-destructive flex items-center gap-1 mr-auto">
                    <AlertCircle className="h-4 w-4"/>
                    {form.formState.errors.pagos.message}
                 </div>
               )}
              
               <div className="text-right">
                  <p className="text-sm font-medium">Total Pagado:</p>
                  <p className={`text-lg font-semibold ${montoRestante !== 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    ${totalPagadoCalculado.toFixed(2)}
                  </p>
               </div>
               <div className="text-right">
                  <p className="text-sm font-medium">Total Venta:</p>
                  <p className="text-lg font-semibold">${totalVentaCalculado.toFixed(2)}</p>
               </div>
               <div className="text-right">
                  <p className="text-sm font-medium">Restante:</p>
                  <p className={`text-lg font-bold ${montoRestante !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                     ${montoRestante.toFixed(2)}
                  </p>
               </div>
            </div>
          </div>
          
          {/* Botones de Acción (sin cambios estructurales) */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onSuccess}>Cancelar</Button>
            <Button 
              type="submit" 
              disabled={createVenta.isPending || isLoadingProductos || Math.abs(montoRestante) >= 0.01 || form.formState.isSubmitting}
            >
              { (createVenta.isPending || form.formState.isSubmitting) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              { (createVenta.isPending || form.formState.isSubmitting) ? "Procesando..." : "Finalizar Venta"}
            </Button>
          </div>
        </form>
      </Form>

      {/* RENDERIZAR EL MODAL DE CONFIRMACIÓN Y PDF */}
      <ConfirmationPdfModal 
          open={isPdfModalOpen} 
          onOpenChange={setIsPdfModalOpen} 
          idVenta={generatedVentaId} 
          onPdfGeneratedProp={handlePdfModalClosed}
      />
    </>
  );
} 