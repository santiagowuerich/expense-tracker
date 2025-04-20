"use client";

import type React from "react";
import { useState, useMemo } from "react"; // Añadido useMemo
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { v4 as uuidv4 } from "uuid";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase-browser"; // Asume que esto crea un cliente Supabase adecuado para el navegador
import { queryClient } from "@/lib/queries";

// UI Components
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

// --- Tipos Definidos ---
type Tarjeta = {
  id: string;
  alias: string;
};

// Tipo para los datos de tarjeta como vienen de Supabase
interface TarjetaFromDb {
  id: string;
  alias: string;
}

// Tipo para Producto (¡Importante definirlo!)
type Producto = {
  id: string;
  nombre: string;
  stock: number;
};


const NO_PRODUCT_VALUE = "__NO_PRODUCT__"
// Esquema de validación para el formulario de transacciones
const transactionSchema = z
  .object({
    tipo_transaccion: z.enum(["gasto", "ingreso"], {
      required_error: "Selecciona un tipo de transacción",
    }),
    payment_method: z.enum(["tarjeta", "efectivo", "transferencia"], {
      required_error: "Selecciona un método de pago",
    }),
    tarjeta_id: z.string().optional(),
    monto: z.coerce // Usar coerce para convertir string a número
      .number({ invalid_type_error: "El monto debe ser un número" })
      .positive("El monto debe ser mayor a 0"),
    fecha: z.date({
      required_error: "Selecciona una fecha",
    }),
    descripcion: z.string().optional(),
    producto_id: z.string().optional(), // Puede ser string (UUID) o undefined
    cantidad: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1").default(1),
    en_cuotas: z.boolean().default(false),
    cuotas: z.coerce.number().int().min(1, "El número de cuotas debe ser al menos 1").default(1),
  })
  .refine(
    (data) => {
      // Si el método de pago es tarjeta, debe seleccionar una tarjeta
      if (data.payment_method === "tarjeta") {
        return !!data.tarjeta_id;
      }
      return true;
    },
    {
      message: "Debes seleccionar una tarjeta",
      path: ["tarjeta_id"], // Ruta del campo donde mostrar el error
    }
  )
  .refine(
    (data) => {
        // Si está en cuotas, el número de cuotas debe ser al menos 2
        if (data.en_cuotas && data.payment_method === 'tarjeta') {
            return data.cuotas >= 2;
        }
        return true;
    },
    {
        message: "El número de cuotas debe ser al menos 2",
        path: ["cuotas"],
    }
  );


type TransactionFormValues = z.infer<typeof transactionSchema>;

interface RegisterTransactionDialogProps {
  children: React.ReactNode;
}

// --- Componente Principal ---
export default function RegisterTransactionDialog({ children }: RegisterTransactionDialogProps) {
  const [open, setOpen] = useState(false); // Estado para controlar si el diálogo está abierto
  const [isSubmitting, setIsSubmitting] = useState(false); // Estado para indicar si se está enviando
  const { toast } = useToast();

  // --- Instancia del Cliente Supabase ---
  // Es mejor instanciarlo una vez si es posible, aunque createClient del browser suele ser ligero
  const supabase = createClient();

  // --- Formulario con Validación ---
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      tipo_transaccion: "gasto",
      payment_method: "efectivo",
      tarjeta_id: undefined,
      monto: undefined, // Importante para el placeholder y la validación inicial
      fecha: new Date(),
      descripcion: "",
      producto_id: undefined, // Usar undefined para "sin producto"
      cantidad: 1,
      en_cuotas: false,
      cuotas: 2, // Default a 2 si 'en_cuotas' es true, aunque se controla en la UI
    },
  });

  // --- Observar Cambios en el Formulario ---
  const paymentMethod = form.watch("payment_method");
  const enCuotas = form.watch("en_cuotas");
  const cuotas = form.watch("cuotas");
  const monto = form.watch("monto");
  const productoId = form.watch("producto_id");
  const tipoTransaccion = form.watch("tipo_transaccion"); // Observar tipo de transacción

  // --- Calcular Monto por Cuota ---
  const montoPorCuota = useMemo(() => {
     if (monto && cuotas && paymentMethod === 'tarjeta' && enCuotas && cuotas >= 2) {
        return (monto / cuotas).toFixed(2);
     }
     return "0.00";
  }, [monto, cuotas, paymentMethod, enCuotas]);


  // --- Consultar Tarjetas desde Supabase ---
  const {
    data: tarjetas = [], // Default a array vacío
    isLoading: isLoadingTarjetas,
    error: errorTarjetas,
    refetch: refetchTarjetas,
  } = useQuery<Tarjeta[]>({ // Usar el tipo Tarjeta definido
    queryKey: ["tarjetas"],
    queryFn: async () => {
      try {
        // No es necesario crear el cliente aquí si ya está fuera
        const { data, error } = await supabase.from("tarjetas").select("id, alias");

        if (error) {
          throw new Error(error.message);
        }
        // Asegurar que el mapeo maneja null/undefined si es posible que Supabase devuelva eso
        return (data as TarjetaFromDb[] || []).map(({ id, alias }) => ({ id, alias }));

      } catch (error: any) {
        console.error("Error al cargar tarjetas:", error);
        toast({
          title: "Error al cargar tarjetas",
          description: error.message || "No se pudieron cargar las tarjetas",
          variant: "destructive",
        });
        return []; // Devolver array vacío en caso de error
      }
    },
    enabled: open, // Habilitar query solo cuando el diálogo está abierto
    staleTime: 5 * 60 * 1000, // Cachear por 5 minutos
  });

  // --- Consultar Productos desde Supabase ---
  const {
    data: productos = [], // Default a array vacío
    isLoading: isLoadingProductos, // Nombre consistente
    error: errorProductos, // Nombre consistente
  } = useQuery<Producto[], Error>({ // Usar el tipo Producto definido
    queryKey: ["productos"],
    queryFn: async () => {
      try {
        // No es necesario crear el cliente aquí si ya está fuera
        const { data, error } = await supabase
          .from("productos")
          .select("id, nombre, stock")
          .order("nombre");

        if (error) {
          throw new Error(error.message);
        }
        return (data as Producto[]) || []; // Devolver array vacío si data es null/undefined

      } catch (error: any) {
        console.error("Error al cargar productos:", error);
         toast({ // Mostrar toast también para errores de producto
           title: "Error al cargar productos",
           description: error.message || "No se pudieron cargar los productos",
           variant: "destructive",
         });
        return [];
      }
    },
    enabled: open, // Habilitar query solo cuando el diálogo está abierto
    staleTime: 5 * 60 * 1000, // Cachear por 5 minutos
  });

  // --- Obtener Stock Disponible ---
  const productoSeleccionado = useMemo(() =>
      productos.find((p) => p.id === productoId),
    [productos, productoId]
  );

  // Stock disponible SÓLO relevante para GASTOS
  const stockDisponible = useMemo(() => {
      if (tipoTransaccion === 'gasto' && productoSeleccionado) {
          return productoSeleccionado.stock ?? 0;
      }
      return Infinity; // Para ingresos o sin producto, no hay límite de stock
  }, [productoSeleccionado, tipoTransaccion]);


  // --- Manejador de Envío del Formulario ---
  const onSubmit = async (values: TransactionFormValues) => {
    setIsSubmitting(true);
    try {
      // --- Validación de Stock ---
      // Validar cantidad contra el stock disponible SÓLO para gastos y si hay un producto seleccionado
      if (
        values.tipo_transaccion === "gasto" &&
        values.producto_id && // Solo si hay un producto seleccionado
        productoSeleccionado && // Asegurarse que el producto existe en la data cargada
        values.cantidad > productoSeleccionado.stock // Usar el stock del producto encontrado
      ) {
         form.setError("cantidad", { // Usar setError para mostrar el mensaje en el campo correcto
             type: "manual",
             message: `Stock insuficiente. Disponible: ${productoSeleccionado.stock}`
         });
         throw new Error("Stock insuficiente para este producto"); // Lanzar error para detener el submit
      }

      // --- Preparar Datos para la API ---
      const transactionData = {
        tipo_transaccion: values.tipo_transaccion,
        payment_method: values.payment_method,
        // tarjeta_id solo si el método es tarjeta, de lo contrario null
        tarjeta_id: values.payment_method === "tarjeta" ? values.tarjeta_id : null,
        monto: values.monto,
        fecha: values.fecha.toISOString(), // Convertir fecha a ISO string
        descripcion: values.descripcion || "", // Usar string vacío si es undefined
        // producto_id si está definido y no es la opción "sin producto" (que ahora es undefined), de lo contrario null
        producto_id: values.producto_id || null,
        cantidad: values.producto_id ? values.cantidad : 1, // Cantidad solo relevante si hay producto
        // en_cuotas y cuotas solo relevantes si es tarjeta
        en_cuotas: values.payment_method === "tarjeta" ? values.en_cuotas : false,
        cuotas: values.payment_method === "tarjeta" && values.en_cuotas ? values.cuotas : 1,
        // payment_intent_id: uuidv4(), // ¿Es necesario generar esto en el cliente? Depende de tu API.
                                        // Si es un ID interno de la transacción, quizás generarlo en el backend.
                                        // Si es para Stripe u otro, el flujo puede ser diferente.
                                        // Comentado por ahora.
      };

      console.log("Enviando datos:", transactionData); // Log para depuración

      // --- Enviar a la API ---
      const response = await fetch("/api/register-transaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transactionData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText })); // Intentar parsear JSON, sino usar statusText
        console.error("Error de API:", errorData);
        throw new Error(errorData.message || "Error al registrar la transacción");
      }

      // --- Éxito ---
      toast({
        title: "Transacción registrada",
        description: "La transacción ha sido registrada exitosamente",
      });

      // Invalidar la caché de consultas para refrescar los datos
      await queryClient.invalidateQueries({ queryKey: ["pagos"] }); // Usar await si es necesario esperar la invalidación
      await queryClient.invalidateQueries({ queryKey: ["resumen"] });
      await queryClient.invalidateQueries({ queryKey: ["productos"] }); // Invalidar productos por si cambió el stock

      // Limpiar y resetear el formulario a los valores por defecto
      form.reset(); // Resetea a defaultValues definidos en useForm

      setOpen(false); // Cerrar el diálogo

    } catch (error: any) {
      console.error("Error al guardar la transacción:", error);
      // Mostrar error específico si no es el de stock (que ya se manejó con setError)
      if (error.message !== "Stock insuficiente para este producto") {
          toast({
            title: "Error",
            description: error.message || "No se pudo registrar la transacción",
            variant: "destructive",
          });
      }
    } finally {
      setIsSubmitting(false); // Asegurar que el estado de envío se desactive
    }
  };

  // --- Renderizado del Componente ---
  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (newOpen) {
          refetchTarjetas(); // Refrescar las tarjetas cuando se abre el modal
          // Podrías refetchear productos también si el stock puede cambiar mientras está cerrado
          // queryClient.invalidateQueries({ queryKey: ["productos"] });
        } else {
            form.reset(); // Resetear el form al cerrar por si quedó con errores o datos
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md"> {/* Ajustado max-width */}
        <DialogHeader>
          <DialogTitle>Registrar Transacción</DialogTitle>
          <DialogDescription>
            Ingresa los detalles de la transacción que deseas registrar.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            {/* --- Tipo de Transacción --- */}
            <FormField
              control={form.control}
              name="tipo_transaccion"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <FormLabel className="text-right">Tipo</FormLabel> {/* Label más corto */}
                  <div className="col-span-3">
                    <Select
                      value={field.value}
                      onValueChange={(value: "gasto" | "ingreso") => {
                          field.onChange(value);
                          // Si cambia a ingreso, no tiene sentido seleccionar producto para descontar stock
                          if (value === 'ingreso') {
                              form.setValue('producto_id', undefined);
                              form.setValue('cantidad', 1);
                          }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="gasto">Gasto</SelectItem>
                        <SelectItem value="ingreso">Ingreso</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            {/* --- Método de Pago --- */}
            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <FormLabel className="text-right">Método</FormLabel> {/* Label más corto */}
                  <div className="col-span-3">
                    <Select
                      value={field.value}
                      onValueChange={(value: "tarjeta" | "efectivo" | "transferencia") => {
                        field.onChange(value);
                        // Limpiar campos relacionados con tarjeta si no es tarjeta
                        if (value !== "tarjeta") {
                          form.setValue("tarjeta_id", undefined);
                          form.setValue("en_cuotas", false);
                          form.setValue("cuotas", 1);
                           form.clearErrors("tarjeta_id"); // Limpiar errores específicos
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar método" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="tarjeta">Tarjeta</SelectItem>
                        <SelectItem value="efectivo">Efectivo</SelectItem>
                        <SelectItem value="transferencia">Transferencia</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            {/* --- Selección de Tarjeta (Condicional) --- */}
            {paymentMethod === "tarjeta" && (
              <FormField
                control={form.control}
                name="tarjeta_id"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-right">Tarjeta</FormLabel>
                    <div className="col-span-3">
                      <Select
                        value={field.value ?? ""} // Controlar valor undefined
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tarjeta" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingTarjetas ? (
                            <SelectItem value="loading" disabled>
                              Cargando tarjetas...
                            </SelectItem>
                          ) : errorTarjetas ? (
                            <SelectItem value="error" disabled>
                              Error al cargar tarjetas
                            </SelectItem>
                          ) : tarjetas && tarjetas.length > 0 ? (
                            tarjetas.map((tarjeta) => (
                              <SelectItem key={tarjeta.id} value={tarjeta.id}>
                                {tarjeta.alias}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="empty" disabled>
                              No hay tarjetas disponibles
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage /> {/* Muestra el error de .refine aquí */}
                    </div>
                  </FormItem>
                )}
              />
            )}

            {/* --- Monto --- */}
            <FormField
              control={form.control}
              name="monto"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <FormLabel className="text-right">Monto</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      className="col-span-3"
                      {...field}
                      // Manejar el valor para evitar "NaN" o valores no controlados
                      value={field.value === undefined ? "" : field.value}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Permitir campo vacío (será undefined), o convertir a número
                        field.onChange(value === "" ? undefined : parseFloat(value));
                      }}
                    />
                  </FormControl>
                   {/* Mover FormMessage fuera de FormControl para mejor layout */}
                   <div className="col-span-3 col-start-2">
                        <FormMessage />
                   </div>
                </FormItem>
              )}
            />

            {/* --- Fecha --- */}
            <FormField
              control={form.control}
              name="fecha"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <FormLabel className="text-right">Fecha</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "col-span-3 justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(field.value, "PPP", { locale: es })
                          ) : (
                            <span>Seleccionar fecha</span> // Usar span para consistencia
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        locale={es} // Pasar locale al calendario también
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="col-span-3 col-start-2">
                     <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            {/* --- Descripción --- */}
            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <FormLabel className="text-right">Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descripción (opcional)"
                      className="col-span-3"
                      {...field}
                      value={field.value ?? ""} // Controlar valor null/undefined
                    />
                  </FormControl>
                   <div className="col-span-3 col-start-2">
                      <FormMessage />
                   </div>
                </FormItem>
              )}
            />

              {/* --- Producto (Condicional si es GASTO) --- */}
              {tipoTransaccion === 'gasto' && (
                <FormField
                control={form.control}
                name="producto_id"
                render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-right">Producto</FormLabel>
                    <div className="col-span-3">
                        <Select
                           // Si field.value es undefined, usa NO_PRODUCT_VALUE para que coincida con el SelectItem
                           value={field.value ?? NO_PRODUCT_VALUE}
                           onValueChange={(value) => {
                               // Si el valor seleccionado es nuestro valor especial, guarda undefined en el form.
                               // De lo contrario, guarda el ID del producto real.
                               field.onChange(value === NO_PRODUCT_VALUE ? undefined : value);
                               // Resetear cantidad si se deselecciona el producto
                               if (value === NO_PRODUCT_VALUE) {
                                   form.setValue("cantidad", 1);
                                   form.clearErrors("cantidad"); // Limpiar error de stock si se quita producto
                               }
                           }}
                        >
                        <FormControl>
                            <SelectTrigger>
                             {/* El placeholder se mostrará si el value del Select coincide con NO_PRODUCT_VALUE
                                 y hay un SelectItem con ese value. O puedes poner un placeholder explícito.
                                 Si quieres que SelectValue muestre "Sin producto", asegúrate de que field.value sea NO_PRODUCT_VALUE
                                 cuando esté vacío. */}
                             <SelectValue placeholder="Seleccionar producto..." />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {/* Opción explícita para "Sin producto" con el valor especial */}
                            <SelectItem value={NO_PRODUCT_VALUE}>Sin producto</SelectItem>

                            {/* Resto de las opciones de producto */}
                            {isLoadingProductos ? (
                            <SelectItem value="loading" disabled>
                                Cargando productos...
                            </SelectItem>
                            ) : errorProductos ? (
                            <SelectItem value="error" disabled>
                                Error al cargar productos
                            </SelectItem>
                            ) : productos && productos.length > 0 ? (
                            productos.map((producto) => (
                                <SelectItem key={producto.id} value={producto.id}>
                                {producto.nombre} (Stock: {producto.stock})
                                </SelectItem>
                            ))
                            ) : (
                             <></> // No mostrar nada más si no hay productos aparte de la opción "Sin producto"
                            )}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </div>
                    </FormItem>
                )}
                />
             )}


            {/* --- Cantidad (Condicional si hay Producto y es GASTO) --- */}
            {tipoTransaccion === 'gasto' && productoId && ( // Solo mostrar si es gasto Y hay producto seleccionado
              <FormField
                control={form.control}
                name="cantidad"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-right">Cantidad</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        // No establecer max aquí, la validación se hace en onSubmit y con setError
                        // max={stockDisponible === Infinity ? undefined : stockDisponible}
                        className="col-span-3"
                        {...field}
                        value={field.value ?? 1} // Default a 1 si es undefined
                        onChange={(e) => {
                           const val = parseInt(e.target.value);
                           field.onChange(isNaN(val) || val < 1 ? 1 : val);
                        }}
                      />
                    </FormControl>
                    {/* Mostrar stock disponible como descripción */}
                    <FormDescription className="col-span-3 col-start-2">
                         Stock disponible: {productoSeleccionado?.stock ?? 'N/A'}
                     </FormDescription>
                    <div className="col-span-3 col-start-2">
                       <FormMessage /> {/* Mostrará error de stock aquí si se usa form.setError */}
                    </div>
                  </FormItem>
                )}
              />
            )}

            {/* --- Opciones de Cuotas (Condicional si es Tarjeta) --- */}
            {paymentMethod === "tarjeta" && (
              <> {/* Fragmento para agrupar campos de cuotas */}
                {/* --- Switch En Cuotas --- */}
                <FormField
                  control={form.control}
                  name="en_cuotas"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right">En cuotas</FormLabel>
                      <div className="flex items-center space-x-2 col-span-3">
                        <FormControl>
                          <Switch
                             checked={field.value}
                             onCheckedChange={(checked) => {
                                 field.onChange(checked);
                                 // Si se desactiva, resetear cuotas a 1 (o valor por defecto que no falle validación)
                                 if (!checked) {
                                     form.setValue("cuotas", 1); // O 2 si quieres mantener un valor válido para 'min'
                                     form.clearErrors("cuotas");
                                 } else {
                                     // Si se activa, poner un valor default válido (>= 2)
                                     form.setValue("cuotas", form.getValues("cuotas") >= 2 ? form.getValues("cuotas") : 2);
                                 }
                             }}
                          />
                        </FormControl>
                        <FormDescription>Dividir pago</FormDescription> {/* Texto más corto */}
                      </div>
                       {/* Mensaje de error para el switch si fuera necesario */}
                       <div className="col-span-3 col-start-2">
                           <FormMessage />
                       </div>
                    </FormItem>
                  )}
                />

                {/* --- Número de Cuotas (Condicional) --- */}
                {enCuotas && ( // Mostrar solo si el switch está activo
                  <>
                    <FormField
                      control={form.control}
                      name="cuotas"
                      render={({ field }) => (
                        <FormItem className="grid grid-cols-4 items-center gap-4">
                          <FormLabel className="text-right">Nº Cuotas</FormLabel> {/* Label más corto */}
                          <FormControl>
                            <Input
                              type="number"
                              min="2" // Mínimo 2 cuotas si está activo el switch
                              max="48" // Máximo ejemplo
                              className="col-span-3"
                              {...field}
                              value={field.value ?? 2} // Default a 2 si es undefined
                              onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  // Asegurar que el valor sea al menos 2 si enCuotas es true
                                  field.onChange(isNaN(val) || val < 2 ? 2 : val);
                              }}
                            />
                          </FormControl>
                           <div className="col-span-3 col-start-2">
                              <FormMessage /> {/* Muestra el error de .refine aquí */}
                           </div>
                        </FormItem>
                      )}
                    />

                    {/* --- Mostrar Valor de Cuota --- */}
                    <div className="grid grid-cols-4 items-center gap-4">
                      <div className="text-right text-sm font-medium text-muted-foreground">Valor cuota</div>
                      <div className="col-span-3 text-lg font-semibold">${montoPorCuota}</div>
                    </div>
                  </>
                )}
              </>
            )} {/* Fin del fragmento de cuotas */}

            {/* --- Footer con Botón de Envío --- */}
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting || !form.formState.isValid}> {/* Deshabilitar si el form no es válido */}
                {isSubmitting ? "Procesando..." : "Registrar Transacción"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}