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
import { Separator } from "@/components/ui/separator";
import { Loader2, Trash2, AlertCircle, ChevronsUpDown, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmationPdfModal from "@/components/confirmation-pdf-modal";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

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
  pagos: z.array(
    z.object({
      metodo_pago: z.string(),
      monto: z.coerce.number().min(0, { message: "El monto no puede ser negativo" }),
      cuotas: z.number().int().optional(),
      recargo: z.number().optional(),
    })
  ).optional(),
  mensajeInterno: z.string().optional(),
  mensajeExterno: z.string().optional(),
})
.refine((data) => {
  const totalItemsBase = data.items.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
  
  const totalRecargosMonetarios = (data.pagos ?? []).reduce((sum, pago) => {
    if (pago.metodo_pago === "Tarjeta Crédito" && pago.cuotas && pago.cuotas > 1 && pago.recargo && pago.recargo > 0 && pago.monto > 0) {
      const recargoDelPago = pago.monto - (pago.monto / (1 + pago.recargo));
      return sum + recargoDelPago;
    }
    return sum;
  }, 0);

  const totalGeneralEsperado = totalItemsBase + totalRecargosMonetarios;
  const totalEfectivamentePagado = (data.pagos ?? []).reduce((sum, pago) => sum + pago.monto, 0);
  
  // Permitir una pequeña diferencia por redondeo
  return Math.abs(totalGeneralEsperado - totalEfectivamentePagado) < 0.01;
}, {
  message: "La suma de los pagos debe coincidir con el total de la venta (incluyendo recargos).",
  path: ["pagos"], 
});

type VentaFormValues = z.infer<typeof ventaFormSchema>;

export function VentaForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const createVenta = useCreateVenta();
  const { data: productos, isLoading: isLoadingProductos } = useProductos();
  const [productosDisponibles, setProductosDisponibles] = useState<any[]>([]);
  const [productosFiltrados, setProductosFiltrados] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");

  // Estados para el nuevo modal de PDF
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [generatedVentaId, setGeneratedVentaId] = useState<string | number | undefined>(undefined);

  // Estados para manejar cuotas y recargos de tarjeta
  const [cuotasTarjeta, setCuotasTarjeta] = useState<Record<string, { cuotas: number, recargo: number }>>({});
  
  // Estado para manejar los Popovers de selección de producto
  const [openComboboxes, setOpenComboboxes] = useState<Record<number, boolean>>({});


  const form = useForm<VentaFormValues>({
    resolver: zodResolver(ventaFormSchema),
    defaultValues: {
      cliente: { 
        nombre: "", 
        dni_cuit: "",
        direccion: "", 
        ciudad: "",      
        codigo_postal: "",
        telefono: "",   
        email: "",       
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

  const currentItems = form.watch("items");
  const currentPagos = form.watch("pagos") ?? []; 

  // Total de productos (sin recargos)
  const totalVentaProductos = currentItems.reduce((sum, item) => {
    const cantidad = Number(item.cantidad) || 0;
    const precio = Number(item.precio_unitario) || 0;
    return sum + cantidad * precio;
  }, 0);

  // Calcular recargos totales aplicados
  const totalRecargosAplicados = useMemo(() => {
    return (currentPagos ?? []).reduce((sum, pago) => {
      if (pago.metodo_pago === "Tarjeta Crédito" && pago.cuotas && pago.cuotas > 1 && pago.recargo && pago.recargo > 0 && pago.monto > 0) {
        const recargoDelPago = pago.monto - (pago.monto / (1 + pago.recargo));
        return sum + recargoDelPago;
      }
      return sum;
    }, 0);
  }, [currentPagos]);
  
  // Calcular el total pagado (suma de todos los pagos)
  const totalPagadoCalculado = currentPagos.reduce((sum, pago) => {
    return sum + (Number(pago.monto) || 0);
  }, 0);
  
  // Total final de la venta a mostrar en UI (productos + recargos)
  // Para evitar inconsistencias, si hay pagos con tarjeta de crédito en cuotas,
  // usamos el totalPagadoCalculado como fuente única de verdad.
  const totalVentaFinalUI = useMemo(() => {
    // Si hay al menos un pago con tarjeta de crédito
    const hayPagoTarjetaCredito = currentPagos.some(pago => 
      pago.metodo_pago === "Tarjeta Crédito"
    );
    
    // Si hay tarjeta de crédito Y el total pagado es diferente al total de productos
    // (lo que indica que hay un recargo aplicado)
    if (hayPagoTarjetaCredito && Math.abs(totalPagadoCalculado - totalVentaProductos) > 0.01) {
      return totalPagadoCalculado;
    }
    
    // En cualquier otro caso, mantenemos el total de productos
    return totalVentaProductos;
  }, [totalVentaProductos, totalPagadoCalculado, currentPagos]);

  // Monto restante basado en el total final con recargos
  const montoRestante = totalVentaFinalUI - totalPagadoCalculado;

  useEffect(() => {
    if (productos) {
      const prods = (productos as any[])
        .filter((p) => p.stock > 0)
        .map((p) => ({
          id: p.id,
          nombre: p.nombre,
          precio: p.precio_unit || 0, 
          stock: p.stock,
        }));
      setProductosDisponibles(prods);
      setProductosFiltrados(prods); 
    }
  }, [productos]);

  const filtrarProductos = (textoBusqueda: string) => {
    setBusqueda(textoBusqueda);
    if (!textoBusqueda.trim()) {
      setProductosFiltrados(productosDisponibles);
      return;
    }
    
    const textoNormalizado = textoBusqueda.toLowerCase().trim();
    const filtrados = productosDisponibles.filter(producto => 
      producto.nombre.toLowerCase().includes(textoNormalizado)
    );
    setProductosFiltrados(filtrados);
  };
  
  const handleComboboxOpenChange = (index: number, isOpen: boolean) => {
    setOpenComboboxes(prev => ({ ...prev, [index]: isOpen }));
    if (!isOpen) {
      // Reset search when a combobox is closed
      // We keep the current filter if user just clicks outside
      // filtrarProductos(""); 
    }
  };


  const [manualOverride, setManualOverride] = useState<Record<string, boolean>>(
    METODOS_PAGO.reduce((acc, methodLabel) => {
      acc[methodLabel] = false;
      return acc;
    }, {} as Record<string, boolean>)
  );

  useEffect(() => {
    const activePagos = (form.getValues("pagos") || []).filter(p => p !== undefined && p !== null);
    // Usar totalVentaProductos (sin recargos) para la lógica de auto-asignación
    const currentTotalProductos = totalVentaProductos;


    const indexTarjetaCredito = activePagos.findIndex(p => p.metodo_pago === "Tarjeta Crédito");
    if (indexTarjetaCredito !== -1 && cuotasTarjeta["Tarjeta Crédito"] && cuotasTarjeta["Tarjeta Crédito"].recargo > 0) {
      const recargo = cuotasTarjeta["Tarjeta Crédito"].recargo;
      if (activePagos.length === 1 && !manualOverride["Tarjeta Crédito"]) {
        const montoConRecargo = currentTotalProductos * (1 + recargo); // Base es total productos
        const indexToUpdate = (form.getValues("pagos") || []).findIndex(p => p?.metodo_pago === "Tarjeta Crédito");
        if (indexToUpdate !== -1) {
          form.setValue(`pagos.${indexToUpdate}.monto`, parseFloat(montoConRecargo.toFixed(2)), { shouldValidate: true, shouldDirty: true });
        }
        return; 
      }
    }
    
    if (activePagos.length === 1) {
      const pagoActual = activePagos[0];
      const metodo = pagoActual.metodo_pago;
      const indexToUpdate = (form.getValues("pagos") || []).findIndex(p => p?.metodo_pago === metodo);

      if (indexToUpdate !== -1 && !manualOverride[metodo]) {
        if (metodo === "Tarjeta Crédito" && cuotasTarjeta[metodo] && cuotasTarjeta[metodo].recargo > 0) {
          const montoConRecargo = currentTotalProductos * (1 + cuotasTarjeta[metodo].recargo); // Base es total productos
          form.setValue(`pagos.${indexToUpdate}.monto`, parseFloat(montoConRecargo.toFixed(2)), { shouldValidate: true, shouldDirty: true });
        } else if (form.getValues(`pagos.${indexToUpdate}.monto`) !== currentTotalProductos) {
          form.setValue(`pagos.${indexToUpdate}.monto`, parseFloat(currentTotalProductos.toFixed(2)), { shouldValidate: true, shouldDirty: true });
        }
      }
    } else if (activePagos.length === 2) {
      const amountPerMethod = currentTotalProductos / 2; // Base es total productos
      activePagos.forEach((pagoActual) => {
        const metodo = pagoActual.metodo_pago;
        const indexToUpdate = (form.getValues("pagos") || []).findIndex(p => p?.metodo_pago === metodo);

        if (indexToUpdate !== -1 && !manualOverride[metodo]) {
          if (metodo === "Tarjeta Crédito" && cuotasTarjeta[metodo] && cuotasTarjeta[metodo].recargo > 0) {
            const montoConRecargo = amountPerMethod * (1 + cuotasTarjeta[metodo].recargo);
            form.setValue(`pagos.${indexToUpdate}.monto`, parseFloat(montoConRecargo.toFixed(2)), { shouldValidate: true, shouldDirty: true });
          } else if (form.getValues(`pagos.${indexToUpdate}.monto`) !== amountPerMethod) {
            form.setValue(`pagos.${indexToUpdate}.monto`, parseFloat(amountPerMethod.toFixed(2)), { shouldValidate: true, shouldDirty: true });
          }
        }
      });
    }
  }, [form.watch("pagos"), totalVentaProductos, manualOverride, form, currentItems, cuotasTarjeta]); // Depender de totalVentaProductos

  const handleMetodoPagoChange = (metodo: string, checked: boolean | string) => {
    const isChecked = typeof checked === 'boolean' ? checked : checked === 'true';
    const currentPagosArray = form.getValues("pagos") || [];
    const index = currentPagosArray.findIndex((field: any) => field.metodo_pago === metodo);

    if (isChecked && index === -1) {
      if (metodo === "Tarjeta Crédito") {
        appendPago({ 
          metodo_pago: metodo, 
          monto: 0, 
          cuotas: 1, 
          recargo: 0 
        });
        setCuotasTarjeta({...cuotasTarjeta, [metodo]: { cuotas: 1, recargo: 0 }});
      } else {
        appendPago({ metodo_pago: metodo, monto: 0 });
      }
    } else if (!isChecked && index !== -1) {
      removePago(index);
      setManualOverride(prev => ({ ...prev, [metodo]: false }));
      if (metodo === "Tarjeta Crédito") {
        const newCuotasTarjeta = {...cuotasTarjeta};
        delete newCuotasTarjeta[metodo];
        setCuotasTarjeta(newCuotasTarjeta);
      }
    }
  };

  const actualizarPrecioPorProducto = (index: number, productoId: string) => {
    const producto = productosDisponibles.find((p) => p.id === productoId);
    if (producto) {
      form.setValue(`items.${index}.precio_unitario`, producto.precio, { shouldValidate: true });
    }
  };

  const handleCantidadChange = (index: number, valueString: string) => {
    const cantidad = parseInt(valueString) || 0; 
    form.setValue(`items.${index}.cantidad`, cantidad, { shouldValidate: true });

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
      const precio = parseFloat(valueString) || 0; 
      form.setValue(`items.${index}.precio_unitario`, precio, { shouldValidate: true });
  };

  const verificarStockDisponible = (productoId: string, cantidad: number): boolean => {
    const producto = productosDisponibles.find((p) => p.id === productoId);
    return producto ? producto.stock >= cantidad : false;
  };

  const handleCuotasChange = (metodo: string, opcionCuotas: number) => {
    let recargo = 0;
    let cuotas = 1;
    
    if (opcionCuotas === 3) {
      recargo = 0.2; 
      cuotas = 3;
    } else if (opcionCuotas === 6) {
      recargo = 0.3; 
      cuotas = 6;
    }
    
    setCuotasTarjeta({...cuotasTarjeta, [metodo]: { cuotas, recargo }});
    
    const pagosArray = form.getValues("pagos") || [];
    const index = pagosArray.findIndex((pago: any) => pago.metodo_pago === metodo);
    
    if (index !== -1) {
      // Usar totalVentaProductos (sin recargos) como base para el cálculo del recargo
      let montoBaseParaRecargo = totalVentaProductos; 
      
      // Si hay más de una forma de pago y este pago de tarjeta ya tiene un monto (posiblemente manual)
      // recalculamos el monto base original de ESE PAGO antes de este nuevo recargo.
      if (pagosArray.length > 1 && manualOverride[metodo] && pagosArray[index].monto > 0) {
         const pagoActual = pagosArray[index];
         const recargoAnterior = pagoActual.recargo || 0; // Usar el recargo guardado en el pago
         montoBaseParaRecargo = pagoActual.monto / (1 + recargoAnterior);
      } else if (pagosArray.length > 1 && !manualOverride[metodo]) {
        // Si hay múltiples formas de pago y no hay override, dividir el total de productos
        // PERO esto es complejo, mejor dejar que el useEffect de auto-asignación maneje la división.
        // Aquí, si se cambian las cuotas de una tarjeta, y hay otros pagos,
        // la base para el recargo de ESTA tarjeta debería ser su porción del total de productos.
        // O más simple: si el monto ya está seteado, usarlo para recalcular.
        // Si el monto es 0 (recién agregado), el useEffect se encargará.
        // Por ahora, para simplificar, si es más de 1 pago, el monto base es el monto actual de la tarjeta sin su recargo.
        // Esto asume que el usuario primero ajusta el monto de la tarjeta si quiere que sea parcial.
        const pagoActual = pagosArray[index];
        const recargoAnterior = pagoActual.recargo || 0;
        if (pagoActual.monto > 0) {
             montoBaseParaRecargo = pagoActual.monto / (1 + recargoAnterior);
        } else {
            // Si el monto es 0, y hay varios pagos, es difícil saber la base.
            // Podríamos tomar totalVentaProductos / num_pagos_activos_con_monto_cero_o_tarjeta.
            // Dejemos que el useEffect que distribuye lo haga, y si el usuario cambia cuotas de un pago con 0,
            // el monto seguirá 0 hasta que el useEffect o el usuario lo cambie.
            // Si el monto es 0 y es el único pago, montoBaseParaRecargo es totalVentaProductos.
             if (activePagos.length === 1) {
                montoBaseParaRecargo = totalVentaProductos;
             } else {
                // No cambiar el monto si es 0 y hay otros pagos, dejar que el useEffect actúe.
                // Solo actualizar cuotas y tasa de recargo.
                form.setValue(`pagos.${index}.cuotas`, cuotas, { shouldValidate: true });
                form.setValue(`pagos.${index}.recargo`, recargo, { shouldValidate: true });
                // No se setea el monto aquí si es 0 y hay otros pagos.
                // El useEffect debería recalcular la distribución si este es un nuevo pago.
                // Si es un pago existente con monto > 0, montoBaseParaRecargo ya está bien.
                if (pagoActual.monto === 0) return; // Salir si monto es 0 y hay otros pagos
             }
        }
      } else if (activePagos.length === 1) { 
         montoBaseParaRecargo = totalVentaProductos;
      }
      // Else, montoBaseParaRecargo es totalVentaProductos (por defecto si es el único pago o si algo falló arriba)

      const nuevoMontoConRecargo = montoBaseParaRecargo * (1 + recargo);
      
      form.setValue(`pagos.${index}.cuotas`, cuotas, { shouldValidate: true });
      form.setValue(`pagos.${index}.recargo`, recargo, { shouldValidate: true });
      form.setValue(`pagos.${index}.monto`, parseFloat(nuevoMontoConRecargo.toFixed(2)), { shouldValidate: true });
      
      // Forzar re-evaluación de watchers y validaciones que dependen de "pagos"
      form.trigger("pagos"); 
    }
  };

  const handlePagoMontoChange = (index: number, valueString: string) => {
    const monto = parseFloat(valueString); 
    const metodoDelPago = form.getValues(`pagos.${index}.metodo_pago`);
    
    if (!isNaN(monto)) {
      setManualOverride(prev => ({ ...prev, [metodoDelPago]: true }));
      
      if (metodoDelPago === "Tarjeta Crédito" && cuotasTarjeta[metodoDelPago]?.recargo > 0) {
        form.setValue(`pagos.${index}.monto`, monto, { shouldValidate: true });
      } else {
        form.setValue(`pagos.${index}.monto`, monto, { shouldValidate: true });
      }
    }
  };

  const onSubmit = async (values: VentaFormValues) => {
      const totalItemsBase = values.items.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
      const totalRecargosMonetariosSubmit = (values.pagos ?? []).reduce((sum, pago) => {
        if (pago.metodo_pago === "Tarjeta Crédito" && pago.cuotas && pago.cuotas > 1 && pago.recargo && pago.recargo > 0 && pago.monto > 0) {
          const recargoDelPago = pago.monto - (pago.monto / (1 + pago.recargo));
          return sum + recargoDelPago;
        }
        return sum;
      }, 0);
      const totalGeneralEsperadoSubmit = totalItemsBase + totalRecargosMonetariosSubmit;
      
      // La validación de Zod ya cubre esto, pero una doble verificación no hace daño.
      const totalPagadoSubmit = (values.pagos ?? []).reduce((sum, pago) => sum + pago.monto, 0);
      if (Math.abs(totalGeneralEsperadoSubmit - totalPagadoSubmit) >= 0.01) {
          toast({ title: "Error de Validación", description: "La suma de los pagos no coincide con el total final (productos + recargos).", variant: "destructive" });
          return;
      }
      
      for (const item of values.items) {
        if (!verificarStockDisponible(item.producto_id, item.cantidad)) {
          const producto = productosDisponibles.find((p) => p.id === item.producto_id);
          toast({ title: "Stock insuficiente", description: `Stock para ${producto?.nombre}: ${producto?.stock}`, variant: "destructive" });
          return;
        }
      }

    try {
      // Preparar los datos de pago para enviar, incluyendo cuotas y recargo
      const pagosParaEnviar = (values.pagos ?? [])
        .filter(p => typeof p.monto === 'number') // Asegurar que el monto sea un número y que el pago exista
        .map(pago => {
          const pagoEnviado: { // Definición explícita para claridad, se alineará con VentaPago
            metodo_pago: string;
            monto: number;
            cuotas?: number; // undefined si no se establece
            recargo?: number; // undefined si no se establece
          } = {
            metodo_pago: pago.metodo_pago,
            monto: pago.monto,
            // No se inicializan cuotas y recargo aquí, serán undefined por defecto
          };

          // Incluir cuotas y recargo solo si están definidos y son relevantes (ej. para Tarjeta Crédito)
          if (pago.metodo_pago === "Tarjeta Crédito") {
            if (typeof pago.cuotas === 'number' && pago.cuotas >= 1) { // cuotas >= 1 (1 para contado)
              pagoEnviado.cuotas = pago.cuotas;
            }
            if (typeof pago.recargo === 'number' && pago.recargo >= 0) { // recargo puede ser 0
              pagoEnviado.recargo = pago.recargo;
            }
          }
          return pagoEnviado;
        });
      
      const ventaDataToSend = {
        cliente: values.cliente,
        items: values.items,
        pagos: pagosParaEnviar, // Usar los pagos procesados con cuotas y recargo
        mensajeInterno: values.mensajeInterno || "",
        mensajeExterno: values.mensajeExterno || ""
      };
      
      console.log("Datos enviados a realizar_venta:", JSON.stringify(ventaDataToSend, null, 2));
      
      const ventaId = await createVenta.mutateAsync(ventaDataToSend); 
      
      setGeneratedVentaId(ventaId); 
      setIsPdfModalOpen(true); 
      
    } catch (error: any) {
      console.error("Error RPC completo:", error); // Log más detallado del error
      // Intentar extraer un mensaje más útil del error si es posible
      let errorMessage = "Hubo un problema al procesar la venta.";
      if (error && error.message) {
        // El error de Supabase a veces viene como un string JSON en error.message
        try {
          const parsedError = JSON.parse(error.message);
          if (parsedError && parsedError.message) {
            errorMessage = parsedError.message;
          } else {
            errorMessage = error.message; // Usar el mensaje original si el parseo no ayuda
          }
        } catch (e) {
          errorMessage = error.message; // Si no es JSON, usar el mensaje tal cual
        }
      }
      toast({ title: "Error al realizar la venta", description: errorMessage, variant: "destructive" });
    }
  };

  const agregarProducto = () => {
    appendItem({ producto_id: "", cantidad: 1, precio_unitario: 0 });
  };

  const handlePdfModalClosed = () => {
    toast({ title: "Proceso de Venta Finalizado", description: "La venta se registró y el PDF se procesó." });
    form.reset(); 
    setGeneratedVentaId(undefined); 
    setCuotasTarjeta({});
    setManualOverride(METODOS_PAGO.reduce((acc, methodLabel) => ({...acc, [methodLabel]: false}), {}));
    filtrarProductos(""); // Reset product search
    onSuccess(); 
  };
  
  const activePagos = form.watch("pagos") || [];


  // --- Renderizado --- 
  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Sección Cliente */}
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

          {/* Sección Productos con ComboBox */}
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
                      <div className="grid grid-cols-12 gap-4 items-end">
                        <div className="col-span-12 md:col-span-5">
                          <FormField
                            control={form.control}
                            name={`items.${index}.producto_id`}
                            render={({ field: selectField }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel>Producto *</FormLabel>
                                <Popover open={openComboboxes[index] || false} onOpenChange={(isOpen) => handleComboboxOpenChange(index, isOpen)}>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                          "w-full justify-between",
                                          !selectField.value && "text-muted-foreground"
                                        )}
                                      >
                                        {selectField.value
                                          ? productosDisponibles.find(
                                              (producto) => producto.id === selectField.value
                                            )?.nombre
                                          : "Seleccionar producto"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command filter={() => 1}>
                                      <CommandInput 
                                        placeholder="Buscar producto..." 
                                        value={busqueda} 
                                        onValueChange={filtrarProductos}
                                      />
                                      <CommandList>
                                        <CommandEmpty>No se encontró el producto.</CommandEmpty>
                                        <CommandGroup>
                                          {productosFiltrados.map((producto) => (
                                            <CommandItem
                                              value={producto.id}
                                              key={producto.id}
                                              onSelect={(currentValue) => {
                                                form.setValue(`items.${index}.producto_id`, currentValue);
                                                actualizarPrecioPorProducto(index, currentValue);
                                                setOpenComboboxes(prev => ({ ...prev, [index]: false }));
                                                filtrarProductos(""); // Limpiar búsqueda después de seleccionar
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  producto.id === selectField.value
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                                )}
                                              />
                                              {producto.nombre}
                                              <span className="ml-2 text-xs text-muted-foreground">
                                                (Stock: {producto.stock})
                                              </span>
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
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
                              <FormItem className="w-full md:max-w-[100px]">
                                <FormLabel>Cantidad *</FormLabel>
                                <FormControl>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="Cant."
                                    {...cantidadField}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      if (value === '' || /^[0-9]+$/.test(value)) {
                                        // Pasamos string vacío o el número parseado
                                        // Zod con coerce se encargará de la conversión y validación
                                        cantidadField.onChange(value === '' ? '' : value); 
                                        // Actualizar el precio si el producto ya está seleccionado
                                        const currentProductoId = form.getValues(`items.${index}.producto_id`);
                                        if (currentProductoId) {
                                          // No es necesario llamar a actualizarPrecioPorProducto aquí directamente
                                          // si el precio ya está fijado, solo recalculamos el total.
                                          // La validación y el cálculo de totales se harán por los watchers/onSubmit.
                                        }
                                      }
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    onWheel={(event) => (event.target as HTMLElement).blur()}
                                    className="text-center"
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
                              <FormItem className="w-full md:max-w-[150px]">
                                <FormLabel>Precio *</FormLabel>
                                <FormControl>
                                  <Input
                                    type="text"
                                    inputMode="decimal" // Permite decimales en teclados móviles
                                    placeholder="Precio"
                                    {...precioField}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      // Permitir números, un solo punto decimal, y vacío
                                      if (value === '' || /^[0-9]*\.?([0-9]{1,2})?$/.test(value)) {
                                        // Zod con coerce se encargará de la conversión y validación
                                        precioField.onChange(value === '' ? '' : value);
                                      }
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    onWheel={(event) => (event.target as HTMLElement).blur()}
                                    className="text-right"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-10 md:col-span-2 flex items-end justify-end">
                          <div className="text-right">
                            <p className="text-sm font-medium">Subtotal:</p>
                            <p className="text-lg font-semibold">
                              ${((form.watch(`items.${index}.cantidad`) || 0) * 
                                 (form.watch(`items.${index}.precio_unitario`) || 0)).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="col-span-2 md:col-span-12 flex justify-end items-start md:absolute md:right-4 md:top-4">
                          {itemFields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(index)}
                              className="mt-0 md:mt-0" // Ajuste para alinear mejor en móvil y que no afecte desktop
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
                  <p className="text-2xl font-bold">${totalVentaFinalUI.toFixed(2)}</p>
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
                      value={field.value || ''} 
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
                  <div key={field.id} className="space-y-4">
                    <FormField
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
                              value={montoField.value || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                // Let react-hook-form and Zod handle coercion.
                                // Pass the string value directly to the field's onChange.
                                montoField.onChange(val);
                                // Call your existing handler for manual override and other logic.
                                // Note: handlePagoMontoChange expects a string value now.
                                handlePagoMontoChange(index, val); 
                              }}
                              onFocus={(e) => e.target.select()}
                              onWheel={(event) => (event.target as HTMLElement).blur()}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {field.metodo_pago === "Tarjeta Crédito" && (
                      <div className="ml-32 space-y-2 border-l-2 pl-4 border-primary/20">
                        <h5 className="text-sm font-medium">Opciones de Cuotas (Tarjeta de Crédito)</h5>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Controller
                              control={form.control}
                              name={`pagos.${index}.cuotas`}
                              render={({ field: controllerField }) => (
                                <input 
                                  type="radio" 
                                  id={`contado-${index}-${field.id}`} 
                                  name={`cuotasOpcion-${field.id}`}
                                  checked={cuotasTarjeta[pagoFields[index].metodo_pago]?.cuotas === 1 || form.getValues(`pagos.${index}.cuotas`) === 1}
                                  onChange={() => {
                                    handleCuotasChange(pagoFields[index].metodo_pago, 1);
                                    controllerField.onChange(1);
                                  }}
                                  className="h-4 w-4"
                                />
                              )}
                            />
                            <label htmlFor={`contado-${index}-${field.id}`} className="text-sm">
                              Contado (Sin recargo)
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                             <Controller
                              control={form.control}
                              name={`pagos.${index}.cuotas`}
                              render={({ field: controllerField }) => (
                                <input 
                                  type="radio" 
                                  id={`tres-cuotas-${index}-${field.id}`} 
                                  name={`cuotasOpcion-${field.id}`}
                                  checked={cuotasTarjeta[pagoFields[index].metodo_pago]?.cuotas === 3 || form.getValues(`pagos.${index}.cuotas`) === 3}
                                  onChange={() => {
                                    handleCuotasChange(pagoFields[index].metodo_pago, 3);
                                    controllerField.onChange(3);
                                  }}
                                  className="h-4 w-4"
                                />
                               )}
                            />
                            <label htmlFor={`tres-cuotas-${index}-${field.id}`} className="text-sm">
                              3 Cuotas (20% recargo)
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Controller
                              control={form.control}
                              name={`pagos.${index}.cuotas`}
                              render={({ field: controllerField }) => (
                                <input 
                                  type="radio" 
                                  id={`seis-cuotas-${index}-${field.id}`} 
                                  name={`cuotasOpcion-${field.id}`}
                                  checked={cuotasTarjeta[pagoFields[index].metodo_pago]?.cuotas === 6 || form.getValues(`pagos.${index}.cuotas`) === 6}
                                  onChange={() => {
                                    handleCuotasChange(pagoFields[index].metodo_pago, 6);
                                    controllerField.onChange(6);
                                  }}
                                  className="h-4 w-4"
                                />
                              )}
                            />
                            <label htmlFor={`seis-cuotas-${index}-${field.id}`} className="text-sm">
                              6 Cuotas (30% recargo)
                            </label>
                          </div>
                          
                          {cuotasTarjeta[pagoFields[index].metodo_pago]?.recargo > 0 && (
                            <div className="text-sm text-muted-foreground mt-2">
                              Recargo: {cuotasTarjeta[pagoFields[index].metodo_pago]?.recargo * 100}% 
                              (${((form.getValues(`pagos.${index}.monto`) || 0) / (1 + (cuotasTarjeta[pagoFields[index].metodo_pago]?.recargo || 0))) * (cuotasTarjeta[pagoFields[index].metodo_pago]?.recargo || 0) })
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Resumen de Pagos y Total */}
            <div className="mt-6 flex justify-end items-center gap-6 border-t pt-4">
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
                  <p className="text-sm font-medium">Subtotal Productos:</p>
                  <p className="text-lg font-semibold">${totalVentaProductos.toFixed(2)}</p>
               </div>
                {totalRecargosAplicados > 0 && (
                    <div className="text-right">
                        <p className="text-sm font-medium">Recargos:</p>
                        <p className="text-lg font-semibold">${totalRecargosAplicados.toFixed(2)}</p>
                    </div>
                )}
               <div className="text-right">
                  <p className="text-sm font-medium">Total Final:</p>
                  <p className="text-lg font-semibold">${totalVentaFinalUI.toFixed(2)}</p>
               </div>
               <div className="text-right">
                  <p className="text-sm font-medium">Restante:</p>
                  {/* Usar una pequeña tolerancia para la comparación con cero debido a problemas de punto flotante */}
                  <p className={`text-lg font-bold ${Math.abs(montoRestante) > 0.001 ? 'text-red-600' : 'text-green-600'}`}> 
                     ${montoRestante.toFixed(2)}
                  </p>
               </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onSuccess}>Cancelar</Button>
            <Button 
              type="submit" 
              disabled={createVenta.isPending || isLoadingProductos || Math.abs(montoRestante) >= 0.01 || form.formState.isSubmitting || itemFields.length === 0}
            >
              { (createVenta.isPending || form.formState.isSubmitting) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              { (createVenta.isPending || form.formState.isSubmitting) ? "Procesando..." : "Finalizar Venta"}
            </Button>
          </div>
        </form>
      </Form>

      <ConfirmationPdfModal 
          open={isPdfModalOpen} 
          onOpenChange={setIsPdfModalOpen} 
          idVenta={generatedVentaId} 
          onPdfGeneratedProp={handlePdfModalClosed}
      />
    </>
  );
} 