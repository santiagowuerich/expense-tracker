"use client"

import { useQuery } from "@tanstack/react-query"
import { format, addMonths, parseISO, addDays, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { ArrowLeft, Download, CalendarIcon, Check, ChevronsUpDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase-browser"
import { useState } from "react"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import AddCardDialog from "@/components/add-card-dialog"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

type Tarjeta = {
  id: string
  alias: string
  cierre_dia: number
  venc_dia: number
}

type Pago = {
  id: string
  tarjeta_id: string
  monto: number
  fecha: string
  descripcion: string
  ciclo_cierre: string
  cuotas: number
  cuota_actual: number
  es_cuota: boolean
  pago_original_id: string | null
  producto_id: string | null
  producto_nombre: string | null
  payment_intent_id: string
  categoria_nombre?: string
  payment_method: string
}

type ResumenData = {
  tarjetas: Tarjeta[]
  pagos: Pago[]
  totales: {
    totalActual: number
    totalNext: number
    totalFuturo: number
  }
  categorias: {
    nombre: string
    total: number
  }[]
  nextClosureDate?: Date
}

// Función para calcular la próxima fecha de vencimiento
function calcularProximoVencimiento(vencDia: number): Date {
  const now = new Date()
  const mesActual = { year: now.getFullYear(), month: now.getMonth() }

  // Fecha de vencimiento del mes actual
  const fechaVto = new Date(mesActual.year, mesActual.month, vencDia)

  // Si la fecha de vencimiento ya pasó, avanzamos al próximo mes
  return fechaVto <= now ? addMonths(fechaVto, 1) : fechaVto
}

// Función para calcular la fecha de corte (cierre) actual
function calcularFechaCorte(cierreDia: number): Date {
  const now = new Date()
  const mesActual = { year: now.getFullYear(), month: now.getMonth() }

  // Fecha de cierre del mes actual
  const fechaCierre = new Date(mesActual.year, mesActual.month, cierreDia)

  // Si la fecha de cierre ya pasó, avanzamos al próximo mes
  return fechaCierre <= now ? addMonths(fechaCierre, 1) : fechaCierre
}

// Función para formatear montos con Intl.NumberFormat
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount)
}

// Colores para el gráfico de categorías
const COLORS = ["#8884d8", "#83a6ed", "#8dd1e1", "#82ca9d", "#a4de6c", "#d0ed57", "#ffc658"]

// Función para agrupar gastos por mes
function agruparGastosPorMes(pagos: Pago[]): { mes: string; total: number }[] {
  const mesesMap = new Map<string, number>()

  pagos.forEach((pago) => {
    const fecha = new Date(pago.fecha)
    const mesKey = format(fecha, "yyyy-MM")
    const mesLabel = format(fecha, "MMM yyyy", { locale: es })

    const total = mesesMap.get(mesKey) || 0
    mesesMap.set(mesKey, total + pago.monto)
  })

  // Convertir a array y ordenar por fecha
  return Array.from(mesesMap.entries())
    .map(([mesKey, total]) => ({
      mes: format(new Date(mesKey + "-01"), "MMM yyyy", { locale: es }),
      total,
    }))
    .sort((a, b) => {
      const fechaA = new Date(a.mes)
      const fechaB = new Date(b.mes)
      return fechaA.getTime() - fechaB.getTime()
    })
}

export default function ResumenPage() {
  const router = useRouter()
  const [incluirCuotasFuturas, setIncluirCuotasFuturas] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  })
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [openCategoryDropdown, setOpenCategoryDropdown] = useState(false)

  const { data, isLoading, error } = useQuery<ResumenData>({
    queryKey: ["resumen", incluirCuotasFuturas, dateRange, selectedCategory],
    queryFn: async () => {
      try {
        const supabase = createClient()

        // Obtener tarjetas
        const { data: tarjetas, error: tarjetasError } = await supabase
          .from("tarjetas")
          .select("id, alias, cierre_dia, venc_dia")

        if (tarjetasError) {
          throw new Error(tarjetasError.message)
        }

        // Obtener pagos excluyendo los registros totales de pagos a cuotas
        const { data: pagos, error: pagosError } = await supabase
          .from("pagos")
          .select(`
            id, tarjeta_id, monto, fecha, descripcion, ciclo_cierre, 
            cuotas, cuota_actual, es_cuota, pago_original_id, producto_id, payment_intent_id, payment_method,
            productos (nombre, categoria_id, categorias(nombre))
          `)
          .neq("cuota_actual", 0) // Excluir registros de totales (cuota_actual = 0)
          .order("payment_intent_id", { ascending: true })

        if (pagosError) {
          throw new Error(pagosError.message)
        }

        // Filtrar pagos duplicados usando payment_intent_id
        const pagosUnicos = pagos.filter(
          (pago, index, self) => index === self.findIndex((p) => p.payment_intent_id === pago.payment_intent_id),
        )

        // Transformar los datos para incluir el nombre del producto y categoría
        const pagosTransformados = pagosUnicos.map((pago) => {
          const producto = pago.productos || {}
          // Acceder correctamente a la categoría
          let categoriaNombre = "Sin categoría"
          if (producto.categorias && Array.isArray(producto.categorias) && producto.categorias.length > 0) {
            categoriaNombre = producto.categorias[0].nombre
          } else if (producto.categorias && typeof producto.categorias === "object" && producto.categorias.nombre) {
            categoriaNombre = producto.categorias.nombre
          }

          return {
            ...pago,
            producto_nombre: producto.nombre || null,
            categoria_nombre: categoriaNombre,
            productos: undefined, // Eliminar el objeto anidado
          }
        })

        // Filtrar pagos por rango de fechas si está definido
        let pagosFiltrados = pagosTransformados
        if (dateRange?.from && dateRange?.to) {
          pagosFiltrados = pagosTransformados.filter((pago) => {
            const fechaPago = startOfDay(new Date(pago.fecha))
            return isWithinInterval(fechaPago, {
              start: startOfDay(dateRange.from as Date),
              end: endOfDay(dateRange.to as Date),
            })
          })
        }

        // Filtrar pagos por categoría si está seleccionada
        if (selectedCategory) {
          pagosFiltrados = pagosFiltrados.filter((pago) => pago.categoria_nombre === selectedCategory)
        }

        // Calcular totales para cada tarjeta usando la nueva lógica
        const totales = {
          totalActual: 0,
          totalNext: 0,
          totalFuturo: 0,
        }

        // Agrupar pagos por categoría
        const categoriaMap = new Map<string, number>()

        // Obtener la fecha actual
        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()

        // Calcular el mes siguiente
        const nextMonth = (currentMonth + 1) % 12
        const nextMonthYear = nextMonth === 0 ? currentYear + 1 : currentYear

        // Calcular la fecha del próximo ciclo de cierre (para todas las tarjetas)
        // Usamos la primera tarjeta como referencia, pero idealmente esto debería ser por tarjeta
        const nextClosureDate =
          tarjetas.length > 0 ? calcularProximoCierreMes(tarjetas[0].cierre_dia) : addMonths(new Date(), 1)

        // Procesar cada pago para calcular totales
        pagosFiltrados.forEach((pago) => {
          // Sumar al total actual (todos los pagos)
          totales.totalActual += pago.monto

          // Sumar al total del próximo mes solo si es tarjeta y tiene ciclo_cierre en el próximo mes
          if (pago.payment_method === "tarjeta" && pago.ciclo_cierre) {
            const fechaCierre = new Date(pago.ciclo_cierre)
            if (
              fechaCierre.getMonth() === nextClosureDate.getMonth() &&
              fechaCierre.getFullYear() === nextClosureDate.getFullYear()
            ) {
              totales.totalNext += pago.monto
            }
          }

          // Si quedan cuotas por pagar y se debe incluir en el total futuro
          if (pago.payment_method === "tarjeta") {
            const cuotasRestantes = pago.cuotas - pago.cuota_actual
            if (incluirCuotasFuturas && cuotasRestantes > 0) {
              totales.totalFuturo += pago.monto * cuotasRestantes
            }
          }

          // Agrupar por categoría
          const categoriaNombre = pago.categoria_nombre || "Sin categoría"
          const categoriaTotal = categoriaMap.get(categoriaNombre) || 0
          categoriaMap.set(categoriaNombre, categoriaTotal + pago.monto)
        })

        // Convertir el mapa de categorías a un array para el gráfico
        const categorias = Array.from(categoriaMap.entries()).map(([nombre, total]) => ({
          nombre,
          total,
        }))

        return {
          tarjetas: tarjetas || [],
          pagos: pagosFiltrados || [],
          totales,
          categorias,
          nextClosureDate,
        }
      } catch (error) {
        console.error("Error al obtener datos:", error)
        return {
          tarjetas: [],
          pagos: [],
          totales: { totalActual: 0, totalNext: 0, totalFuturo: 0 },
          categorias: [],
          nextClosureDate: addMonths(new Date(), 1),
        }
      }
    },
  })

  // Función para calcular la fecha de cierre del próximo mes
  function calcularProximoCierreMes(cierreDia: number): Date {
    const now = new Date()
    // Crear fecha con el día de cierre del próximo mes
    return new Date(now.getFullYear(), now.getMonth() + 1, cierreDia)
  }

  // Función para descargar CSV
  const descargarCSV = () => {
    if (!data || !data.pagos || data.pagos.length === 0) {
      return
    }

    // Crear cabecera del CSV
    const cabecera = ["Fecha", "Descripción", "Monto", "Método de Pago", "Producto", "Categoría"].join(",")

    // Crear filas del CSV
    const filas = data.pagos
      .map((pago) => {
        const fecha = format(parseISO(pago.fecha), "dd/MM/yyyy")
        const descripcion = `"${pago.descripcion.replace(/"/g, '""')}"`
        const monto = pago.monto.toString().replace(".", ",")
        const metodoPago = pago.payment_method || "tarjeta"
        const producto = pago.producto_nombre ? `"${pago.producto_nombre.replace(/"/g, '""')}"` : ""
        const categoria = pago.categoria_nombre ? `"${pago.categoria_nombre.replace(/"/g, '""')}"` : ""

        return [fecha, descripcion, monto, metodoPago, producto, categoria].join(",")
      })
      .join("\n")

    // Combinar cabecera y filas
    const csv = `${cabecera}\n${filas}`

    // Crear blob y descargar
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "resumen.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Formatear la fecha del próximo cierre para mostrar en la UI
  const nextClosureDateFormatted = data?.nextClosureDate
    ? format(data.nextClosureDate, "d 'de' MMMM 'de' yyyy", { locale: es })
    : ""

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="mr-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <h1 className="text-3xl font-bold text-primary">Resumen de Gastos</h1>
        </div>
        <Button variant="outline" onClick={descargarCSV}>
          <Download className="mr-2 h-4 w-4" />
          Descargar CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[120px] w-full rounded-2xl" />
          <Skeleton className="h-[120px] w-full rounded-2xl" />
          <Skeleton className="h-[120px] w-full rounded-2xl" />
        </div>
      ) : error ? (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>Ocurrió un error al cargar el resumen. Por favor, intenta nuevamente.</CardDescription>
          </CardHeader>
        </Card>
      ) : !data || !data.tarjetas || data.tarjetas.length === 0 ? (
        <EmptyState
          title="Sin tarjetas registradas"
          description="Agrega tu primera tarjeta para empezar a anotar gastos."
          action={<AddCardDialog />}
        />
      ) : (
        <>
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="incluir-cuotas-futuras"
                  checked={incluirCuotasFuturas}
                  onCheckedChange={setIncluirCuotasFuturas}
                />
                <label
                  htmlFor="incluir-cuotas-futuras"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Incluir cuotas posteriores al próximo mes
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Popover open={openCategoryDropdown} onOpenChange={setOpenCategoryDropdown}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openCategoryDropdown}
                      className="w-[200px] justify-between"
                    >
                      {selectedCategory || "Todas las categorías"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar categoría..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron categorías.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => {
                              setSelectedCategory(null)
                              setOpenCategoryDropdown(false)
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${!selectedCategory ? "opacity-100" : "opacity-0"}`} />
                            Todas las categorías
                          </CommandItem>
                          {data?.categorias.map((categoria) => (
                            <CommandItem
                              key={categoria.nombre}
                              onSelect={() => {
                                setSelectedCategory(categoria.nombre === selectedCategory ? null : categoria.nombre)
                                setOpenCategoryDropdown(false)
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  categoria.nombre === selectedCategory ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              {categoria.nombre}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="w-full">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className="w-full sm:w-[300px] justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "d MMM yyyy", { locale: es })} -{" "}
                          {format(dateRange.to, "d MMM yyyy", { locale: es })}
                        </>
                      ) : (
                        format(dateRange.from, "d MMM yyyy", { locale: es })
                      )
                    ) : (
                      <span>Seleccionar fechas</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {data.tarjetas.map((tarjeta) => {
              // Filtrar pagos por tarjeta, solo considerando los pagos que no son totales
              const pagosDeEsaTarjeta = data.pagos.filter((pago) => pago.tarjeta_id === tarjeta.id)

              // Calcular subtotal solo de los pagos que se muestran
              const subtotal = pagosDeEsaTarjeta.reduce((total, pago) => total + pago.monto, 0)
              const proximoVencimiento = calcularProximoVencimiento(tarjeta.venc_dia)

              return (
                <Accordion type="single" collapsible key={tarjeta.id} className="rounded-2xl shadow-sm border">
                  <AccordionItem value="item-1" className="border-none">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 rounded-t-2xl">
                      <div className="flex flex-col items-start text-left">
                        <div className="flex items-center">
                          <span className="text-xl font-semibold">{tarjeta.alias}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Vence: {format(proximoVencimiento, "d MMM yyyy", { locale: es })} • Total:{" "}
                          {formatCurrency(subtotal)}
                        </p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-0">
                      {pagosDeEsaTarjeta.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Descripción</TableHead>
                              <TableHead>Método</TableHead>
                              <TableHead>Categoría</TableHead>
                              <TableHead className="text-right">Monto</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pagosDeEsaTarjeta.map((pago) => (
                              <TableRow key={pago.id}>
                                <TableCell>{format(parseISO(pago.fecha), "d MMM", { locale: es })}</TableCell>
                                <TableCell>
                                  {pago.descripcion}
                                  {pago.es_cuota && pago.cuotas > 1 && (
                                    <Badge variant="outline" className="ml-2">
                                      Cuota {pago.cuota_actual}/{pago.cuotas}
                                    </Badge>
                                  )}
                                  {pago.producto_nombre && (
                                    <Badge variant="secondary" className="ml-2">
                                      {pago.producto_nombre}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="capitalize">
                                    {pago.payment_method || "tarjeta"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {pago.categoria_nombre && <Badge variant="outline">{pago.categoria_nombre}</Badge>}
                                </TableCell>
                                <TableCell className="text-right">{formatCurrency(pago.monto)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell colSpan={4} className="font-bold">
                                Subtotal
                              </TableCell>
                              <TableCell className="text-right font-bold">{formatCurrency(subtotal)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="py-4 px-6 text-center text-muted-foreground">
                          No hay gastos registrados para esta tarjeta.
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )
            })}
          </div>

          <div className="space-y-4 mb-8">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Total General</CardTitle>
                <CardDescription>
                  Suma de todos los gastos registrados. Incluye efectivo y transferencias.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <p className="text-2xl font-bold">{formatCurrency(data.totales.totalActual)}</p>
              </CardFooter>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Total a pagar próximo mes</CardTitle>
                <CardDescription>
                  {data.totales.totalNext > 0
                    ? "Comprende los movimientos con tarjeta con ciclo de cierre del próximo mes."
                    : "No hay gastos con tarjeta para el próximo ciclo de cierre."}
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-2xl font-bold">{formatCurrency(data.totales.totalNext || 0)}</p>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Sólo cargos con tarjeta que vencen en {nextClosureDateFormatted}.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardFooter>
            </Card>

            {incluirCuotasFuturas && (
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Total cuotas futuras</CardTitle>
                  <CardDescription>Suma de todas las cuotas con vencimiento posterior al próximo ciclo</CardDescription>
                </CardHeader>
                <CardFooter>
                  <p className="text-2xl font-bold">{formatCurrency(data.totales.totalFuturo)}</p>
                </CardFooter>
              </Card>
            )}
          </div>

          {data.categorias && data.categorias.length > 0 && (
            <Card className="rounded-2xl shadow-sm mb-8">
              <CardHeader>
                <CardTitle>Distribución por categoría</CardTitle>
                <CardDescription>Gastos agrupados por categoría de producto</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.categorias}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="total"
                        nameKey="nombre"
                        label={({ nombre, percent }) => `${nombre}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {data.categorias.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {data.pagos && data.pagos.length > 0 && (
            <Card className="rounded-2xl shadow-sm mb-8">
              <CardHeader>
                <CardTitle>Gastos mensuales</CardTitle>
                <CardDescription>Evolución de gastos a lo largo del tiempo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={agruparGastosPorMes(data.pagos)}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 60,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                      <YAxis
                        tickFormatter={(value) =>
                          new Intl.NumberFormat("es-AR", {
                            style: "currency",
                            currency: "ARS",
                            notation: "compact",
                            maximumFractionDigits: 1,
                          }).format(value)
                        }
                      />
                      <RechartsTooltip
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => `Mes: ${label}`}
                      />
                      <Bar dataKey="total" fill="#8884d8" name="Total" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
