"use client"

import type React from "react"
import { useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { createClient } from "@/lib/supabase-browser"
import { queryClient } from "@/lib/queries"
import { useQuery } from "@tanstack/react-query"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { v4 as uuidv4 } from "uuid"
import AddProductDialog from "@/components/add-product-dialog"
import { PlusSquare } from "lucide-react"

type Tarjeta = {
  id: string
  alias: string
  cierre_dia: number
}

type Producto = {
  id: string
  nombre: string
  stock: number
}

// Esquema de validación para el formulario de compras
const compraSchema = z.object({
  payment_method: z.enum(["tarjeta", "efectivo", "transferencia"], {
    required_error: "Selecciona un método de pago",
  }),
  tarjeta_id: z.string().optional(),
  producto_id: z.string().min(1, "Selecciona un producto"),
  cantidad: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1"),
  costo_unit: z.coerce.number().positive("El costo debe ser mayor a 0"),
  fecha: z.date({
    required_error: "Selecciona una fecha",
  }),
  descripcion: z.string().optional(),
  en_cuotas: z.boolean().default(false).optional(),
  cuotas: z.coerce.number().int().min(1).default(1).optional(),
}).refine((data) => {
  if (data.payment_method === 'tarjeta') {
    return !!data.tarjeta_id;
  }
  return true;
}, {
  message: "Debes seleccionar una tarjeta",
  path: ["tarjeta_id"],
}).refine((data) => {
  if (data.payment_method === 'tarjeta' && data.en_cuotas) {
    return data.cuotas && data.cuotas >= 2;
  }
  return true;
}, {
  message: "El número de cuotas debe ser al menos 2",
  path: ["cuotas"],
})

type CompraFormValues = z.infer<typeof compraSchema>

interface CompraConTarjetaDialogProps {
  children?: React.ReactNode
}

export default function CompraConTarjetaDialog({ children }: CompraConTarjetaDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  // Formulario con validación
  const form = useForm<CompraFormValues>({
    resolver: zodResolver(compraSchema),
    defaultValues: {
      payment_method: "tarjeta",
      tarjeta_id: "",
      producto_id: "",
      cantidad: 1,
      costo_unit: undefined,
      fecha: new Date(),
      descripcion: "",
      en_cuotas: false,
      cuotas: 1,
    },
  })

  const paymentMethod = form.watch("payment_method")
  const enCuotas = form.watch("en_cuotas")
  const cuotas = form.watch("cuotas")
  const monto = form.watch("costo_unit")
  const cantidad = form.watch("cantidad")

  // Calcular el monto total y por cuota
  const montoTotal = monto && cantidad ? monto * cantidad : 0
  const montoPorCuota = montoTotal && cuotas ? (montoTotal / cuotas).toFixed(2) : "0.00"

  // Consultar tarjetas desde Supabase
  const {
    data: tarjetas,
    isLoading: isLoadingTarjetas,
    error: errorTarjetas,
    refetch: refetchTarjetas,
  } = useQuery<Tarjeta[]>({
    queryKey: ["tarjetas"],
    queryFn: async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from("tarjetas").select("id, alias, cierre_dia")

        if (error) {
          throw new Error(error.message)
        }

        return (data as Tarjeta[]) || []
      } catch (error: any) {
        console.error("Error al cargar tarjetas:", error)
        toast({
          title: "Error al cargar tarjetas",
          description: error.message || "No se pudieron cargar las tarjetas",
          variant: "destructive",
        })
        return []
      }
    },
    enabled: open,
  })

  // Consultar productos desde Supabase
  const {
    data: productos,
    isLoading: isLoadingProductos,
    error: errorProductos,
  } = useQuery<Producto[]>({
    queryKey: ["productos"],
    queryFn: async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from("productos").select("id, nombre, stock").order("nombre")

        if (error) {
          throw new Error(error.message)
        }

        return (data as Producto[]) || []
      } catch (error: any) {
        console.error("Error al cargar productos:", error)
        return []
      }
    },
    enabled: open,
  })

  const onSubmit = async (values: CompraFormValues) => {
    setIsSubmitting(true)
    try {
      // Generar un ID único para la compra
      const compraId = uuidv4()

      let tarjeta = null;
      if(values.payment_method === 'tarjeta') {
        // Buscar la tarjeta seleccionada
        tarjeta = tarjetas?.find((t) => t.id === values.tarjeta_id)
        if (!tarjeta) {
          throw new Error("Tarjeta no encontrada")
        }
      }

      const descripcion = values.descripcion || `Compra de inventario: ${
        productos?.find((p) => p.id === values.producto_id)?.nombre || "Producto"
      } x ${values.cantidad}`;

      const transactionData = {
        payment_method: values.payment_method,
        tarjeta_id: values.payment_method === 'tarjeta' ? values.tarjeta_id : null,
        monto: values.costo_unit * values.cantidad,
        fecha: values.fecha.toISOString(),
        descripcion: descripcion,
        producto_id: values.producto_id,
        cantidad: values.cantidad,
        en_cuotas: values.payment_method === 'tarjeta' ? (values.en_cuotas ?? false) : false,
        cuotas: values.payment_method === 'tarjeta' && values.en_cuotas ? (values.cuotas ?? 1) : 1,
        payment_intent_id: compraId,
        tipo_transaccion: "gasto",
      };

      // Enviar datos a la API
      const response = await fetch("/api/register-transaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transactionData),
      });

      console.log({ transactionData })

      // Manejar la respuesta de la API

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || "Error al registrar la compra")
      }

      toast({
        title: "Compra registrada",
        description: "La compra se ha registrado correctamente.",
      })

      // Invalidar la caché de consultas para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      queryClient.invalidateQueries({ queryKey: ["compras"] })
      queryClient.invalidateQueries({ queryKey: ["resumen"] })

      // Limpiar el formulario
      form.reset({
        payment_method: "tarjeta",
        tarjeta_id: "",
        producto_id: "",
        cantidad: 1,
        costo_unit: undefined,
        fecha: new Date(),
        descripcion: "",
        en_cuotas: false,
        cuotas: 1,
      })

      setOpen(false)
    } catch (error: any) {
      console.error("Error al guardar la compra:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo registrar la compra",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen)
        if (newOpen) {
          refetchTarjetas() // Refrescar las tarjetas cuando se abre el modal
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Registrar Compra</DialogTitle>
          <DialogDescription>Registra una compra de producto para el inventario.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <FormLabel className="text-right">Método</FormLabel>
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
                          form.clearErrors("tarjeta_id");
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

            {paymentMethod === "tarjeta" && (
              <FormField
                control={form.control}
                name="tarjeta_id"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-right">Tarjeta</FormLabel>
                    <div className="col-span-3">
                      <Select value={field.value} onValueChange={field.onChange}>
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
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="producto_id"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <FormLabel className="text-right flex items-center justify-end">
                     Producto
                     <AddProductDialog>
                       <Button type="button" variant="ghost" size="icon" className="ml-1 h-6 w-6">
                         <PlusSquare className="h-4 w-4" />
                         <span className="sr-only">Agregar Producto</span>
                       </Button>
                     </AddProductDialog>
                   </FormLabel>
                  <div className="col-span-3">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar producto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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
                          <SelectItem value="empty" disabled>
                            No tienes productos registrados
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

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
                      className="col-span-3"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? 1 : Number.parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription className="col-span-3 col-start-2">Unidades a añadir al inventario</FormDescription>
                  <FormMessage className="col-span-3 col-start-2" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="costo_unit"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <FormLabel className="text-right">Costo unitario</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="col-span-3"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? undefined : Number.parseFloat(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage className="col-span-3 col-start-2" />
                </FormItem>
              )}
            />

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
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "PPP", { locale: es }) : "Seleccionar fecha"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <FormMessage className="col-span-3 col-start-2" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <FormLabel className="text-right">Descripción</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descripción de la compra (opcional)" className="col-span-3" {...field} />
                  </FormControl>
                  <FormMessage className="col-span-3 col-start-2" />
                </FormItem>
              )}
            />

            {paymentMethod === "tarjeta" && (
              <>
                <FormField
                  control={form.control}
                  name="en_cuotas"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right">En cuotas</FormLabel>
                      <div className="flex items-center space-x-2 col-span-3">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormDescription>Dividir el pago en cuotas mensuales</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {enCuotas && (
                  <>
                    <FormField
                      control={form.control}
                      name="cuotas"
                      render={({ field }) => (
                        <FormItem className="grid grid-cols-4 items-center gap-4">
                          <FormLabel className="text-right">Número de cuotas</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="2"
                              max="48"
                              className="col-span-3"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value === "" ? 2 : Number.parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage className="col-span-3 col-start-2" />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-4 items-center gap-4">
                      <div className="text-right text-sm font-medium">Valor de cada cuota</div>
                      <div className="col-span-3 text-lg font-semibold">${montoPorCuota}</div>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <div className="text-right text-sm font-medium">Total compra</div>
              <div className="col-span-3 text-lg font-semibold">${montoTotal.toFixed(2)}</div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Registrar Compra"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
