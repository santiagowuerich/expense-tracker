"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, CreditCard, Wallet, ShoppingCart } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase-browser"
import { useToast } from "@/components/ui/use-toast"
import { queryClient } from "@/lib/queries"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { v4 as uuidv4 } from "uuid"

type Tarjeta = {
  id: string
  alias: string
}

type Producto = {
  id: string
  nombre: string
  stock: number
}

// Esquema de validación para el formulario de gastos
const gastoSchema = z.object({
  tarjeta_id: z.string().min(1, "Selecciona una tarjeta"),
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  fecha: z.date({
    required_error: "Selecciona una fecha",
  }),
  descripcion: z.string().min(1, "Ingresa una descripción"),
  en_cuotas: z.boolean().default(false),
  cuotas: z.coerce.number().int().min(1).default(1),
  producto_id: z.string().optional(),
  cantidad: z.coerce.number().int().min(1).default(1),
  tipo: z.enum(["gasto", "compra"]).default("gasto"),
})

type GastoFormValues = z.infer<typeof gastoSchema>

// Función para descontar stock usando lógica LIFO
async function descontarStock(supabase: any, prodId: string, qty: number) {
  let pendiente = qty

  while (pendiente > 0) {
    const { data: compra, error } = await supabase
      .from("compras")
      .select("*")
      .eq("producto_id", prodId)
      .gt("restante", 0)
      .order("created_at", { ascending: false }) // LIFO
      .order("costo_unit", { ascending: false }) // tie-break
      .limit(1)
      .single()

    if (error || !compra) {
      throw new Error("Stock insuficiente")
    }

    const usar = Math.min(pendiente, compra.restante)

    const { error: updateError } = await supabase
      .from("compras")
      .update({ restante: compra.restante - usar })
      .eq("id", compra.id)

    if (updateError) {
      throw new Error("Error al actualizar el stock")
    }

    pendiente -= usar
  }

  // Sincronizar el stock del producto
  await supabase.rpc("update_stock_producto", { _prod_id: prodId })
}

// Función para aumentar el stock (nueva)
async function aumentarStock(supabase: any, prodId: string, qty: number, costo_unit: number) {
  try {
    // Registrar la compra
    const { data: compra, error: errorCompra } = await supabase
      .from("compras")
      .insert({
        producto_id: prodId,
        costo_unit: costo_unit,
        cantidad: qty,
        restante: qty,
      })
      .select()

    if (errorCompra) {
      throw new Error("Error al registrar la compra: " + errorCompra.message)
    }

    // Actualizar el stock del producto
    await supabase.rpc("update_stock_producto", { _prod_id: prodId })

    // Registrar en historial de precios si existe la tabla
    try {
      const { error: historyError } = await supabase.from("price_history").insert({
        producto_id: prodId,
        tipo: "costo",
        precio: costo_unit,
        compra_id: compra ? compra[0].id : null,
      })

      if (historyError && !historyError.message.includes("does not exist")) {
        console.error("Error al registrar historial de precios:", historyError)
      }
    } catch (error) {
      console.error("Error al verificar historial de precios:", error)
    }

    return compra
  } catch (error: any) {
    console.error("Error en aumentarStock:", error)
    throw error
  }
}

export default function ExpenseModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const [tipo, setTipo] = useState<"gasto" | "compra">("gasto")

  // Formulario con validación
  const form = useForm<GastoFormValues>({
    resolver: zodResolver(gastoSchema),
    defaultValues: {
      tarjeta_id: "",
      monto: undefined,
      fecha: new Date(),
      descripcion: "",
      en_cuotas: false,
      cuotas: 1,
      producto_id: undefined,
      cantidad: 1,
      tipo: "gasto",
    },
  })

  const enCuotas = form.watch("en_cuotas")
  const cuotas = form.watch("cuotas")
  const monto = form.watch("monto")
  const productoId = form.watch("producto_id")
  const cantidad = form.watch("cantidad")

  // Calcular el monto de cada cuota
  const montoPorCuota = monto && cuotas ? (monto / cuotas).toFixed(2) : "0.00"

  // Consultar tarjetas desde Supabase solo cuando el modal está abierto
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
        const { data, error } = await supabase.from("tarjetas").select("id, alias")

        if (error) {
          throw new Error(error.message)
        }

        return data || []
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
    enabled: open, // Solo ejecutar la consulta cuando el modal está abierto
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

        return data || []
      } catch (error: any) {
        console.error("Error al cargar productos:", error)
        return []
      }
    },
    enabled: open, // Solo ejecutar la consulta cuando el modal está abierto
  })

  // Obtener el stock disponible y costo del producto seleccionado
  const productoSeleccionado = productos?.find((p) => p.id === productoId)
  const stockDisponible = productoSeleccionado?.stock || 0

  // Consultar información detallada del producto seleccionado si es necesario
  const { data: productoDetalle, isLoading: isLoadingProductoDetalle } = useQuery({
    queryKey: ["producto", productoId],
    queryFn: async () => {
      if (!productoId || productoId === "no-producto") return null

      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("productos")
          .select("id, nombre, stock, costo_unit")
          .eq("id", productoId)
          .single()

        if (error) throw new Error(error.message)
        return data
      } catch (error) {
        console.error("Error al obtener detalles del producto:", error)
        return null
      }
    },
    enabled: !!productoId && productoId !== "no-producto" && tipo === "compra",
  })

  const handleTipoChange = (newTipo: "gasto" | "compra") => {
    setTipo(newTipo)
    form.setValue("tipo", newTipo)
  }

  const onSubmit = async (values: GastoFormValues) => {
    try {
      const supabase = createClient()

      // Generar un ID único para el pago (para idempotencia)
      const paymentIntentId = uuidv4()

      // Si hay un producto seleccionado
      if (values.producto_id && values.producto_id !== "no-producto") {
        if (tipo === "gasto") {
          // Verificar stock para gasto
          const { data: producto } = await supabase
            .from("productos")
            .select("stock")
            .eq("id", values.producto_id)
            .single()

          if (!producto || producto.stock < values.cantidad) {
            throw new Error("Stock insuficiente para este producto")
          }

          // Descontar stock usando lógica LIFO
          await descontarStock(supabase, values.producto_id, values.cantidad)
        } else if (tipo === "compra") {
          // Aumentar stock para compra
          const costoUnitario = productoDetalle?.costo_unit || 0
          await aumentarStock(supabase, values.producto_id, values.cantidad, costoUnitario)
        }
      }

      // Obtener información de la tarjeta para calcular el ciclo de cierre
      const { data: tarjeta, error: tarjetaError } = await supabase
        .from("tarjetas")
        .select("cierre_dia")
        .eq("id", values.tarjeta_id)
        .single()

      if (tarjetaError) {
        throw new Error(tarjetaError.message)
      }

      // Calcular el ciclo de cierre correctamente
      const fechaGasto = values.fecha
      const corteActual = new Date(fechaGasto.getFullYear(), fechaGasto.getMonth(), tarjeta.cierre_dia)

      // Si la fecha del gasto es posterior al cierre actual, el ciclo es el del mes siguiente
      const ciclo_cierre =
        fechaGasto > corteActual
          ? new Date(corteActual.getFullYear(), corteActual.getMonth() + 1, corteActual.getDate())
          : corteActual

      // Determinar si es un pago único o en cuotas
      const esEnCuotas = values.en_cuotas && values.cuotas > 1

      // Datos base para todos los pagos
      const pagoBase = {
        tarjeta_id: values.tarjeta_id,
        fecha: fechaGasto.toISOString(),
        producto_id: values.producto_id === "no-producto" ? null : values.producto_id || null,
        payment_intent_id: paymentIntentId,
      }

      if (!esEnCuotas) {
        // Guardar como pago único
        const { error: pagoError } = await supabase.from("pagos").insert({
          ...pagoBase,
          monto: values.monto,
          descripcion: values.descripcion,
          ciclo_cierre: ciclo_cierre.toISOString(),
          cuotas: 1,
          cuota_actual: 1,
          es_cuota: false,
        })

        if (pagoError) {
          throw new Error(pagoError.message)
        }
      } else {
        // Solo guardar las cuotas individuales para evitar doble conteo
        const montoPorCuota = Number((values.monto / values.cuotas).toFixed(2))
        const cuotasArray = Array.from({ length: values.cuotas }, (_, i) => i + 1)

        // Crear un array de objetos para inserción masiva
        const cuotasInsert = cuotasArray.map((numeroCuota) => {
          // Calcular la fecha de cierre para esta cuota
          const fechaCuota = new Date(ciclo_cierre)
          fechaCuota.setMonth(ciclo_cierre.getMonth() + numeroCuota - 1)

          return {
            ...pagoBase,
            monto: montoPorCuota,
            descripcion: `${values.descripcion} (Cuota ${numeroCuota}/${values.cuotas})`,
            ciclo_cierre: fechaCuota.toISOString(),
            cuotas: values.cuotas,
            cuota_actual: numeroCuota,
            es_cuota: true,
            pago_original_id: null, // No necesitamos esto ya que no guardamos el total
            payment_intent_id: `${paymentIntentId}-cuota-${numeroCuota}`,
          }
        })

        // Insertar todas las cuotas en una sola operación
        const { error: cuotasError } = await supabase.from("pagos").insert(cuotasInsert)

        if (cuotasError) {
          throw new Error(cuotasError.message)
        }
      }

      toast({
        title: tipo === "gasto" ? "Gasto registrado" : "Compra registrada",
        description:
          tipo === "gasto"
            ? "El gasto ha sido registrado exitosamente"
            : "La compra ha sido registrada y el stock ha sido actualizado",
      })

      // Invalidar la caché de consultas para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ["pagos"] })
      queryClient.invalidateQueries({ queryKey: ["resumen"] })
      queryClient.invalidateQueries({ queryKey: ["productos"] })

      // Limpiar el formulario
      form.reset({
        tarjeta_id: "",
        monto: undefined,
        fecha: new Date(),
        descripcion: "",
        en_cuotas: false,
        cuotas: 1,
        producto_id: undefined,
        cantidad: 1,
        tipo: "gasto",
      })
      setTipo("gasto")

      setOpen(false)
    } catch (error: any) {
      console.error("Error al guardar el gasto:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el registro",
        variant: "destructive",
      })
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
          <DialogTitle>{tipo === "gasto" ? "Anotar nuevo gasto" : "Registrar nueva compra"}</DialogTitle>
          <DialogDescription>
            {tipo === "gasto"
              ? "Ingresa los detalles del gasto que deseas registrar."
              : "Ingresa los detalles de la compra de producto para el inventario."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manual">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual" onClick={() => handleTipoChange("gasto")}>
              <Wallet className="mr-2 h-4 w-4" />
              Gasto Manual
            </TabsTrigger>
            <TabsTrigger value="card" onClick={() => handleTipoChange("gasto")}>
              <CreditCard className="mr-2 h-4 w-4" />
              Cargo Tarjeta
            </TabsTrigger>
            <TabsTrigger value="compra" onClick={() => handleTipoChange("compra")}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Compra Producto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
                          min="0"
                          placeholder="0.00"
                          className="col-span-3"
                          {...field}
                          value={field.value === undefined ? "" : field.value}
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
                        <PopoverContent className="w-auto p-0">
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
                        <Textarea placeholder="Descripción del gasto" className="col-span-3" {...field} />
                      </FormControl>
                      <FormMessage className="col-span-3 col-start-2" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="producto_id"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right">Producto</FormLabel>
                      <div className="col-span-3">
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value)
                            // Resetear cantidad si se deselecciona el producto
                            if (value === "no-producto" || !value) {
                              form.setValue("cantidad", 1)
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sin producto" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="no-producto">Sin producto</SelectItem>
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

                {productoId && productoId !== "no-producto" && (
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
                            max={stockDisponible}
                            className="col-span-3"
                            {...field}
                            value={field.value || 1}
                            onChange={(e) =>
                              field.onChange(e.target.value === "" ? 1 : Number.parseInt(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormDescription className="col-span-3 col-start-2">
                          Stock disponible: {stockDisponible}
                        </FormDescription>
                        <FormMessage className="col-span-3 col-start-2" />
                      </FormItem>
                    )}
                  />
                )}

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
                              value={field.value || 2}
                              onChange={(e) =>
                                field.onChange(e.target.value === "" ? 2 : Number.parseInt(e.target.value))
                              }
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

                <DialogFooter>
                  <Button type="submit">Guardar gasto</Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="card">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
                          min="0"
                          placeholder="0.00"
                          className="col-span-3"
                          {...field}
                          value={field.value === undefined ? "" : field.value}
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
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right">Descripción</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descripción del gasto" className="col-span-3" {...field} />
                      </FormControl>
                      <FormMessage className="col-span-3 col-start-2" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="producto_id"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right">Producto</FormLabel>
                      <div className="col-span-3">
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value)
                            // Resetear cantidad si se deselecciona el producto
                            if (value === "no-producto" || !value) {
                              form.setValue("cantidad", 1)
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sin producto" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="no-producto">Sin producto</SelectItem>
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

                {productoId && productoId !== "no-producto" && (
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
                            max={stockDisponible}
                            className="col-span-3"
                            {...field}
                            value={field.value || 1}
                            onChange={(e) =>
                              field.onChange(e.target.value === "" ? 1 : Number.parseInt(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormDescription className="col-span-3 col-start-2">
                          Stock disponible: {stockDisponible}
                        </FormDescription>
                        <FormMessage className="col-span-3 col-start-2" />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="cuotas"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right">Cuotas</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="48"
                          className="col-span-3"
                          {...field}
                          value={field.value || 1}
                          onChange={(e) => {
                            const value = e.target.value === "" ? 1 : Number.parseInt(e.target.value)
                            field.onChange(value)
                            form.setValue("en_cuotas", value > 1)
                          }}
                        />
                      </FormControl>
                      <FormMessage className="col-span-3 col-start-2" />
                    </FormItem>
                  )}
                />

                {Number.parseInt(form.getValues("cuotas").toString()) > 1 && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <div className="text-right text-sm font-medium">Valor de cada cuota</div>
                    <div className="col-span-3 text-lg font-semibold">${montoPorCuota}</div>
                  </div>
                )}

                <DialogFooter>
                  <Button type="submit">Procesar Pago</Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="compra">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
                          min="0"
                          placeholder="0.00"
                          className="col-span-3"
                          {...field}
                          value={field.value === undefined ? "" : field.value}
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
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right">Descripción</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descripción de la compra" className="col-span-3" {...field} />
                      </FormControl>
                      <FormMessage className="col-span-3 col-start-2" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="producto_id"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right">Producto</FormLabel>
                      <div className="col-span-3">
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value)
                            if (value === "no-producto" || !value) {
                              form.setValue("cantidad", 1)
                            }
                          }}
                        >
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

                {productoId && productoId !== "no-producto" && (
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
                            value={field.value || 1}
                            onChange={(e) =>
                              field.onChange(e.target.value === "" ? 1 : Number.parseInt(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormDescription className="col-span-3 col-start-2">
                          Unidades a añadir al inventario
                        </FormDescription>
                        <FormMessage className="col-span-3 col-start-2" />
                      </FormItem>
                    )}
                  />
                )}

                <DialogFooter>
                  <Button type="submit">Registrar Compra</Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
