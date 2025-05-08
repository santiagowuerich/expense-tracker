"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Trash2, Calendar, Loader2, Filter, Search, CreditCard, Banknote, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

import { useEliminarPagosBatch, ResultadoEliminacionPago } from "@/hooks/useResumenCompras";
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
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase-browser";
import { useQuery } from "@tanstack/react-query";

type MesSeleccionado = string | null; // formato: "YYYY-MM"
type MetodoPago = "todos" | "tarjeta" | "efectivo" | "transferencia";

// Definición de tipo para los datos que vienen de Supabase
type PagoFromDB = {
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
  payment_method: string;
  tarjetas?: {
    alias: string | null;
  };
};

// Tipo para los pagos que vamos a mostrar
type Pago = {
  id: string;
  tarjeta_id: string;
  tarjeta_alias?: string | null;
  monto: number;
  fecha: string;
  descripcion: string;
  ciclo_cierre: string;
  cuotas: number;
  cuota_actual: number;
  es_cuota: boolean;
  pago_original_id: string | null;
  payment_method: string;
  tiene_cuotas?: boolean;
  es_grupo_cuotas?: boolean; // Nuevo campo para marcar pagos agrupados
  pagos_agrupados?: string[]; // IDs de los pagos originales agrupados
};

type PagoAgrupado = {
  id: string; // ID único para el grupo (primera cuota o ID artificial)
  descripcion_base: string; // Descripción sin la parte "Cuota X/Y"
  fecha: string; // Fecha de la primera cuota
  tarjeta_id: string;
  tarjeta_alias?: string | null;
  monto_total: number; // Suma de todas las cuotas
  total_cuotas: number;
  payment_method: string;
  ids_cuotas: string[]; // Array con todos los IDs de las cuotas individuales
};

export default function EliminarPagosPage() {
  const router = useRouter();
  const [mesSeleccionado, setMesSeleccionado] = useState<MesSeleccionado>(
    // Inicializar con el mes actual
    format(new Date(), "yyyy-MM")
  );
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("todos");
  const [pagosSeleccionados, setPagosSeleccionados] = useState<Set<string>>(new Set());
  const [confirmarDialogOpen, setConfirmarDialogOpen] = useState(false);
  const [resultadosEliminacion, setResultadosEliminacion] = useState<ResultadoEliminacionPago[]>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Calcular el rango de fechas basado en el mes seleccionado
  const fechaRango = useMemo(() => {
    if (!mesSeleccionado) return undefined;
    const fecha = parseISO(`${mesSeleccionado}-01`);
    return {
      from: startOfMonth(fecha),
      to: endOfMonth(fecha)
    };
  }, [mesSeleccionado]);

  // Función para obtener pagos con filtros
  const { data, isLoading, error } = useQuery<PagoAgrupado[]>({
    queryKey: ["pagos_agrupados", fechaRango?.from?.toISOString(), fechaRango?.to?.toISOString(), metodoPago, searchTerm],
    queryFn: async () => {
      const supabase = createClient();

      // Obtener todos los pagos sin agrupar primero
      let query = supabase
        .from("pagos")
        .select(`
          id, tarjeta_id, monto, fecha, descripcion, ciclo_cierre,
          cuotas, cuota_actual, es_cuota, pago_original_id, payment_method,
          tarjetas (alias)
        `)
        .order("fecha", { ascending: false });

      // Aplicar filtros de fecha
      if (fechaRango?.from) {
        query = query.gte("fecha", fechaRango.from.toISOString().split('T')[0]);
      }
      if (fechaRango?.to) {
        query = query.lte("fecha", fechaRango.to.toISOString().split('T')[0]);
      }

      // Filtrar por método de pago si es necesario
      if (metodoPago !== "todos") {
        query = query.eq("payment_method", metodoPago);
      }

      // Ejecutar la consulta
      const { data: pagosRaw, error } = await query;

      if (error) throw error;

      // Realizar agrupación en el cliente
      const pagos = (pagosRaw || []) as any[];
      
      // Mapa para agrupar por descripción base (sin "Cuota X/Y")
      const gruposPagos = new Map<string, any[]>();
      
      // Patrón para extraer descripción base y número de cuota
      const patronCuota = /^(.+?)\s*\(Cuota\s+(\d+)\/(\d+)\)\s*$/i;
      
      // Primera pasada: identificar grupos por descripción base o pago_original_id
      pagos.forEach(pago => {
        try {
          const matches = String(pago.descripcion || '').match(patronCuota);
          
          // Si es una cuota, extraer información
          if (matches) {
            const [, descripcionBase, numCuota, totalCuotas] = matches;
            
            // Generar clave única para agrupar
            // Usar pago_original_id si existe, o la descripción base + total cuotas
            const clavePrincipal = pago.pago_original_id || 
                               `${descripcionBase.trim()}_${totalCuotas}_${pago.tarjeta_id}`;
            
            if (!gruposPagos.has(clavePrincipal)) {
              gruposPagos.set(clavePrincipal, []);
            }
            
            gruposPagos.get(clavePrincipal)!.push(pago);
          } else {
            // Para pagos que no son cuotas, usar el ID como clave
            gruposPagos.set(`single_${pago.id}`, [pago]);
          }
        } catch (e) {
          console.error("Error procesando pago:", e);
          // Fallback para pagos con formato incorrecto
          gruposPagos.set(`single_${pago.id}`, [pago]);
        }
      });
      
      // Segunda pasada: convertir los grupos en objetos PagoAgrupado
      const pagosAgrupados: PagoAgrupado[] = [];
      
      gruposPagos.forEach((grupo, clave) => {
        try {
          if (grupo.length > 1) {
            // Es un grupo de cuotas: combinarlas en un solo objeto
            const primerPago = grupo[0];
            let descripcionBase = '';
            try {
              descripcionBase = String(primerPago.descripcion || '').replace(/\s*\(Cuota \d+\/\d+\)\s*/, '');
            } catch (e) {
              descripcionBase = 'Pago agrupado';
            }
            
            const montoTotal = grupo.reduce((sum, p) => sum + (Number(p.monto) || 0), 0);
            const totalCuotas = Number(primerPago.cuotas) || grupo.length;
            
            pagosAgrupados.push({
              id: `grupo_${clave}`,
              descripcion_base: descripcionBase,
              fecha: String(primerPago.fecha) || new Date().toISOString(),
              tarjeta_id: String(primerPago.tarjeta_id || ''),
              tarjeta_alias: primerPago.tarjetas?.alias || null,
              monto_total: montoTotal,
              total_cuotas: totalCuotas,
              payment_method: String(primerPago.payment_method || 'desconocido'),
              ids_cuotas: grupo.map(p => String(p.id))
            });
          } else if (grupo.length === 1) {
            // Pago individual (no es cuota o es cuota única)
            const pago = grupo[0];
            
            // Verificar si coincide con el término de búsqueda si existe
            if (searchTerm && searchTerm.trim() !== '') {
              const busqueda = searchTerm.toLowerCase();
              const descripcion = String(pago.descripcion || '').toLowerCase();
              const alias = String(pago.tarjetas?.alias || '').toLowerCase();
              
              if (!descripcion.includes(busqueda) && !alias.includes(busqueda)) {
                return; // Omitir este pago si no coincide con la búsqueda
              }
            }
            
            pagosAgrupados.push({
              id: String(pago.id),
              descripcion_base: String(pago.descripcion || ''),
              fecha: String(pago.fecha || new Date().toISOString()),
              tarjeta_id: String(pago.tarjeta_id || ''),
              tarjeta_alias: pago.tarjetas?.alias || null,
              monto_total: Number(pago.monto) || 0,
              total_cuotas: Number(pago.cuotas) || 1,
              payment_method: String(pago.payment_method || 'desconocido'),
              ids_cuotas: [String(pago.id)]
            });
          }
        } catch (e) {
          console.error("Error procesando grupo de pagos:", e);
        }
      });
      
      // Ordenar por fecha (más reciente primero)
      return pagosAgrupados.sort((a, b) => {
        try {
          return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        } catch {
          return 0;
        }
      });
    }
  });
  
  // Hook para eliminar pagos en lote
  const eliminarPagosMutation = useEliminarPagosBatch();

  // Función para seleccionar/deseleccionar todos los pagos
  const seleccionarTodos = (seleccionar: boolean) => {
    if (seleccionar && data) {
      const idsSet = new Set<string>();
      // Añadir todos los IDs de cuotas de todos los grupos
      data.forEach(pago => {
        pago.ids_cuotas.forEach(id => idsSet.add(id));
      });
      setPagosSeleccionados(idsSet);
    } else {
      setPagosSeleccionados(new Set());
    }
  };

  // Función para manejar la selección individual
  const toggleSeleccion = (pago: PagoAgrupado) => {
    const nuevaSeleccion = new Set(pagosSeleccionados);
    
    // Verificar si todas las cuotas del grupo están seleccionadas
    const todasSeleccionadas = pago.ids_cuotas.every(id => nuevaSeleccion.has(id));
    
    if (todasSeleccionadas) {
      // Deseleccionar todas las cuotas
      pago.ids_cuotas.forEach(id => nuevaSeleccion.delete(id));
    } else {
      // Seleccionar todas las cuotas
      pago.ids_cuotas.forEach(id => nuevaSeleccion.add(id));
    }
    
    setPagosSeleccionados(nuevaSeleccion);
  };

  // Función para verificar si un pago está seleccionado
  const isPagoSeleccionado = (pago: PagoAgrupado): boolean => {
    // Un pago agrupado está seleccionado si todas sus cuotas están seleccionadas
    return pago.ids_cuotas.every(id => pagosSeleccionados.has(id));
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

  // Función para obtener un ícono según el método de pago
  const getMetodoPagoIcon = (metodo: string) => {
    switch (metodo) {
      case 'tarjeta':
        return <CreditCard className="h-4 w-4 mr-2" />;
      case 'efectivo':
        return <Banknote className="h-4 w-4 mr-2" />;
      case 'transferencia':
        return <ArrowUpRight className="h-4 w-4 mr-2" />;
      default:
        return null;
    }
  };

  // Función para formatear el método de pago
  const formatMetodoPago = (metodo: string) => {
    const icon = getMetodoPagoIcon(metodo);
    const text = metodo.charAt(0).toUpperCase() + metodo.slice(1);
    return (
      <div className="flex items-center">
        {icon}
        <span>{text}</span>
      </div>
    );
  };

  // Función para eliminar los pagos seleccionados en lote
  const eliminarPagosSeleccionados = async () => {
    if (pagosSeleccionados.size === 0) {
      toast.warning("No hay pagos seleccionados para eliminar");
      return;
    }

    try {
      // Convertir Set a Array para enviar al servidor
      const pagosIds = Array.from(pagosSeleccionados);
      
      // Llamar a la función de eliminación en lote
      const resultados = await eliminarPagosMutation.mutateAsync(pagosIds);
      
      // Guardar resultados para mostrar
      setResultadosEliminacion(resultados);
      setMostrarResultados(true);
      
      // Contar resultados
      const exitosos = resultados.filter(r => r.exito).length;
      const fallidos = resultados.length - exitosos;
      
      // Mostrar resultado general
      if (exitosos > 0 && fallidos === 0) {
        toast.success(`Se eliminaron ${exitosos} pagos correctamente`);
      } else if (exitosos > 0 && fallidos > 0) {
        toast.info(`Se eliminaron ${exitosos} pagos, pero ${fallidos} no pudieron eliminarse`);
      } else {
        toast.error("No se pudo eliminar ningún pago");
      }
      
      // Cerrar diálogo de confirmación
      setConfirmarDialogOpen(false);
      
      // Limpiar selección
      setPagosSeleccionados(new Set());
    } catch (error) {
      toast.error("Ocurrió un error durante el proceso de eliminación");
      console.error("Error general:", error);
      setConfirmarDialogOpen(false);
    }
  };

  // Formatear fecha para mostrar
  const formatFecha = (fechaString: string) => {
    try {
      return format(new Date(fechaString), "dd/MM/yyyy", { locale: es });
    } catch {
      return "Fecha inválida";
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Encabezado y botón volver */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-2">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/resumen')}
            className="mr-2 sm:mr-4"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Volver</span>
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold text-primary">Eliminar Pagos</h1>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
          <CardDescription>Filtra los pagos para encontrar los que deseas eliminar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="w-full">
              <Select 
                value={mesSeleccionado || ""} 
                onValueChange={(valor) => {
                  setMesSeleccionado(valor);
                  setPagosSeleccionados(new Set());
                  setMostrarResultados(false);
                }}
              >
                <SelectTrigger>
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
            </div>
            
            <div className="w-full">
              <Select 
                value={metodoPago} 
                onValueChange={(valor: MetodoPago) => {
                  setMetodoPago(valor);
                  setPagosSeleccionados(new Set());
                  setMostrarResultados(false);
                }}
              >
                <SelectTrigger>
                  <div className="flex items-center">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Método de pago" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los métodos</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Campo de búsqueda */}
            <div className="w-full relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <Input
                type="search"
                placeholder="Buscar por descripción o tarjeta..."
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
        <Card className="mb-6 border-muted">
          <CardHeader>
            <CardTitle className="text-lg">Resultados de la eliminación</CardTitle>
            <CardDescription>
              Exitosos: {resultadosEliminacion.filter(r => r.exito).length}, 
              Fallidos: {resultadosEliminacion.filter(r => !r.exito).length}
            </CardDescription>
          </CardHeader>
          {resultadosEliminacion.some(r => !r.exito) && (
            <CardContent>
              <div className="text-sm">
                <h4 className="font-medium mb-2">Detalles de errores:</h4>
                <ul className="list-disc ml-5 space-y-1 max-h-[200px] overflow-y-auto">
                  {resultadosEliminacion
                    .filter(r => !r.exito)
                    .map(r => (
                      <li key={r.pago_id}>
                        Pago ID: {r.pago_id.substr(0, 8)}... - {r.mensaje}
                      </li>
                    ))
                  }
                </ul>
              </div>
            </CardContent>
          )}
          <CardFooter className="flex justify-center sm:justify-start">
            <Button 
              variant="outline" 
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setMostrarResultados(false)}
            >
              Ocultar resultados
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Resultados y acciones */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription className="text-destructive">
              {error instanceof Error ? error.message : "Error al cargar los pagos"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : !data || data.length === 0 ? (
        <EmptyState 
          title="No hay pagos"
          description={searchTerm 
            ? "No hay pagos que coincidan con tu búsqueda." 
            : `No se encontraron pagos en el período seleccionado.`}
        />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pagos</CardTitle>
              <CardDescription>
                {data.length} pago{data.length !== 1 ? 's' : ''} encontrado{data.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            {/* Botones para vista escritorio */}
            <div className="hidden md:flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => seleccionarTodos(pagosSeleccionados.size !== (data?.length || 0))}
              >
                {pagosSeleccionados.size === (data?.length || 0) ? "Deseleccionar todos" : "Seleccionar todos"}
              </Button>
              <Dialog open={confirmarDialogOpen} onOpenChange={setConfirmarDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={pagosSeleccionados.size === 0 || eliminarPagosMutation.isPending}
                  >
                    {eliminarPagosMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar seleccionados ({pagosSeleccionados.size})
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirmar eliminación</DialogTitle>
                    <DialogDescription>
                      ¿Está seguro que desea eliminar {pagosSeleccionados.size} pago{pagosSeleccionados.size !== 1 ? 's' : ''}? 
                      Esta acción no se puede deshacer.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setConfirmarDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={eliminarPagosSeleccionados}
                      disabled={eliminarPagosMutation.isPending}
                    >
                      {eliminarPagosMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {eliminarPagosMutation.isPending ? "Eliminando..." : "Eliminar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          
          {/* Botones para vista móvil */}
          <div className="md:hidden px-4 pb-4 flex flex-col gap-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => seleccionarTodos(pagosSeleccionados.size !== (data?.length || 0))}
            >
              {pagosSeleccionados.size === (data?.length || 0) ? "Deseleccionar todos" : "Seleccionar todos"}
            </Button>
            <Dialog open={confirmarDialogOpen} onOpenChange={setConfirmarDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={pagosSeleccionados.size === 0 || eliminarPagosMutation.isPending}
                >
                  {eliminarPagosMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar seleccionados ({pagosSeleccionados.size})
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95%] rounded-lg">
                <DialogHeader>
                  <DialogTitle>Confirmar eliminación</DialogTitle>
                  <DialogDescription>
                    ¿Está seguro que desea eliminar {pagosSeleccionados.size} pago{pagosSeleccionados.size !== 1 ? 's' : ''}? 
                    Esta acción no se puede deshacer.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col gap-2 sm:flex-row">
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => setConfirmarDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={eliminarPagosSeleccionados}
                    disabled={eliminarPagosMutation.isPending}
                  >
                    {eliminarPagosMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {eliminarPagosMutation.isPending ? "Eliminando..." : "Eliminar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <CardContent>
            {/* Vista móvil: tarjetas */}
            <div className="md:hidden space-y-4">
              {data.map((pago) => {
                const isSeleccionado = isPagoSeleccionado(pago);
                
                return (
                  <div 
                    key={pago.id} 
                    className={`border rounded-lg p-4 ${isSeleccionado ? 'border-primary bg-primary/5' : 'border-border'}`}
                    onClick={() => toggleSeleccion(pago)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center">
                        <Checkbox 
                          checked={isSeleccionado}
                          onCheckedChange={() => toggleSeleccion(pago)}
                          className="mr-3"
                        />
                        <div>
                          <div className="font-medium line-clamp-2">{pago.descripcion_base}</div>
                          <div className="text-sm text-muted-foreground">{formatFecha(pago.fecha)}</div>
                        </div>
                      </div>
                      <div className="font-semibold text-right">
                        {formatCurrency(pago.monto_total)}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-3">
                      {pago.payment_method && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          {getMetodoPagoIcon(pago.payment_method)}
                          <span>{pago.payment_method.charAt(0).toUpperCase() + pago.payment_method.slice(1)}</span>
                        </Badge>
                      )}
                      
                      {pago.tarjeta_alias && pago.payment_method === 'tarjeta' && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          {pago.tarjeta_alias}
                        </Badge>
                      )}
                      
                      {pago.total_cuotas > 1 && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          {pago.total_cuotas} cuotas
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Vista desktop: tabla */}
            <div className="hidden md:block overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <span className="sr-only">Seleccionar</span>
                    </TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Tarjeta</TableHead>
                    <TableHead>Cuotas</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((pago) => {
                    const isSeleccionado = isPagoSeleccionado(pago);
                    
                    return (
                      <TableRow 
                        key={pago.id} 
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell onClick={() => toggleSeleccion(pago)}>
                          <Checkbox 
                            checked={isSeleccionado}
                            onCheckedChange={() => toggleSeleccion(pago)}
                          />
                        </TableCell>
                        <TableCell onClick={() => toggleSeleccion(pago)}>
                          {formatFecha(pago.fecha)}
                        </TableCell>
                        <TableCell onClick={() => toggleSeleccion(pago)}>
                          <div className="font-medium">
                            {pago.descripcion_base}
                            {pago.total_cuotas > 1 && (
                              <Badge variant="outline" className="ml-2">
                                {pago.total_cuotas} cuotas
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={() => toggleSeleccion(pago)}>
                          {formatMetodoPago(pago.payment_method)}
                        </TableCell>
                        <TableCell onClick={() => toggleSeleccion(pago)}>
                          {pago.tarjeta_alias || (pago.payment_method === 'tarjeta' ? 'Sin nombre' : '-')}
                        </TableCell>
                        <TableCell onClick={() => toggleSeleccion(pago)}>
                          {pago.total_cuotas > 1 ? `${pago.total_cuotas} cuotas` : '-'}
                        </TableCell>
                        <TableCell className="text-right" onClick={() => toggleSeleccion(pago)}>
                          {formatCurrency(pago.monto_total)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 