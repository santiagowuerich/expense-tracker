"use client"

import { useQuery } from "@tanstack/react-query"
import { format, addMonths, parseISO, addDays, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { ArrowLeft, Download, CalendarIcon, Check, ChevronsUpDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase-browser"
import { useState, useMemo } from "react"
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
import PagosFuturosPorMes from "@/components/pagos-futuros-por-mes"

// Definiciones de tipos existentes
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
  producto_nombre: string | null // Aplanado
  payment_intent_id: string
  categoria_nombre?: string // Aplanado
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

// Tipo intermedio para la respuesta cruda de Supabase con relaciones anidadas
type PagoRaw = {
  id: string;
  tarjeta_id: string;
  monto: number;
  fecha: string;
  descripcion: string;
  ciclo_cierre: string;
  cuotas: number;
  cuota_actual: number;
  es_cuota: boolean;
  pago_original_id: string | null;
  producto_id: string | null;
  payment_intent_id: string;
  payment_method: string;
  productos: { // Corresponde a 'productos (nombre, categorias(nombre))'
    nombre: string | null;
    categorias: { nombre: string | null } | null; // Corresponde a 'categorias(nombre)' dentro de productos
  } | null; // 'productos' puede ser null si no hay producto asociado
};


// Función para calcular la próxima fecha de vencimiento
function calcularProximoVencimiento(vencDia: number): Date {
  const now = new Date()
  const mesActual = { year: now.getFullYear(), month: now.getMonth() }

  // Fecha de vencimiento del mes actual
  const fechaVto = new Date(mesActual.year, mesActual.month, vencDia)

  // Si la fecha de vencimiento ya pasó, avanzamos al próximo mes
  return fechaVto <= now ? addMonths(fechaVto, 1) : fechaVto
}

// Función para calcular la fecha de corte (cierre) actual (parece no usarse en el componente)
function calcularFechaCorte(cierreDia: number): Date {
  const now = new Date()
  const mesActual = { year: now.getFullYear(), month: now.getMonth() }

  // Fecha de cierre del mes actual
  const fechaCierre = new Date(mesActual.year, mesActual.month, cierreDia)

  // Si la fecha de cierre ya pasó, avanzamos al próximo mes
  return fechaCierre <= now ? addMonths(fechaCierre, 1) : fechaCierre
}

// Función para calcular la fecha de cierre del próximo mes (usada para el totalNext)
function calcularProximoCierreMes(cierreDia: number): Date {
  const now = new Date();
  // Crear fecha con el día de cierre del próximo mes
  return new Date(now.getFullYear(), now.getMonth() + 1, cierreDia);
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

// Función para agrupar gastos por mes (parece no usarse en el componente)
// Función para agrupar gastos por mes (mejorada)
function agruparGastosPorMes(pagos: Pago[]): { mes: string; total: number }[] {
  const mesesMap = new Map<string, number>()

  pagos.forEach((pago) => {
   try {
     const fecha = parseISO(pago.fecha); // Intentar parsear
     const mesKey = format(fecha, "yyyy-MM");
     const total = mesesMap.get(mesKey) || 0;
     mesesMap.set(mesKey, total + pago.monto);
   } catch (e) {
     console.warn(`Fecha inválida encontrada en pago ${pago.id}: ${pago.fecha}`);
     // Opcional: manejar el error de otra forma
   }
 })

  // Convertir a array y ordenar por fecha
  // Convertir a array, ordenar por clave y luego formatear
  return Array.from(mesesMap.entries())
   .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // Ordenar por yyyy-MM
   .map(([mesKey, total]) => ({
     mes: format(parseISO(mesKey + "-01"), "MMM yy", { locale: es }), // Formato MMM yy
     total,
   }))
 }


export default function ResumenPage() {
  const router = useRouter()
  const [incluirCuotasFuturas, setIncluirCuotasFuturas] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => { // Lazy initial state
    const today = new Date();
    return {
      from: addDays(today, -30),
      to: today,
    };
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [openCategoryDropdown, setOpenCategoryDropdown] = useState(false)

  // Query para obtener TODOS los datos base (tarjetas y pagos transformados)
  // La queryKey ahora es simple, ya no depende de los filtros locales
  const { data: baseData, isLoading: isLoadingBaseData, error: baseError } = useQuery({
    queryKey: ["resumenBase"], // Clave simple
    queryFn: async () => {
      const supabase = createClient()

      // 1. Obtener tarjetas y **realizar cast** a Tarjeta[]
      const { data: tarjetasData, error: tarjetasError } = await supabase
        .from("tarjetas")
        .select("id, alias, cierre_dia, venc_dia")

      if (tarjetasError) {
        throw new Error(tarjetasError.message)
      }
      const typedTarjetas: Tarjeta[] = tarjetasData as Tarjeta[];

      // 2. Obtener pagos con relaciones anidadas y **realizar cast** a PagoRaw[]
      const { data: pagosData, error: pagosError } = await supabase
        .from("pagos")
        .select(`
          id, tarjeta_id, monto, fecha, descripcion, ciclo_cierre,
          cuotas, cuota_actual, es_cuota, pago_original_id, producto_id, payment_intent_id, payment_method,
          productos (nombre, categorias(nombre))
        `)
        .neq("cuota_actual", 0) // Excluir registros de totales (cuota_actual = 0)

      if (pagosError) {
        throw new Error(pagosError.message)
      }

      const typedPagosRaw: PagoRaw[] = pagosData as unknown as PagoRaw[];


      // 3. Filtrar pagos duplicados usando ID (sobre datos tipados)
      // Esto filtra por ID del pago, no de la serie de cuotas.
      const pagosUnicosRaw = typedPagosRaw.filter(
        (pago, index, self) => index === self.findIndex((p) => p.id === pago.id),
      )


      // 4. Transformar datos crudos (PagoRaw) a la estructura Pago deseada (aplanando relaciones)
      const pagosTransformados: Pago[] = pagosUnicosRaw.map((pagoRaw) => {
        // Acceder a los datos anidados de forma segura y aplanar
        const productoNombre = pagoRaw.productos?.nombre || null;
        // Acceder a la categoría a través del producto anidado
        const categoriaNombre = pagoRaw.productos?.categorias?.nombre || "Sin categoría";


        return {
          // Mapear todas las propiedades requeridas por el tipo Pago
          id: pagoRaw.id,
          tarjeta_id: pagoRaw.tarjeta_id,
          monto: pagoRaw.monto,
          fecha: pagoRaw.fecha,
          descripcion: pagoRaw.descripcion,
          ciclo_cierre: pagoRaw.ciclo_cierre,
          cuotas: pagoRaw.cuotas,
          cuota_actual: pagoRaw.cuota_actual,
          es_cuota: pagoRaw.es_cuota,
          pago_original_id: pagoRaw.pago_original_id,
          producto_id: pagoRaw.producto_id,
          payment_intent_id: pagoRaw.payment_intent_id,
          payment_method: pagoRaw.payment_method,
          // Propiedades aplanadas
          producto_nombre: productoNombre,
          categoria_nombre: categoriaNombre,
          // Omitir el objeto anidado 'productos'
        };
      });


      return {
        tarjetas: typedTarjetas, // Usar el array tipado
        pagos: pagosTransformados, // Devolver todos los pagos transformados
      };
    },
  });

  // --- Procesamiento y filtrado en el cliente ---
  // Usamos useMemo para evitar recalcular en cada render a menos que las dependencias cambien
  const processedData = useMemo(() => {
    if (!baseData) {
      return {
        tarjetas: [],
        pagosFiltrados: [],
        totales: { totalActual: 0, totalNext: 0, totalFuturo: 0 },
        categorias: [],
        nextClosureDate: addMonths(new Date(), 1),
        allCategorias: [], // Añadir lista de todas las categorías disponibles
      };
    }

    const { tarjetas, pagos: todosLosPagos } = baseData;

    // Extraer todas las categorías únicas de todos los pagos para el dropdown
    const allCategoriasSet = new Set<string>();
    todosLosPagos.forEach(p => {
      if (p.categoria_nombre) allCategoriasSet.add(p.categoria_nombre);
    });
    const allCategorias = Array.from(allCategoriasSet).sort().map(nombre => ({ nombre, total: 0 })); // Inicializar total a 0


    // 5. Filtrar pagos por rango de fechas y categoría (usando los pagos base)
    let pagosFiltrados = todosLosPagos;

    if (dateRange?.from && dateRange?.to) {
      const start = startOfDay(dateRange.from);
      const end = endOfDay(dateRange.to);
      pagosFiltrados = pagosFiltrados.filter((pago) => {
         try {
            const fechaPago = startOfDay(parseISO(pago.fecha));
            return isWithinInterval(fechaPago, { start, end });
         } catch {
             return false; // Ignorar fechas inválidas en el filtro
         }
      });
    }

    if (selectedCategory) {
      pagosFiltrados = pagosFiltrados.filter((pago) => pago.categoria_nombre === selectedCategory);
    }

    // 6. Calcular totales y categorías **basado en pagosFiltrados**
    const totales = { totalActual: 0, totalNext: 0, totalFuturo: 0 };
    const nextClosureDates: Record<string, Date> = tarjetas.reduce((acc, t) => {
      acc[t.id] = calcularProximoCierreMes(t.cierre_dia);
      return acc;
    }, {} as Record<string, Date>);
    const categoriaMap = new Map<string, number>();

    pagosFiltrados.forEach((pago) => {
      totales.totalActual += pago.monto;

      // Calcular totalNext
      if (pago.payment_method === "tarjeta" && pago.tarjeta_id && pago.ciclo_cierre) {
        const tarjetaId = pago.tarjeta_id;
        const proximoCierreTarjeta = nextClosureDates[tarjetaId];
        if (proximoCierreTarjeta) {
          try {
              const fechaCierrePago = parseISO(pago.ciclo_cierre);
              if (fechaCierrePago.getFullYear() === proximoCierreTarjeta.getFullYear() &&
                  fechaCierrePago.getMonth() === proximoCierreTarjeta.getMonth()) {
                  totales.totalNext += pago.monto;
              }
          } catch {
              console.warn(`Fecha ciclo_cierre inválida: ${pago.ciclo_cierre}`);
          }
        }
      }

      // Calcular totalFuturo
      if (pago.payment_method === "tarjeta" && incluirCuotasFuturas && pago.cuotas > 1 && pago.cuota_actual) {
        const cuotasRestantes = pago.cuotas - pago.cuota_actual;
        if (cuotasRestantes > 0) {
          totales.totalFuturo += pago.monto * cuotasRestantes;
        }
      }

      // Agrupar por categoría
      const categoriaNombre = pago.categoria_nombre || "Sin categoría";
      const categoriaTotal = categoriaMap.get(categoriaNombre) || 0;
      categoriaMap.set(categoriaNombre, categoriaTotal + pago.monto);
    });

    const categoriasFiltradas = Array.from(categoriaMap.entries()).map(([nombre, total]) => ({
      nombre,
      total,
    }));

    const displayNextClosureDate = tarjetas.length > 0
      ? calcularProximoCierreMes(tarjetas[0].cierre_dia)
      : addMonths(new Date(), 1);

    return {
      tarjetas: tarjetas,
      pagosFiltrados: pagosFiltrados, // Los pagos que se mostrarán en las tablas
      totales,
      categorias: categoriasFiltradas, // Categorías basadas en los filtros
      nextClosureDate: displayNextClosureDate,
      allCategorias: allCategorias, // Todas las categorías para el dropdown
    };

  }, [baseData, dateRange, selectedCategory, incluirCuotasFuturas]); // Dependencias de useMemo

  // Extraer los datos procesados
  const {
      tarjetas,
      pagosFiltrados,
      totales,
      categorias: categoriasFiltradas, // Renombrar para claridad
      nextClosureDate,
      allCategorias // Usar esta para el dropdown
  } = processedData;

  // Formatear la fecha del próximo cierre para mostrar en la UI
  const nextClosureDateFormatted = nextClosureDate
    ? format(nextClosureDate, "d 'de' MMMM 'de' yyyy", { locale: es })
    : ""

  // Función para descargar CSV
  const descargarCSV = () => {
    if (!pagosFiltrados || pagosFiltrados.length === 0) {
      return
    }

    // Crear cabecera del CSV
    const cabecera = ["Fecha", "Descripción", "Monto", "Método de Pago", "Producto", "Categoría"].join(",");

    // Crear filas del CSV
    const filas = pagosFiltrados
      .map((pago) => {
        let fechaStr = "Fecha inválida";
        try {
          fechaStr = format(parseISO(pago.fecha), "dd/MM/yyyy");
        } catch {}
        const descripcion = `"${pago.descripcion.replace(/"/g, '""')}"` // Escapar comillas dobles
        const monto = pago.monto.toString().replace(".", ",") // Formato ARS usa coma decimal
        const metodoPago = pago.payment_method || "tarjeta"
        const producto = pago.producto_nombre ? `"${pago.producto_nombre.replace(/"/g, '""')}"` : ""
        const categoria = pago.categoria_nombre ? `"${pago.categoria_nombre.replace(/"/g, '""')}"` : ""

        return [fechaStr, descripcion, monto, metodoPago, producto, categoria].join(",");
      })
      .join("\n")

    // Combinar cabecera y filas
    const csv = `${cabecera}\n${filas}`;

    // Crear blob y descargar
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" }); // Añadir BOM para Excel
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "resumen.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Función para renderizar Popover de Categorías (modificada para usar allCategorias)
  const renderCategoryPopoverContent = () => {
    // No necesita verificar baseData aquí porque allCategorias se inicializa
    return (
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Buscar categoría..." />
          <CommandList>
            <CommandEmpty>No se encontraron categorías.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setSelectedCategory(null);
                  setOpenCategoryDropdown(false);
                }}
              >
                <Check className={`mr-2 h-4 w-4 ${!selectedCategory ? "opacity-100" : "opacity-0"}`} />
                Todas las categorías
              </CommandItem>
              {allCategorias.map((categoria) => (
                <CommandItem
                  key={categoria.nombre}
                  onSelect={() => {
                    setSelectedCategory(categoria.nombre === selectedCategory ? null : categoria.nombre);
                    setOpenCategoryDropdown(false);
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
    );
  };

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
        <Button variant="outline" onClick={descargarCSV} disabled={!pagosFiltrados || pagosFiltrados.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Descargar CSV
        </Button>
      </div>

      {isLoadingBaseData ? (
        <div className="space-y-4">
          <Skeleton className="h-[120px] w-full rounded-2xl" />
          <Skeleton className="h-[120px] w-full rounded-2xl" />
          <Skeleton className="h-[120px] w-full rounded-2xl" />
        </div>
      ) : baseError ? (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>Ocurrió un error al cargar los datos base. Por favor, intenta nuevamente. {baseError.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : !tarjetas || tarjetas.length === 0 ? (
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
                  {renderCategoryPopoverContent()}
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
                          {format(dateRange.from, "d MMM", { locale: es })} -{" "}
                          {format(dateRange.to, "d MMM", { locale: es })}
                        </>
                      ) : (
                        format(dateRange.from, "d MMM", { locale: es })
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
            {tarjetas.map((tarjeta) => {
              // Filtrar pagos por tarjeta, usando los pagos ya filtrados por fecha/categoría
              const pagosDeEsaTarjeta = pagosFiltrados.filter((pago) => pago.tarjeta_id === tarjeta.id);

              // Calcular subtotal solo de los pagos que se muestran (filtrados por tarjeta y rango/categoría)
              const subtotal = pagosDeEsaTarjeta.reduce((total, pago) => total + pago.monto, 0)
              const proximoVencimiento = calcularProximoVencimiento(tarjeta.venc_dia)

              return (
                <Accordion type="single" collapsible key={tarjeta.id} className="rounded-2xl shadow-sm border">
                  <AccordionItem value={tarjeta.id} className="border-none">
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
                                <TableCell>{pago.fecha ? format(parseISO(pago.fecha), "d MMM", { locale: es }) : 'N/A'}</TableCell>
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
                          No hay gastos registrados para esta tarjeta en el rango de fechas y categoría seleccionados.
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
                <CardTitle>Total General Filtrado</CardTitle>
                <CardDescription>
                  Suma de todos los gastos en el rango de fechas y categoría seleccionados.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <p className="text-2xl font-bold">{formatCurrency(totales.totalActual)}</p>
              </CardFooter>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Total a pagar próximo mes</CardTitle>
                <CardDescription>
                  {totales.totalNext > 0
                    ? `Comprende los movimientos con tarjeta del ciclo que cierra el ${nextClosureDateFormatted}.`
                    : "No hay gastos con tarjeta registrados para el próximo ciclo de cierre en el rango y categoría seleccionados."}
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <p className="text-2xl font-bold">{formatCurrency(totales.totalNext)}</p>
              </CardFooter>
            </Card>

            {incluirCuotasFuturas && (
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Total de Cuotas Futuras (Estimado)</CardTitle>
                  <CardDescription>
                    Suma del valor total de las cuotas restantes para los pagos mostrados que son a plazos.
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <p className="text-2xl font-bold">{formatCurrency(totales.totalFuturo)}</p>
                </CardFooter>
              </Card>
            )}
          </div>

          {/* Gráfico de pastel por categoría */}
          {categoriasFiltradas && categoriasFiltradas.length > 0 && (
            <Card className="rounded-2xl shadow-sm mb-8">
              <CardHeader>
                <CardTitle>Gastos por Categoría (Filtrados)</CardTitle>
                <CardDescription>Distribución de gastos según las categorías en el rango de fechas y categoría seleccionados.</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoriasFiltradas}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="total"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {categoriasFiltradas.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value) => formatCurrency(value as number)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Gráfico de barras (usando pagosFiltrados y la función mejorada) */}
          {pagosFiltrados && pagosFiltrados.length > 0 && (
            <Card className="rounded-2xl shadow-sm mb-8">
              <CardHeader>
                <CardTitle>Gastos por Mes (Filtrados)</CardTitle>
                <CardDescription>Tendencia de gastos en el rango de fechas seleccionado.</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={agruparGastosPorMes(pagosFiltrados)}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis tickFormatter={(value: number) => formatCurrency(value)} />
                    <RechartsTooltip formatter={(value) => formatCurrency(value as number)} />
                    <Legend />
                    <Bar dataKey="total" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* <<< --- NUEVO COMPONENTE INTEGRADO AQUÍ --- >>> */}
          {/* Renderizar solo si hay datos base */}           
          {baseData && baseData.pagos && baseData.pagos.length > 0 && (
             <PagosFuturosPorMes pagos={baseData.pagos} /> // Pasar todos los pagos base
          )}
          {/* <<< --- FIN DE LA INTEGRACIÓN --- >>> */}

        </>
      )}
    </div>
  )
}