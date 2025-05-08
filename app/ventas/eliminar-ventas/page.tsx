"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Trash2, Calendar, Loader2, Filter, Search } from "lucide-react";
import { toast } from "sonner";

import { useVentas, useEliminarVentasBatch, ResultadoEliminacionVenta } from "@/hooks/useVentas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency } from "@/hooks/useResumenCompras";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type MesSeleccionado = string | null; // formato: "YYYY-MM"

export default function EliminarVentasPage() {
  const router = useRouter();
  const [mesSeleccionado, setMesSeleccionado] = useState<MesSeleccionado>(
    // Inicializar con el mes actual
    format(new Date(), "yyyy-MM")
  );
  const [ventasSeleccionadas, setVentasSeleccionadas] = useState<Set<string>>(new Set());
  const [confirmarDialogOpen, setConfirmarDialogOpen] = useState(false);
  const [resultadosEliminacion, setResultadosEliminacion] = useState<ResultadoEliminacionVenta[]>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>(""); // Nuevo estado para la búsqueda

  // Calcular el rango de fechas basado en el mes seleccionado
  const fechaRango = useMemo(() => {
    if (!mesSeleccionado) return undefined;
    const fecha = parseISO(`${mesSeleccionado}-01`);
    return {
      from: startOfMonth(fecha),
      to: endOfMonth(fecha)
    };
  }, [mesSeleccionado]);

  // Obtener las ventas - Ahora también pasamos el término de búsqueda
  const { data: ventas, isLoading, error } = useVentas(fechaRango, searchTerm);
  
  // Hook para eliminar ventas en lote
  const eliminarVentasMutation = useEliminarVentasBatch();

  // Función para seleccionar/deseleccionar todas las ventas
  const seleccionarTodas = (seleccionar: boolean) => {
    if (seleccionar && ventas) {
      const idsSet = new Set<string>();
      ventas.forEach(venta => idsSet.add(venta.id));
      setVentasSeleccionadas(idsSet);
    } else {
      setVentasSeleccionadas(new Set());
    }
  };

  // Función para manejar la selección individual
  const toggleSeleccion = (ventaId: string) => {
    const nuevaSeleccion = new Set(ventasSeleccionadas);
    if (nuevaSeleccion.has(ventaId)) {
      nuevaSeleccion.delete(ventaId);
    } else {
      nuevaSeleccion.add(ventaId);
    }
    setVentasSeleccionadas(nuevaSeleccion);
  };

  // Generar opciones de meses (últimos 12 meses)
  const opcionesMeses = useMemo(() => {
    const opciones = [];
    const fechaActual = new Date();
    
    for (let i = 0; i < 12; i++) {
      const fecha = new Date(fechaActual.getFullYear(), fechaActual.getMonth() - i, 1);
      const valor = format(fecha, "yyyy-MM");
      const etiqueta = format(fecha, "MMMM yyyy", { locale: es });
      
      opciones.push({ valor, etiqueta });
    }
    
    return opciones;
  }, []);

  // Función para obtener los métodos de pago de una venta
  const obtenerMetodosPago = (venta: any) => {
    try {
      // Verificar si existe la propiedad pagos y tiene elementos
      if (!venta.pagos || !Array.isArray(venta.pagos) || venta.pagos.length === 0) {
        return "N/A";
      }
      
      // Mapear y formatear cada método de pago
      return venta.pagos
        .map((p: any) => {
          // Verificar si el objeto de pago es válido y tiene la propiedad metodo_pago
          if (p && typeof p.metodo_pago === 'string') {
            // Reemplazar guiones bajos por espacios y capitalizar
            return p.metodo_pago.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
          }
          return "Desconocido";
        })
        .join(", ");
    } catch (error) {
      console.error("Error al obtener métodos de pago:", error);
      return "Error";
    }
  };

  // Función para eliminar las ventas seleccionadas en lote
  const eliminarVentasSeleccionadas = async () => {
    if (ventasSeleccionadas.size === 0) {
      toast.warning("No hay ventas seleccionadas para eliminar");
      return;
    }

    try {
      // Convertir Set a Array para enviar al servidor
      const ventasIds = Array.from(ventasSeleccionadas);
      
      // Llamar a la función de eliminación en lote
      const resultados = await eliminarVentasMutation.mutateAsync(ventasIds);
      
      // Guardar resultados para mostrar
      setResultadosEliminacion(resultados);
      setMostrarResultados(true);
      
      // Contar resultados
      const exitosos = resultados.filter(r => r.exito).length;
      const fallidos = resultados.length - exitosos;
      
      // Mostrar resultado general
      if (exitosos > 0 && fallidos === 0) {
        toast.success(`Se eliminaron ${exitosos} ventas correctamente`);
      } else if (exitosos > 0 && fallidos > 0) {
        toast.info(`Se eliminaron ${exitosos} ventas, pero ${fallidos} no pudieron eliminarse`);
      } else {
        toast.error("No se pudo eliminar ninguna venta");
      }
      
      // Cerrar diálogo de confirmación
      setConfirmarDialogOpen(false);
      
      // Limpiar selección
      setVentasSeleccionadas(new Set());
    } catch (error) {
      toast.error("Ocurrió un error durante el proceso de eliminación");
      console.error("Error general:", error);
      setConfirmarDialogOpen(false);
    }
  };

  // Formatear fecha para mostrar
  const formatFecha = (fechaString: string) => {
    try {
      return format(new Date(fechaString), "dd/MM/yyyy HH:mm", { locale: es });
    } catch {
      return "Fecha inválida";
    }
  };
  
  // Formatear fecha en formato corto para móviles
  const formatFechaCorta = (fechaString: string) => {
    try {
      return format(new Date(fechaString), "dd/MM/yy HH:mm", { locale: es });
    } catch {
      return "Fecha inválida";
    }
  };

  return (
    <div className="container mx-auto py-4 sm:py-6 px-3 sm:px-6 lg:px-8">
      {/* Encabezado y botón volver */}
      <div className="flex items-center mb-4 sm:mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/ventas')}
          className="mr-2 sm:mr-4"
        >
          <ArrowLeft className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Volver</span>
        </Button>
        <h1 className="text-xl sm:text-2xl font-bold text-primary">Eliminar Ventas</h1>
      </div>

      {/* Filtros */}
      <Card className="mb-4 sm:mb-6">
        <CardHeader className="py-3 sm:py-4">
          <CardTitle className="text-base sm:text-lg">Filtros</CardTitle>
          <CardDescription className="text-sm">Selecciona un mes para ver las ventas</CardDescription>
        </CardHeader>
        <CardContent className="py-2 sm:py-3">
          <div className="flex flex-col gap-3">
            <Select 
              value={mesSeleccionado || ""} 
              onValueChange={(valor) => {
                setMesSeleccionado(valor);
                setVentasSeleccionadas(new Set());
                setMostrarResultados(false);
              }}
            >
              <SelectTrigger className="w-full">
                <div className="flex items-center">
                  <Calendar className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Seleccionar mes" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {opcionesMeses.map((opcion) => (
                  <SelectItem key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Campo de búsqueda */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <Input
                type="search"
                placeholder="Buscar por nombre o CUIT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mostrar resultados de la eliminación si hay */}
      {mostrarResultados && resultadosEliminacion.length > 0 && (
        <Card className="mb-4 sm:mb-6 border-muted">
          <CardHeader className="py-3 sm:py-4">
            <CardTitle className="text-base sm:text-lg">Resultados de la eliminación</CardTitle>
            <CardDescription className="text-sm">
              Exitosos: {resultadosEliminacion.filter((r: ResultadoEliminacionVenta) => r.exito).length}, 
              Fallidos: {resultadosEliminacion.filter((r: ResultadoEliminacionVenta) => !r.exito).length}
            </CardDescription>
          </CardHeader>
          {resultadosEliminacion.some((r: ResultadoEliminacionVenta) => !r.exito) && (
            <CardContent className="py-2 sm:py-3">
              <div className="text-sm">
                <h4 className="font-medium mb-2">Detalles de errores:</h4>
                <ul className="list-disc ml-5 space-y-1 max-h-32 sm:max-h-40 overflow-y-auto">
                  {resultadosEliminacion
                    .filter((r: ResultadoEliminacionVenta) => !r.exito)
                    .map((r: ResultadoEliminacionVenta) => (
                      <li key={r.venta_id}>
                        ID: {r.venta_id.substr(0, 8)}... - {r.mensaje}
                      </li>
                    ))
                  }
                </ul>
              </div>
            </CardContent>
          )}
          <CardFooter className="py-2 sm:py-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setMostrarResultados(false)}
            >
              Ocultar resultados
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Resultados y acciones */}
      {isLoading ? (
        <div className="space-y-3 sm:space-y-4">
          <Skeleton className="h-10 sm:h-12 w-full rounded-md" />
          <Skeleton className="h-48 sm:h-64 w-full rounded-md" />
        </div>
      ) : error ? (
        <Card className="border-destructive">
          <CardHeader className="py-3 sm:py-4">
            <CardTitle className="text-destructive text-base sm:text-lg">Error</CardTitle>
            <CardDescription className="text-destructive text-sm">
              {error instanceof Error ? error.message : "Error al cargar las ventas"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : !ventas || ventas.length === 0 ? (
        <EmptyState 
          title="No hay ventas"
          description={searchTerm 
            ? "No hay ventas que coincidan con tu búsqueda." 
            : `No se encontraron ventas en el período seleccionado.`}
        />
      ) : (
        <Card>
          <CardHeader className="py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div>
              <CardTitle className="text-base sm:text-lg">Ventas</CardTitle>
              <CardDescription className="text-sm">
                {ventas.length} venta{ventas.length !== 1 ? 's' : ''} encontrada{ventas.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => seleccionarTodas(ventasSeleccionadas.size !== (ventas?.length || 0))}
                className="text-xs sm:text-sm h-8 sm:h-9"
              >
                {ventasSeleccionadas.size === (ventas?.length || 0) ? "Deseleccionar todas" : "Seleccionar todas"}
              </Button>
              <Dialog open={confirmarDialogOpen} onOpenChange={setConfirmarDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={ventasSeleccionadas.size === 0 || eliminarVentasMutation.isPending}
                    className="text-xs sm:text-sm h-8 sm:h-9"
                  >
                    {eliminarVentasMutation.isPending && <Loader2 className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4 animate-spin" />}
                    <Trash2 className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />
                    Eliminar ({ventasSeleccionadas.size})
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md max-w-[calc(100%-2rem)]">
                  <DialogHeader>
                    <DialogTitle>Confirmar eliminación</DialogTitle>
                    <DialogDescription>
                      ¿Está seguro que desea eliminar {ventasSeleccionadas.size} venta{ventasSeleccionadas.size !== 1 ? 's' : ''}? 
                      Esta acción no se puede deshacer.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
                    <Button 
                      variant="outline" 
                      onClick={() => setConfirmarDialogOpen(false)}
                      className="w-full sm:w-auto"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={eliminarVentasSeleccionadas}
                      disabled={eliminarVentasMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {eliminarVentasMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {eliminarVentasMutation.isPending ? "Eliminando..." : "Eliminar definitivamente"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          
          {/* Vista de tabla para pantallas medianas y grandes */}
          <CardContent className="hidden sm:block py-2 sm:py-3">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <span className="sr-only">Seleccionar</span>
                    </TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Método de Pago</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ventas?.map((venta) => {
                    // Obtener métodos de pago de esta venta
                    const metodosPago = obtenerMetodosPago(venta);
                      
                    return (
                      <TableRow key={venta.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell onClick={() => toggleSeleccion(venta.id)}>
                          <Checkbox 
                            checked={ventasSeleccionadas.has(venta.id)}
                            onCheckedChange={() => toggleSeleccion(venta.id)}
                          />
                        </TableCell>
                        <TableCell onClick={() => toggleSeleccion(venta.id)}>
                          {formatFecha(venta.fecha)}
                        </TableCell>
                        <TableCell onClick={() => toggleSeleccion(venta.id)}>
                          <div className="font-medium">{venta.cliente?.nombre || "N/A"}</div>
                          {venta.cliente?.dni_cuit && 
                            <div className="text-xs text-muted-foreground">
                              {venta.cliente.dni_cuit}
                            </div>
                          }
                        </TableCell>
                        <TableCell onClick={() => toggleSeleccion(venta.id)}>
                          <span className="capitalize">{metodosPago}</span>
                        </TableCell>
                        <TableCell className="text-right" onClick={() => toggleSeleccion(venta.id)}>
                          {formatCurrency(venta.total)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          
          {/* Vista de tarjetas para dispositivos móviles */}
          <CardContent className="sm:hidden py-2">
            <div className="space-y-3">
              {ventas?.map((venta) => {
                const metodosPago = obtenerMetodosPago(venta);
                  
                return (
                  <div
                    key={venta.id}
                    className={cn(
                      "border rounded-md p-3 relative cursor-pointer",
                      ventasSeleccionadas.has(venta.id) ? "bg-muted border-primary" : ""
                    )}
                    onClick={() => toggleSeleccion(venta.id)}
                  >
                    <div className="absolute top-3 right-3">
                      <Checkbox 
                        checked={ventasSeleccionadas.has(venta.id)}
                        onCheckedChange={() => toggleSeleccion(venta.id)}
                      />
                    </div>
                    <div className="pr-8">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex-grow">
                          <div className="font-medium text-sm">{venta.cliente?.nombre || "N/A"}</div>
                          {venta.cliente?.dni_cuit && 
                            <div className="text-xs text-muted-foreground">
                              {venta.cliente.dni_cuit}
                            </div>
                          }
                        </div>
                        <div className="text-right text-sm font-semibold">
                          {formatCurrency(venta.total)}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <div>Fecha:</div>
                        <div className="text-right">{formatFechaCorta(venta.fecha)}</div>
                        
                        <div>Pago:</div>
                        <div className="text-right capitalize truncate">{metodosPago}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 