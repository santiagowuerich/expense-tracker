"use client"

import { useQuery } from "@tanstack/react-query"
import { format, addMonths, parseISO, addDays, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { ArrowLeft, Download, CalendarIcon, Check, ChevronsUpDown, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase-browser"
import { useState, useMemo } from "react"
import type { DateRange } from "react-day-picker"
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { useComprasResumen, useCuotasDetalle, formatCurrency, formatShortDate, CompraResumen, CuotaDetalle } from "@/hooks/useResumenCompras";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils"

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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import CashPaymentsModal from "@/components/cash-payments-modal"

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
  tarjeta_alias?: string | null
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
  tarjetas: {
    alias: string | null;
  } | null;
  productos: {
    nombre: string | null;
    categorias: { nombre: string | null } | null;
  } | null;
};

// Tipo para representar una compra agrupada (sea una compra real con cuotas o un pago único tratado como grupo)
type CompraAgrupada = {
  idCompra: string;         // Será pago_original_id para cuotas, o pago.id para pagos únicos
  descripcion: string;      // Descripción base (sin "Cuota X/Y") o descripción del pago único
  totalCuotas: number;      // Número total de cuotas de la compra original (o 1 si es pago único)
  montoCuota: number;       // Monto representativo de la cuota (o monto del pago único)
  pagosEnFiltro: Pago[];  // Pagos (cuotas) de esta compra que están DENTRO del filtro actual
  esAgrupadoReal: boolean;  // true si agrupa múltiples cuotas reales (basado en pago_original_id)
  fechaPrimerPago: string;  // Fecha del primer pago encontrado para ordenar
};

// Tipo unión para los elementos que mostraremos en el acordeón de cada tarjeta
type ElementoMostrado =
  | { type: 'agrupada'; data: CompraAgrupada }
  | { type: 'unico'; data: Pago };

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

// Colores para el gráfico de categorías
const COLORS = ["#8884d8", "#83a6ed", "#8dd1e1", "#82ca9d", "#a4de6c", "#d0ed57", "#ffc658"]

// Renombrar la interfaz local para evitar conflicto
interface CuotaDetalleData {
  id: string;
  cuota_actual: number;
  fecha: string;
  monto: number;
}

// Componente para el detalle de cuotas (lazy loading)
function DetalleCompraCuotas({ idCompra, totalCuotasCompra }: { idCompra: string; totalCuotasCompra: number }) {
  // Usar el nuevo nombre de interfaz
  const { data: cuotas, isLoading, isError } = useQuery<CuotaDetalleData[]>({
    queryKey: ["detalleCompra", idCompra],
    queryFn: async () => {
      const supabase = createClient();
      
      // ID artificial (aquellos creados en runtime para agrupación en cliente)
      if (idCompra.startsWith("artificial_")) {
        // Como estos IDs son artificiales, no existen en la base de datos
        // Por lo que buscamos los pagos reales en la estructura local (ver abajo)
        return [];
      } else {
        // Consulta para IDs reales
        const { data, error } = await supabase
          .from("pagos")
          .select("id, cuota_actual, fecha, monto")
          .eq("pago_original_id", idCompra)
          .order("cuota_actual", { ascending: true });
        
        if (error) throw new Error(error.message);
        return data as CuotaDetalleData[] || [];
      }
    }
  });

  // Aquí podríamos mejorar la implementación para acceder al contexto local
  // pero por ahora lo dejaremos así para simplificar

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-sm text-destructive">
        No se pudieron cargar las cuotas.
      </div>
    );
  }

  if (!cuotas || cuotas.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {idCompra.startsWith("artificial_") ? 
          "Las cuotas están visibles directamente en la tabla superior." :
          "No se encontraron cuotas para esta compra."}
      </div>
    );
  }

  return (
    <Table className="text-sm">
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">Cuota</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead className="text-right">Monto</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cuotas.map((cuota) => (
          <TableRow key={cuota.id}>
            <TableCell>{cuota.cuota_actual}/{totalCuotasCompra}</TableCell>
            <TableCell>{format(parseISO(cuota.fecha), "d MMM yyyy", { locale: es })}</TableCell>
            <TableCell className="text-right font-medium">{formatCurrency(cuota.monto)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function ResumenPage() {
  const router = useRouter()
  const [incluirCuotasFuturas, setIncluirCuotasFuturas] = useState(false)
  const [rawDateRange, setRawDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return {
      from: addDays(today, -30),
      to: today,
    };
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [openCategoryDropdown, setOpenCategoryDropdown] = useState(false)

  const setDateRange = (newRange: DateRange | undefined) => {
      console.log("[ResumenPage] setDateRange called. New range:", newRange);
      setRawDateRange(newRange);
  }
  const dateRange = rawDateRange;

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
          tarjetas (alias),
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
        const categoriaNombre = pagoRaw.productos?.categorias?.nombre || "Sin categoría";
        const tarjetaAlias = pagoRaw.tarjetas?.alias || null;


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
          tarjeta_alias: tarjetaAlias,
          producto_nombre: productoNombre,
          categoria_nombre: categoriaNombre,
        };
      });


      return {
        tarjetas: typedTarjetas, // Usar el array tipado
        pagos: pagosTransformados, // Devolver todos los pagos transformados
      };
    },
  });

  // <<< --- NUEVO: Hook para Resumen de Compras en Cuotas --- >>>
  const {
      data: comprasResumen,
      isLoading: isLoadingComprasResumen,
      isError: isErrorComprasResumen,
      error: errorComprasResumen
  } = useComprasResumen();

  // --- Procesamiento y filtrado en el cliente ---
  const processedData = useMemo(() => {
    console.log("[ResumenPage] useMemo recalculating. Date range:", dateRange);

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
      
      // Loguear para depuración
      console.log("Total pagos antes de filtrar por fecha:", todosLosPagos.length);
      
      pagosFiltrados = pagosFiltrados.filter((pago) => {
         try {
            const fechaPago = startOfDay(parseISO(pago.fecha));
          const dentroDeFecha = isWithinInterval(fechaPago, { start, end });
          return dentroDeFecha;
        } catch (e) {
          console.error("Error al filtrar por fecha:", e, pago);
          return false; // Ignorar fechas inválidas
        }
      });
      
      // Loguear después de filtrar
      console.log("Total pagos después de filtrar por fecha:", pagosFiltrados.length);
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

    // <<< --- INICIO Procesamiento por tarjeta con agrupación por COMPRA --- >>>
    const tarjetasProcesadas = tarjetas.map(tarjeta => {
      const pagosDeEsaTarjeta = pagosFiltrados.filter(p => p.tarjeta_id === tarjeta.id);
      const comprasMap = new Map<string, CompraAgrupada>();
      
      // Paso 1: Extraer patrones de descripción y crear grupos artificiales
      const descripcionesBase = new Map<string, string>();
      const patronCuota = /^(.+?)\s*\(Cuota\s+(\d+)\/(\d+)\)\s*$/i;
      
      // Primero identificamos todas las descripciones base para generar claves de agrupación
      pagosDeEsaTarjeta.forEach(pago => {
        const matches = pago.descripcion.match(patronCuota);
        if (matches) {
          const [, descripcionBase, cuotaActual, totalCuotas] = matches;
          // Usamos la descripción base + total de cuotas como clave para agrupar 
          // todas las cuotas de una misma compra
          const claveAgrupacion = `${descripcionBase.trim()}_${totalCuotas}`;
          
          // Si no existe una clave artificial para esta descripción, la creamos
          if (!descripcionesBase.has(claveAgrupacion)) {
            // Usamos un ID artificial con un prefijo para evitar colisiones
            descripcionesBase.set(claveAgrupacion, `artificial_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
          }
        }
      });

      // Segundo paso: procesar todos los pagos
      pagosDeEsaTarjeta.forEach(pago => {
        // Caso 1: Tiene pago_original_id (manera correcta de estar registrado)
        if (pago.pago_original_id) {
          const idCompraOriginal = pago.pago_original_id;
          if (!comprasMap.has(idCompraOriginal)) {
            // Limpiar la descripción de la parte de "Cuota X/Y"
            const descripcionBase = pago.descripcion.replace(/\s*\(Cuota \d+\/\d+\)\s*/, '').trim();
            comprasMap.set(idCompraOriginal, {
              idCompra: idCompraOriginal,
              descripcion: descripcionBase || pago.descripcion,
              totalCuotas: pago.cuotas,
              montoCuota: pago.monto,
              pagosEnFiltro: [],
              esAgrupadoReal: true,
              fechaPrimerPago: pago.fecha,
            });
          }
          const grupo = comprasMap.get(idCompraOriginal)!;
          grupo.pagosEnFiltro.push(pago);
          if (pago.cuotas > grupo.totalCuotas) grupo.totalCuotas = pago.cuotas;
          if (pago.fecha < grupo.fechaPrimerPago) grupo.fechaPrimerPago = pago.fecha;
        } 
        // Caso 2: No tiene pago_original_id pero parece ser cuota por su descripción
        else {
          const matches = pago.descripcion.match(patronCuota);
          if (matches) {
            const [, descripcionBase, cuotaActual, totalCuotas] = matches;
            const claveAgrupacion = `${descripcionBase.trim()}_${totalCuotas}`;
            
            // Usar el ID artificial como clave de agrupación
            const idArtificial = descripcionesBase.get(claveAgrupacion)!;
            
            if (!comprasMap.has(idArtificial)) {
              comprasMap.set(idArtificial, {
                idCompra: idArtificial,
                descripcion: descripcionBase.trim(),
                totalCuotas: parseInt(totalCuotas, 10),
                montoCuota: pago.monto,
                pagosEnFiltro: [],
                esAgrupadoReal: true, // Lo marcamos como agrupado real
                fechaPrimerPago: pago.fecha,
              });
            }
            
            const grupo = comprasMap.get(idArtificial)!;
            grupo.pagosEnFiltro.push(pago);
            // Actualizar fecha del primer pago si es más antigua
            if (pago.fecha < grupo.fechaPrimerPago) {
              grupo.fechaPrimerPago = pago.fecha;
            }
          } 
          // Caso 3: Pago único normal (sin patrón de cuota ni pago_original_id)
          else {
            if (!comprasMap.has(pago.id)) {
              comprasMap.set(pago.id, {
                idCompra: pago.id,
                descripcion: pago.descripcion,
                totalCuotas: 1,
                montoCuota: pago.monto,
                pagosEnFiltro: [pago],
                esAgrupadoReal: false,
                fechaPrimerPago: pago.fecha,
              });
            }
          }
        }
      });

      const comprasParaRenderizar = Array.from(comprasMap.values());
      comprasParaRenderizar.sort((a, b) => {
        try {
          return parseISO(a.fechaPrimerPago).getTime() - parseISO(b.fechaPrimerPago).getTime();
        } catch { return 0; }
      });

      const subtotalReal = pagosDeEsaTarjeta.reduce((sum, p) => sum + p.monto, 0);

      return {
        ...tarjeta,
        subtotalFiltrado: subtotalReal,
        comprasAgrupadas: comprasParaRenderizar,
      };
    });
    // <<< --- FIN Procesamiento por tarjeta --- >>>

    const displayNextClosureDate = tarjetas.length > 0
      ? calcularProximoCierreMes(tarjetas[0].cierre_dia)
      : addMonths(new Date(), 1);

    return {
      tarjetas: tarjetasProcesadas,
      pagosFiltrados: pagosFiltrados,
      totales,
      categorias: categoriasFiltradas,
      nextClosureDate: displayNextClosureDate,
      allCategorias: allCategorias,
    };

  }, [baseData, dateRange, selectedCategory, incluirCuotasFuturas]);

  // Extraer tarjetas procesadas y otras variables necesarias fuera del useMemo
  const {
      tarjetas: tarjetasProcesadas,
      pagosFiltrados,
      totales,
      categorias: categoriasFiltradas,
      nextClosureDate,
      allCategorias
  } = processedData;

  const nextClosureDateFormatted = nextClosureDate
    ? format(nextClosureDate, "d 'de' MMMM 'de' yyyy", { locale: es })
    : "";

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
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
            className="mr-2 sm:mr-4 h-9 w-9"
            aria-label="Volver al inicio"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary truncate">Resumen de Gastos</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/resumen/eliminar-pagos')}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar pagos
          </Button>
          <Button variant="outline" onClick={descargarCSV}>
            <Download className="mr-2 h-4 w-4" />
            Descargar CSV
          </Button>
        </div>
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
      ) : !tarjetasProcesadas || tarjetasProcesadas.length === 0 ? (
        <EmptyState
          title="Sin tarjetas registradas"
          description="Agrega tu primera tarjeta para empezar a anotar gastos."
          action={<AddCardDialog />}
        />
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-4 mb-8 p-4 border rounded-lg bg-card shadow-sm">
             <div className="flex items-center space-x-2 flex-shrink-0">
                <Switch
                  id="incluir-cuotas-futuras"
                  checked={incluirCuotasFuturas}
                  onCheckedChange={setIncluirCuotasFuturas}
                />
                <label
                  htmlFor="incluir-cuotas-futuras"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 whitespace-nowrap"
                >
                  Incluir Cuotas Futuras
                </label>
              </div>

            <div className="flex flex-col sm:flex-row flex-grow gap-4 w-full md:w-auto">
               <div className="w-full sm:w-auto">
                 <Popover open={openCategoryDropdown} onOpenChange={setOpenCategoryDropdown}>
                   <PopoverTrigger asChild>
                     <Button
                       variant="outline"
                       role="combobox"
                       aria-expanded={openCategoryDropdown}
                       className="w-full sm:w-[200px] justify-between"
                     >
                       <span className="truncate">{selectedCategory || "Todas las categorías"}</span>
                       <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                     </Button>
                   </PopoverTrigger>
                   {renderCategoryPopoverContent()}
                 </Popover>
               </div>

               <div className="w-full sm:w-auto">
                 <Popover>
                   <PopoverTrigger asChild>
                     <Button
                       id="date"
                       variant={"outline"}
                       className={cn(
                         "w-full sm:w-[280px] justify-start text-left font-normal",
                         !dateRange && "text-muted-foreground"
                       )}
                     >
                       <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                       <span className="truncate">
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
                       </span>
                     </Button>
                   </PopoverTrigger>
                   <PopoverContent className="w-auto p-0" align="start">
                     <Calendar
                       initialFocus
                       mode="range"
                       defaultMonth={dateRange?.from}
                       selected={dateRange}
                       onSelect={setDateRange}
                       numberOfMonths={1}
                       className="sm:hidden"
                     />
                     <Calendar
                       initialFocus
                       mode="range"
                       defaultMonth={dateRange?.from}
                       selected={dateRange}
                       onSelect={setDateRange}
                       numberOfMonths={2}
                       className="hidden sm:block"
                     />
                   </PopoverContent>
                 </Popover>
               </div>
            </div>
          </div>

          <h2 className="text-xl font-semibold mt-10 mb-4">Resumen por Tarjeta (Filtrado)</h2>
          <Accordion type="multiple" className="space-y-4 mb-10">
            {tarjetasProcesadas.map((tarjeta) => {
              const proximoVencimiento = calcularProximoVencimiento(tarjeta.venc_dia);
              return (
                <AccordionItem value={tarjeta.id} key={tarjeta.id} className="border rounded-lg shadow-sm bg-card overflow-hidden">
                  <AccordionTrigger className="px-4 py-4 sm:px-6 sm:py-4 hover:no-underline text-left group">
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
                         <div className="flex-grow">
                           <span className="font-medium text-md sm:text-lg group-hover:text-primary transition-colors">{tarjeta.alias}</span>
                           <p className="text-sm text-muted-foreground mt-1">
                               Total (filtrado): {formatCurrency(tarjeta.subtotalFiltrado)}
                           </p>
                         </div>
                         <Badge variant="outline" className="self-start sm:self-center whitespace-nowrap mt-1 sm:mt-0">
                           Vence: {format(proximoVencimiento, "d MMM yy", { locale: es })}
                         </Badge>
                     </div>
                    </AccordionTrigger>
                  <AccordionContent className="px-4 pt-3 pb-4 sm:px-6 sm:py-4 border-t">
                    {tarjeta.comprasAgrupadas.length > 0 ? (
                      <Accordion type="multiple" className="space-y-3">
                        {tarjeta.comprasAgrupadas.map((compra, index) => (
                          <AccordionItem
                            key={`${compra.idCompra}-${index}`}
                            value={`${compra.idCompra}-${index}`}
                            className="border rounded-md bg-muted/30 overflow-hidden"
                          >
                            <AccordionTrigger className="px-4 py-3 hover:bg-muted/60 hover:no-underline text-sm text-left group">
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between w-full gap-2">
                                  <div className="flex flex-col items-start flex-grow mr-2">
                                    <span className="font-medium text-sm group-hover:text-primary transition-colors leading-tight">{compra.descripcion}</span>
                                    {compra.esAgrupadoReal ? (
                                      <span className="text-xs text-muted-foreground mt-1">
                                        {compra.totalCuotas} cuotas de {formatCurrency(compra.montoCuota)}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground mt-1">
                                        {formatShortDate(compra.fechaPrimerPago)}
                                      </span>
                                      )}
                                  </div>
                                  <div className="font-semibold whitespace-nowrap flex-shrink-0 text-right text-sm mt-1 sm:mt-0">
                                    {formatCurrency(compra.pagosEnFiltro.reduce((sum, p) => sum + p.monto, 0))}
                                  </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="border-t bg-card px-0 pt-2 pb-3">
                              {compra.esAgrupadoReal ? (
                                compra.idCompra.startsWith("artificial_") ? (
                                  <div className="overflow-x-auto px-4">
                                      <Table className="text-sm min-w-[350px]">
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="w-20 py-2">Cuota</TableHead>
                                            <TableHead className="py-2">Fecha</TableHead>
                                            <TableHead className="text-right py-2">Monto</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {compra.pagosEnFiltro.map((pago) => (
                                            <TableRow key={pago.id}>
                                              <TableCell className="py-2">{pago.cuota_actual}/{compra.totalCuotas}</TableCell>
                                              <TableCell className="whitespace-nowrap py-2">{format(parseISO(pago.fecha), "d MMM yy", { locale: es })}</TableCell>
                                              <TableCell className="text-right font-medium whitespace-nowrap py-2">{formatCurrency(pago.monto)}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                  </div>
                                ) : (
                                  <div className="px-4">
                                      <DetalleCompraCuotas
                                        idCompra={compra.idCompra}
                                        totalCuotasCompra={compra.totalCuotas}
                                      />
                                  </div>
                                )
                              ) : (
                                <div className="px-4 py-2 text-xs text-muted-foreground">
                                  Pago único.
                                  {compra.pagosEnFiltro[0]?.categoria_nombre && compra.pagosEnFiltro[0]?.categoria_nombre !== "Sin categoría" && (
                                    ` Categoría: ${compra.pagosEnFiltro[0].categoria_nombre}`
                                  )}
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                      ) : (
                      <div className="py-4 text-center text-muted-foreground text-sm">
                        No hay gastos registrados para esta tarjeta con los filtros aplicados.
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
              );
            })}
          </Accordion>

          <h2 className="text-xl font-semibold mt-10 mb-4">Totales Generales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-10">
            <Card className="rounded-lg shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Total Filtrado</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Suma en rango y categoría.
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2 pb-4 px-4 sm:px-6">
                <p className="text-xl sm:text-2xl font-bold">{formatCurrency(totales.totalActual)}</p>
              </CardFooter>
            </Card>

            <Card className="rounded-lg shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Total Próximo Mes</CardTitle>
                <CardDescription className="text-xs sm:text-sm truncate">
                  {totales.totalNext > 0
                    ? `Cierre: ${nextClosureDateFormatted}`
                    : "Sin gastos próx. cierre."}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2 pb-4 px-4 sm:px-6">
                <p className="text-xl sm:text-2xl font-bold">{formatCurrency(totales.totalNext)}</p>
              </CardFooter>
            </Card>

            {incluirCuotasFuturas && (
              <Card className="rounded-lg shadow-sm md:col-span-2 lg:col-span-1">
                <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
                  <CardTitle className="text-base sm:text-lg">Total Cuotas Futuras</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Estimado cuotas restantes.
                  </CardDescription>
                </CardHeader>
                <CardFooter className="pt-2 pb-4 px-4 sm:px-6">
                  <p className="text-xl sm:text-2xl font-bold">{formatCurrency(totales.totalFuturo)}</p>
                </CardFooter>
              </Card>
            )}
          </div>

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
                      label={({ name, percent }: { name: string, percent: number }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {categoriasFiltradas.map((entry: { nombre: string; total: number }, index: number) => (
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

          {/* Componente Pagos Futuros con margen inferior */}
          {baseData && baseData.pagos && baseData.pagos.length > 0 && (
             <div className="mb-10">
                <PagosFuturosPorMes pagos={baseData.pagos} />
             </div>
          )}

          {/* Card Pagos Efectivo con margen inferior y botón ajustado */}
          <Card className="rounded-lg shadow-sm mb-10">
            <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">Pagos Efectivo / Transferencia</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Ver detalle de pagos sin tarjeta.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-4 px-4 sm:px-6">
              <p className="text-sm text-muted-foreground">
                Haz clic para ver el detalle por mes.
              </p>
            </CardContent>
            <CardFooter className="pt-0 pb-4 px-4 sm:px-6">
              <CashPaymentsModal>
                 {/* Botón más pequeño y con padding adecuado para touch */}
                <Button variant="outline" size="sm" className="py-2 px-3">
                  Ver Detalle Mensual
                </Button>
              </CashPaymentsModal>
            </CardFooter>
          </Card>

          {/* Card para agregar tarjeta (opcional, mantener o quitar si no se usa) */}
           <Card className="rounded-lg shadow-sm mb-10">
             <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
               <CardTitle className="text-base sm:text-lg">Gestionar Tarjetas</CardTitle>
               <CardDescription className="text-xs sm:text-sm">
                 Añade o modifica tus tarjetas de crédito/débito.
               </CardDescription>
             </CardHeader>
             <CardFooter className="pt-2 pb-4 px-4 sm:px-6">
                <AddCardDialog>
                    <Button variant="outline" size="sm" className="py-2 px-3">
                        Gestionar Tarjetas
                    </Button>
                </AddCardDialog>
             </CardFooter>
           </Card>
        </>
      )}
    </div>
  )
}

function agruparGastosPorMes(pagos: Pago[]): { mes: string; total: number }[] {
  const mesesMap = new Map<string, number>()
  pagos.forEach((pago) => {
    try {
      const fecha = parseISO(pago.fecha);
      const mesKey = format(fecha, "yyyy-MM");
      const total = mesesMap.get(mesKey) || 0;
      mesesMap.set(mesKey, total + pago.monto);
    } catch (e) {
      console.warn(`Fecha inválida encontrada en pago ${pago.id}: ${pago.fecha}`);
    }
  })
  return Array.from(mesesMap.entries())
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([mesKey, total]) => ({
      mes: format(parseISO(mesKey + "-01"), "MMM yy", { locale: es }),
      total,
    }))
}