"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { format, parseISO, subMonths, eachMonthOfInterval, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import Papa from "papaparse";

// Shadcn/ui y otros componentes UI
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerWithRange } from "../../components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Íconos (usando lucide-react como ejemplo)
import {
  ArrowLeft,
  LineChart,
  Package,
  AlertCircle,
  AlertTriangle,
  Search,
  Download,
  Moon, Sun
} from "lucide-react";

// Recharts para gráficos
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  BarChart as RechartsBarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Line,
  Bar,
} from "recharts";

// next-themes para Dark Mode
import { useTheme } from "next-themes";

// --- Tipos ---
interface Producto {
  id: string;
  nombre: string;
  stock: number;
  stock_min: number;
  costo_unit: number | null;
}

interface PriceHistory {
  id: string;
  producto_id: string;
  producto_nombre?: string; 
  tipo: "costo" | "venta";
  precio: number;
  created_at: string;
}

interface MonthlyData {
  mes: string;
  valor?: number;
  unidades?: number;
}

// --- Constantes ---
const ITEMS_PER_PAGE = 10;

// --- Funciones Helper ---
function formatCurrencyARS(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount);
}

function downloadCSV(data: any[], filename: string = "export.csv") {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


// --- Componente Principal ---
export default function ReporteInventarioPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
      const end = endOfDay(new Date());
      const start = startOfDay(subMonths(end, 1)); // Default: último mes
      return { from: start, to: end };
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // --- Data Fetching con React Query ---
  const { data: productosData = [], isLoading: isLoadingProductos, error: errorProductos } = useQuery({
      queryKey: ["productosReporte"],
      queryFn: async () => {
          const supabase = createClient();
          const { data, error } = await supabase
              .from("productos")
              .select("id, nombre, stock, stock_min, costo_unit");
          if (error) throw new Error(error.message);
          return (data || []) as Producto[];
      },
  });

  const { data: priceHistoryData = [], isLoading: isLoadingPriceHistory, error: errorPriceHistory } = useQuery({
      queryKey: ["priceHistoryReporte"],
      queryFn: async () => {
          const supabase = createClient();
          const { data, error } = await supabase
              .from("price_history")
              .select(`
                  id, producto_id, tipo, precio, created_at,
                  productos ( nombre )
              `)
              .order("created_at", { ascending: false });
          if (error) throw new Error(error.message);
          
          return (data || []).map(item => ({
              ...item,
              producto_nombre: item.productos ? (item.productos as any).nombre : 'Desconocido',
              id: item.id as string,
              producto_id: item.producto_id as string,
              tipo: item.tipo as "costo" | "venta",
              precio: item.precio as number,
              created_at: item.created_at as string
          })) as PriceHistory[];
      },
  });

  // --- Data Procesada y Filtrada con useMemo ---
  const filteredData = useMemo(() => {
      const start = dateRange?.from ? startOfDay(dateRange.from) : null;
      const end = dateRange?.to ? endOfDay(dateRange.to) : null;

      // Filtrar historial de precios por fecha y término de búsqueda
      const filteredPriceHistory = priceHistoryData.filter(item => {
          const itemDate = parseISO(item.created_at);
          const dateMatch = (!start || itemDate >= start) && (!end || itemDate <= end);
          const searchMatch = !searchTerm || item.producto_nombre?.toLowerCase().includes(searchTerm.toLowerCase());
          return dateMatch && searchMatch;
      });

      // Calcular productos sin stock / stock crítico
      const productosSinStock = productosData.filter(p => p.stock <= 0);
      const productosStockCritico = productosData.filter(p => p.stock_min > 0 && p.stock <= p.stock_min && p.stock > 0); 

      // Datos para gráficos (placeholder)
      const monthlyChartData: MonthlyData[] = [];
      if (start && end) {
          const months = eachMonthOfInterval({ start, end });
          months.forEach(monthStart => {
              monthlyChartData.push({
                  mes: format(monthStart, 'MMM yy', { locale: es }),
                  valor: Math.random() * 50000,
                  unidades: Math.random() * 200,
              });
          });
      }
       // Ordenar datos del gráfico
      monthlyChartData.sort((a, b) => new Date(a.mes + "-01").getTime() - new Date(b.mes + "-01").getTime());

      // Paginación para historial de precios
      const totalItems = filteredPriceHistory.length;
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
      const paginatedPriceHistory = filteredPriceHistory.slice(
          (currentPage - 1) * ITEMS_PER_PAGE,
          currentPage * ITEMS_PER_PAGE
      );

      return {
          productosSinStock,
          productosStockCritico,
          filteredPriceHistory,
          paginatedPriceHistory,
          totalPages,
          monthlyChartData,
      };

  }, [productosData, priceHistoryData, dateRange, searchTerm, currentPage]);

  // --- Handlers ---
  const handleDateChange = (newRange: DateRange | undefined) => {
      setDateRange(newRange);
      setCurrentPage(1); // Resetear paginación al cambiar fecha
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(event.target.value);
      setCurrentPage(1); // Resetear paginación al buscar
  };

  const handlePageChange = (page: number) => {
      setCurrentPage(page);
  };

  const handleExportCSV = () => {
      // Preparar datos para CSV
      const dataToExport = filteredData.filteredPriceHistory.map(item => ({
          Producto: item.producto_nombre,
          Tipo: item.tipo === 'costo' ? 'Costo' : 'Venta',
          Precio: item.precio,
          Fecha: format(parseISO(item.created_at), "dd/MM/yyyy HH:mm", { locale: es })
      }));
      downloadCSV(dataToExport, `historial_precios_${format(new Date(), 'yyyyMMdd')}.csv`);
  };


  // --- Renderizado ---
  const renderContent = () => {
      if (isLoadingProductos || isLoadingPriceHistory) {
          return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-lg" />)}
              </div>
          );
      }

      if (errorProductos || errorPriceHistory) {
          return (
              <Card className="shadow-md rounded-lg col-span-1 lg:col-span-2">
                  <CardHeader>
                      <CardTitle className="text-destructive">Error</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <p>No se pudieron cargar los datos de los reportes.</p>
                      <p className="text-sm text-muted-foreground mt-2">
                          {errorProductos?.message || errorPriceHistory?.message}
                      </p>
                  </CardContent>
              </Card>
          );
      }

      return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico: Evolución Valor Total */}
              <Card className="shadow-md rounded-lg">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-lg font-semibold flex items-center">
                          <LineChart className="mr-2 h-5 w-5 text-primary" />
                          Evolución del Valor del Inventario
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px] pt-4">
                    {filteredData.monthlyChartData.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%">
                          <RechartsLineChart data={filteredData.monthlyChartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="mes" fontSize={12} tickLine={false} axisLine={false} />
                              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrencyARS(value)} />
                              <RechartsTooltip formatter={(value: number) => formatCurrencyARS(value)} />
                              <Legend />
                              <Line type="monotone" dataKey="valor" stroke="#8884d8" activeDot={{ r: 8 }} name="Valor Estimado" />
                          </RechartsLineChart>
                      </ResponsiveContainer>
                    ) : <p className="text-center text-muted-foreground pt-10">Datos insuficientes para el gráfico.</p>}
                  </CardContent>
              </Card>

              {/* Gráfico: Evolución Unidades */}
              <Card className="shadow-md rounded-lg">
                   <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                       <CardTitle className="text-lg font-semibold flex items-center">
                           <Package className="mr-2 h-5 w-5 text-primary" />
                           Evolución Unidades en Stock
                       </CardTitle>
                   </CardHeader>
                   <CardContent className="h-[300px] pt-4">
                       {filteredData.monthlyChartData.length > 0 ? (
                           <ResponsiveContainer width="100%" height="100%">
                               <RechartsBarChart data={filteredData.monthlyChartData}>
                                   <CartesianGrid strokeDasharray="3 3" />
                                   <XAxis dataKey="mes" fontSize={12} tickLine={false} axisLine={false} />
                                   <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                   <RechartsTooltip />
                                   <Legend />
                                   <Bar dataKey="unidades" fill="#82ca9d" name="Unidades" />
                               </RechartsBarChart>
                           </ResponsiveContainer>
                       ) : <p className="text-center text-muted-foreground pt-10">Datos insuficientes para el gráfico.</p>}
                   </CardContent>
               </Card>


              {/* Card: Productos Sin Stock */}
              <Card className="shadow-md rounded-lg">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-lg font-semibold flex items-center">
                          <AlertCircle className="mr-2 h-5 w-5 text-orange-500" />
                          Productos Sin Stock
                      </CardTitle>
                      {filteredData.productosSinStock.length > 0 && (
                          <Badge variant="destructive" className="bg-red-100 text-red-700">
                              {filteredData.productosSinStock.length} Ítem(s)
                          </Badge>
                      )}
                  </CardHeader>
                  <CardContent>
                      {filteredData.productosSinStock.length > 0 ? (
                          <ul className="list-disc pl-5 text-sm text-muted-foreground">
                              {filteredData.productosSinStock.slice(0, 5).map(p => <li key={p.id}>{p.nombre}</li>)}
                              {filteredData.productosSinStock.length > 5 && <li>... y más</li>}
                          </ul>
                      ) : (
                          <p className="text-sm text-muted-foreground">No hay productos sin stock.</p>
                      )}
                  </CardContent>
              </Card>

               {/* Card: Stock Crítico */}
               <Card className="shadow-md rounded-lg">
                   <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                       <CardTitle className="text-lg font-semibold flex items-center">
                           <AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />
                           Stock Crítico
                       </CardTitle>
                       {filteredData.productosStockCritico.length > 0 && (
                           <Badge variant="destructive" className="bg-yellow-100 text-yellow-700">
                               {filteredData.productosStockCritico.length} Ítem(s)
                           </Badge>
                       )}
                   </CardHeader>
                   <CardContent>
                       {filteredData.productosStockCritico.length > 0 ? (
                           <ul className="list-disc pl-5 text-sm text-muted-foreground">
                               {filteredData.productosStockCritico.slice(0, 5).map(p => <li key={p.id}>{p.nombre} (Stock: {p.stock}, Mín: {p.stock_min})</li>)}
                               {filteredData.productosStockCritico.length > 5 && <li>... y más</li>}
                           </ul>
                       ) : (
                           <p className="text-sm text-muted-foreground">No hay productos con stock crítico.</p>
                       )}
                   </CardContent>
               </Card>

              {/* Tabla: Últimas Variaciones de Precio */}
              <Card className="shadow-md rounded-lg lg:col-span-2">
                  <CardHeader>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                         <div className="flex items-center">
                             <LineChart className="mr-2 h-5 w-5 text-primary" />
                             <CardTitle className="text-lg font-semibold">Últimas Variaciones de Precio</CardTitle>
                         </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                              <div className="relative w-full sm:w-64">
                                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                  <Input
                                      type="search"
                                      placeholder="Buscar por nombre..."
                                      className="pl-8 w-full"
                                      value={searchTerm}
                                      onChange={handleSearchChange}
                                  />
                              </div>
                              <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filteredData.filteredPriceHistory.length === 0}>
                                  <Download className="mr-2 h-4 w-4" />
                                  Exportar CSV
                              </Button>
                          </div>
                      </div>
                  </CardHeader>
                  <CardContent>
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Producto</TableHead>
                                  <TableHead>Tipo</TableHead>
                                  <TableHead className="text-right">Precio</TableHead>
                                  <TableHead>Fecha</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {filteredData.paginatedPriceHistory.length > 0 ? (
                                  filteredData.paginatedPriceHistory.map((item) => (
                                      <TableRow key={item.id}>
                                          <TableCell className="font-medium">{item.producto_nombre}</TableCell>
                                          <TableCell>
                                            <Badge variant={item.tipo === "costo" ? "outline" : "secondary"}>
                                                {item.tipo === 'costo' ? 'Costo' : 'Venta'}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="text-right">{formatCurrencyARS(item.precio)}</TableCell>
                                          <TableCell>{format(parseISO(item.created_at), "d MMM yyyy", { locale: es })}</TableCell>
                                      </TableRow>
                                  ))
                              ) : (
                                  <TableRow>
                                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                          No se encontraron variaciones de precio con los filtros aplicados.
                                      </TableCell>
                                  </TableRow>
                              )}
                          </TableBody>
                      </Table>
                      {/* Paginación */}
                      {filteredData.totalPages > 1 && (
                           <Pagination className="mt-6">
                                <PaginationContent>
                                    <PaginationItem>
                                        <PaginationPrevious href="#" onClick={(e) => {e.preventDefault(); handlePageChange(currentPage - 1)}} aria-disabled={currentPage <= 1} />
                                    </PaginationItem>
                                    {/* Idealmente, generar números de página dinámicamente */}
                                     <PaginationItem>
                                        <PaginationLink href="#" isActive>
                                           {currentPage}
                                        </PaginationLink>
                                     </PaginationItem>
                                     {filteredData.totalPages > currentPage && (
                                        <PaginationItem>
                                           <PaginationEllipsis />
                                        </PaginationItem>
                                     )}
                                    <PaginationItem>
                                        <PaginationNext href="#" onClick={(e) => {e.preventDefault(); handlePageChange(currentPage + 1)}} aria-disabled={currentPage >= filteredData.totalPages} />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>
                      )}
                  </CardContent>
              </Card>
          </div>
      );
  };

  return (
      <div className="container mx-auto py-8 px-4">
          {/* Header con Botón Volver, Título, Filtro Fecha y Toggle Dark Mode */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
              <div className="flex items-center">
                  <Button variant="ghost" size="sm" onClick={() => router.push("/inventario")} className="mr-4">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Volver
                  </Button>
                  <h1 className="text-2xl lg:text-3xl font-bold text-primary">Reportes de Inventario</h1>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                   <DatePickerWithRange date={dateRange} onDateChange={handleDateChange} />
                  <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                             <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                               <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                               <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                               <span className="sr-only">Toggle theme</span>
                           </Button>
                        </TooltipTrigger>
                         <TooltipContent>
                           <p>Cambiar tema</p>
                        </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
              </div>
          </div>

          {/* Contenido principal (Gráficos, Tarjetas, Tabla) */}
          {renderContent()}
      </div>
  );
} 