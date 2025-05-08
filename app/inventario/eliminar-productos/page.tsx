"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trash2, Loader2, Search, Package } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { useEliminarProductosBatch, ResultadoEliminacionProducto } from "@/hooks/useProductos";
import { Badge } from "@/components/ui/badge";

// Definición del tipo Producto como se usa en la página de inventario principal
// Es importante mantener la consistencia o tener un tipo global.
type Producto = {
  id: string;
  nombre: string;
  sku: string | null;
  stock: number;
  stock_min: number;
  costo_unit: number | null;
  precio_unit: number | null;
  categoria_id: string | null;
  categoria_nombre: string | null;
};

const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount);
};

export default function EliminarProductosPage() {
  const router = useRouter();
  const [productosSeleccionados, setProductosSeleccionados] = useState<Set<string>>(new Set());
  const [confirmarDialogOpen, setConfirmarDialogOpen] = useState(false);
  const [resultadosEliminacion, setResultadosEliminacion] = useState<ResultadoEliminacionProducto[]>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const eliminarProductosMutation = useEliminarProductosBatch();

  // Hook para obtener productos (similar al de la página de inventario)
  const { data: productos, isLoading, error } = useQuery<Producto[], Error>({
    queryKey: ["productos", searchTerm], // Añadir searchTerm a la queryKey para re-fetch
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from("productos")
        .select(
          `
          id, nombre, sku, stock, stock_min, costo_unit, precio_unit, categoria_id,
          categorias (nombre) 
        `
        )
        .order("nombre");

      if (searchTerm.trim() !== "") {
        query = query.ilike("nombre", `%${searchTerm.trim()}%`);
        // Podrías añadir búsqueda por SKU también si es necesario:
        // query = query.or(`nombre.ilike.%${searchTerm.trim()}%,sku.ilike.%${searchTerm.trim()}%`);
      }

      const { data: productosRaw, error: fetchError } = await query;

      if (fetchError) {
        console.error("Error fetching products for deletion page:", fetchError);
        throw new Error(fetchError.message);
      }

      return (productosRaw || []).map((p: any) => ({
        id: p.id,
        nombre: p.nombre,
        sku: p.sku,
        stock: p.stock,
        stock_min: p.stock_min,
        costo_unit: p.costo_unit,
        precio_unit: p.precio_unit,
        categoria_id: p.categoria_id,
        categoria_nombre: p.categorias?.nombre || null,
      }));
    },
  });

  const seleccionarTodos = (seleccionar: boolean) => {
    if (seleccionar && productos) {
      setProductosSeleccionados(new Set(productos.map((p) => p.id)));
    } else {
      setProductosSeleccionados(new Set());
    }
  };

  const toggleSeleccion = (productoId: string) => {
    const nuevaSeleccion = new Set(productosSeleccionados);
    if (nuevaSeleccion.has(productoId)) {
      nuevaSeleccion.delete(productoId);
    } else {
      nuevaSeleccion.add(productoId);
    }
    setProductosSeleccionados(nuevaSeleccion);
  };

  const eliminarProductosSeleccionados = async () => {
    if (productosSeleccionados.size === 0) {
      toast.warning("No hay productos seleccionados para eliminar.");
      return;
    }

    try {
      const idsParaEliminar = Array.from(productosSeleccionados);
      const resultados = await eliminarProductosMutation.mutateAsync(idsParaEliminar);
      
      setResultadosEliminacion(resultados);
      setMostrarResultados(true);

      const exitosos = resultados.filter(r => r.exito).length;
      const fallidos = resultados.length - exitosos;

      if (exitosos > 0 && fallidos === 0) {
        toast.success(`Se eliminaron ${exitosos} producto(s) correctamente.`);
      } else if (exitosos > 0 && fallidos > 0) {
        toast.info(`Se eliminaron ${exitosos} producto(s), pero ${fallidos} no pudieron eliminarse.`);
      } else if (fallidos > 0) {
        toast.error(`${fallidos} producto(s) no pudieron eliminarse. Revise los detalles.`);
      } else {
         toast.error("No se pudo eliminar ningún producto seleccionado o no hubo resultados.");
      }
      
      setConfirmarDialogOpen(false);
      setProductosSeleccionados(new Set()); // Limpiar selección después de la operación

    } catch (error: any) {
      toast.error(error.message || "Ocurrió un error durante el proceso de eliminación de productos.");
      console.error("Error general en eliminarProductosSeleccionados:", error);
      setConfirmarDialogOpen(false);
    }
  };


  return (
    <div className="container mx-auto py-4 sm:py-6 px-3 sm:px-6 lg:px-8">
      <div className="flex items-center mb-4 sm:mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/inventario')}
          className="mr-2 sm:mr-4"
        >
          <ArrowLeft className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Volver a Inventario</span>
        </Button>
        <h1 className="text-xl sm:text-2xl font-bold text-primary flex items-center">
          <Package className="mr-2 sm:mr-3 h-5 sm:h-6 w-5 sm:w-6" /> Eliminar Productos
        </h1>
      </div>

      <Card className="mb-4 sm:mb-6">
        <CardHeader className="py-3 sm:py-4">
          <CardTitle className="text-base sm:text-lg">Buscar Productos</CardTitle>
        </CardHeader>
        <CardContent className="py-2 sm:py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nombre o SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
        </CardContent>
      </Card>

      {mostrarResultados && resultadosEliminacion.length > 0 && (
        <Card className="mb-4 sm:mb-6 border-muted">
          <CardHeader className="py-3 sm:py-4">
            <CardTitle className="text-base sm:text-lg">Resultados de la Eliminación</CardTitle>
            <CardDescription>
              Exitosos: {resultadosEliminacion.filter(r => r.exito).length},
              Fallidos: {resultadosEliminacion.filter(r => !r.exito).length}
            </CardDescription>
          </CardHeader>
          {resultadosEliminacion.some(r => !r.exito) && (
            <CardContent className="py-2 sm:py-3">
              <div className="text-sm">
                <h4 className="font-medium mb-2">Detalles de errores:</h4>
                <ul className="list-disc ml-5 space-y-1 max-h-32 sm:max-h-40 overflow-y-auto">
                  {resultadosEliminacion
                    .filter(r => !r.exito)
                    .map(r => (
                      <li key={r.producto_id} className="text-destructive">
                        ID: {r.producto_id.substring(0,8)}... - {r.mensaje}
                      </li>
                    ))}
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
              Ocultar Resultados
            </Button>
          </CardFooter>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3 sm:space-y-4">
          <Skeleton className="h-10 sm:h-12 w-full rounded-md" />
          <Skeleton className="h-48 sm:h-64 w-full rounded-md" />
        </div>
      ) : error ? (
        <Card className="border-destructive">
          <CardHeader className="py-3 sm:py-4">
            <CardTitle className="text-destructive text-base sm:text-lg">Error al Cargar Productos</CardTitle>
            <CardDescription className="text-destructive">
              {error.message || "Ocurrió un error desconocido."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : !productos || productos.length === 0 ? (
        <EmptyState
          title="No hay productos"
          description={searchTerm ? "No hay productos que coincidan con tu búsqueda." : "No hay productos para mostrar."}
          icon={<Package className="h-10 sm:h-12 w-10 sm:w-12 text-muted-foreground" />}
        />
      ) : (
        <Card>
          <CardHeader className="py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg">Productos en Inventario</CardTitle>
              <CardDescription>
                {productos.length} producto(s) encontrado(s). Selecciona los que deseas eliminar.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => seleccionarTodos(productosSeleccionados.size !== (productos?.length || 0))}
                disabled={productos.length === 0}
                className="text-xs sm:text-sm"
              >
                {productosSeleccionados.size === (productos?.length || 0) && productos.length > 0
                  ? "Deseleccionar Todos"
                  : "Seleccionar Todos"}
              </Button>
              <Dialog open={confirmarDialogOpen} onOpenChange={setConfirmarDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={productosSeleccionados.size === 0 || eliminarProductosMutation.isPending}
                    className="text-xs sm:text-sm"
                  >
                    {eliminarProductosMutation.isPending ? (
                      <Loader2 className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />
                    )}
                    Eliminar ({productosSeleccionados.size})
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md max-w-[calc(100%-2rem)]">
                  <DialogHeader>
                    <DialogTitle>Confirmar Eliminación</DialogTitle>
                    <DialogDescription>
                      ¿Estás seguro de que deseas eliminar {productosSeleccionados.size} producto(s) seleccionado(s)?
                      Esta acción no se puede deshacer.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setConfirmarDialogOpen(false)} disabled={eliminarProductosMutation.isPending} className="w-full sm:w-auto">
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={eliminarProductosSeleccionados}
                      disabled={eliminarProductosMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {eliminarProductosMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {eliminarProductosMutation.isPending ? "Eliminando..." : "Eliminar Definitivamente"}
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
                      <Checkbox
                        checked={productos.length > 0 && productosSeleccionados.size === productos.length}
                        onCheckedChange={(checked) => seleccionarTodos(!!checked)}
                        aria-label="Seleccionar todos los productos"
                        disabled={productos.length === 0}
                      />
                    </TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-right">Precio Venta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productos.map((producto) => (
                    <TableRow
                      key={producto.id}
                      className={`cursor-pointer hover:bg-muted/50 ${productosSeleccionados.has(producto.id) ? 'bg-muted' : ''}`}
                      onClick={() => toggleSeleccion(producto.id)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={productosSeleccionados.has(producto.id)}
                          onCheckedChange={() => toggleSeleccion(producto.id)}
                          aria-label={`Seleccionar ${producto.nombre}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{producto.nombre}</TableCell>
                      <TableCell>
                        {producto.categoria_nombre ? (
                          <Badge variant="outline">{producto.categoria_nombre}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{producto.sku || "-"}</TableCell>
                      <TableCell className="text-right">{producto.stock}</TableCell>
                      <TableCell className="text-right">{formatCurrency(producto.costo_unit)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(producto.precio_unit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          
          {/* Vista de tarjetas para dispositivos móviles */}
          <CardContent className="sm:hidden py-2">
            <div className="space-y-3">
              {productos.map((producto) => (
                <div
                  key={producto.id}
                  className={`border rounded-md p-3 relative cursor-pointer ${productosSeleccionados.has(producto.id) ? 'bg-muted border-primary' : ''}`}
                  onClick={() => toggleSeleccion(producto.id)}
                >
                  <div className="absolute top-3 right-3">
                    <Checkbox
                      checked={productosSeleccionados.has(producto.id)}
                      onCheckedChange={() => toggleSeleccion(producto.id)}
                      aria-label={`Seleccionar ${producto.nombre}`}
                    />
                  </div>
                  <div className="pr-8">
                    <h3 className="font-medium text-sm">{producto.nombre}</h3>
                    {producto.categoria_nombre && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        {producto.categoria_nombre}
                      </Badge>
                    )}
                    <dl className="grid grid-cols-2 gap-1 mt-2 text-xs text-muted-foreground">
                      <dt>SKU:</dt>
                      <dd className="text-right">{producto.sku || "-"}</dd>
                      <dt>Stock:</dt>
                      <dd className="text-right">{producto.stock}</dd>
                      <dt>Costo:</dt>
                      <dd className="text-right">{formatCurrency(producto.costo_unit)}</dd>
                      <dt>Precio:</dt>
                      <dd className="text-right">{formatCurrency(producto.precio_unit)}</dd>
                    </dl>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 