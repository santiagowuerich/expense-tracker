"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, CalendarIcon, Search, Trash2, Users } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { useVentas } from "@/hooks/useVentas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type FilterMode = 'today' | 'month' | 'custom';

export default function HistorialVentasPage() {
  const router = useRouter();

  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const appliedDateRange = useMemo(() => {
    const now = new Date();
    switch (filterMode) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) };
      case 'month':
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'custom':
        return customDateRange?.from && customDateRange.to ? customDateRange : undefined;
      default:
        return undefined;
    }
  }, [filterMode, customDateRange]);

  const { data: ventas, isLoading, error } = useVentas(appliedDateRange, searchTerm);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "d MMM yyyy, HH:mm", { locale: es });
    } catch {
      return "Fecha inválida";
    }
  };

  const formatDateTable = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: es });
    } catch {
      return "Fecha inválida";
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
            className="mr-2 sm:mr-4 h-9 w-9 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5"
            aria-label="Volver al inicio"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden sm:inline ml-2">Volver</span>
          </Button>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary truncate">Historial de Ventas</h1>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/clientes')}
          >
            <Users className="mr-2 h-4 w-4" />
            Ver Clientes
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/ventas/eliminar-ventas')}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar ventas
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <Tabs value={filterMode} onValueChange={(value) => setFilterMode(value as FilterMode)} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-3 sm:w-auto">
            <TabsTrigger value="today">Hoy</TabsTrigger>
            <TabsTrigger value="month">Este Mes</TabsTrigger>
            <TabsTrigger value="custom">Personalizado</TabsTrigger>
          </TabsList>
        </Tabs>

        {filterMode === 'custom' && (
          <div className="mt-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal sm:w-[300px]",
                    !customDateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customDateRange?.from ? (
                    customDateRange.to ? (
                      <>
                        {format(customDateRange.from, "d MMM yyyy", { locale: es })} - {format(customDateRange.to, "d MMM yyyy", { locale: es })}
                      </>
                    ) : (
                      format(customDateRange.from, "d MMM yyyy", { locale: es })
                    )
                  ) : (
                    <span>Seleccionar rango</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={customDateRange?.from}
                  selected={customDateRange}
                  onSelect={setCustomDateRange}
                  numberOfMonths={2}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div className="mt-4 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <Input
            type="search"
            placeholder="Buscar por nombre o CUIT del cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 sm:w-[300px]"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg sm:hidden" />
          <Skeleton className="h-40 w-full rounded-lg hidden sm:block" />
        </div>
      ) : error ? (
        <Card className="rounded-lg shadow-sm border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error al Cargar Ventas</CardTitle>
            <CardDescription>
              Ocurrió un error al cargar el historial: {error instanceof Error ? error.message : String(error)}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : !ventas || ventas.length === 0 ? (
        <EmptyState
          title="Sin ventas registradas"
          description={
            searchTerm 
              ? "No hay ventas que coincidan con tu búsqueda."
              : filterMode === 'custom' && !appliedDateRange 
                ? "Selecciona un rango de fechas personalizado." 
                : "No hay ventas que coincidan con los filtros seleccionados."
          }
        />
      ) : (
        <div>
          <div className="sm:hidden space-y-3">
            {ventas.map((venta) => (
              <div key={venta.id} className="border rounded-lg bg-card p-4 shadow-sm flex flex-col">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-base font-medium leading-tight">{formatDate(venta.fecha)}</span>
                  <span className="text-lg font-semibold whitespace-nowrap pl-2">{formatCurrency(venta.total)}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3 truncate">
                  {venta.cliente?.nombre || "Cliente N/A"}
                  {venta.cliente?.dni_cuit && ` - ${venta.cliente.dni_cuit}`}
                </p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 py-2"
                  aria-label={`Ver detalle de la venta del ${formatDate(venta.fecha)}`}
                >
                  <Link href={`/ventas/${venta.id}`}>Ver detalle</Link>
                </Button>
              </div>
            ))}
          </div>

          <div className="hidden sm:block overflow-x-auto rounded-lg border shadow-sm bg-card">
            <Table className="min-w-[600px]">
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="py-3 px-4 text-xs sm:text-sm">Fecha</TableHead>
                  <TableHead className="py-3 px-4 text-xs sm:text-sm">Cliente</TableHead>
                  <TableHead className="text-right py-3 px-4 text-xs sm:text-sm">Total Venta</TableHead>
                  <TableHead className="text-center py-3 px-4 text-xs sm:text-sm">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventas.map((venta) => (
                  <TableRow key={venta.id} className="hover:bg-muted/50">
                    <TableCell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">{formatDateTable(venta.fecha)}</TableCell>
                    <TableCell className="py-3 px-4 font-medium text-xs sm:text-sm">
                      {venta.cliente?.nombre || "N/A"}
                      {venta.cliente?.dni_cuit && <span className="block text-xs text-muted-foreground mt-0.5">CUIT: {venta.cliente.dni_cuit}</span>}
                    </TableCell>
                    <TableCell className="text-right py-3 px-4 text-xs sm:text-sm whitespace-nowrap">{formatCurrency(venta.total)}</TableCell>
                    <TableCell className="text-center py-2 px-4">
                      <Button asChild variant="link" size="sm" className="text-xs sm:text-sm">
                        <Link href={`/ventas/${venta.id}`}>Ver detalle</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
} 