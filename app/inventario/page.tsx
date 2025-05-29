"use client";

import { useState, useEffect, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Import useMutation and useQueryClient
import {
  ArrowLeft,
  Plus,
  MinusCircle,
  PlusCircle,
  AlertTriangle,
  CreditCard,
  Edit,
  Eye,
  Trash2,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import AddProductDialog from "@/components/add-product-dialog";
import EditProductDialog from "@/components/edit-product-dialog";
import ProductPurchasesDialog from "@/components/product-purchases-dialog";
import CompraConTarjetaDialog from "@/components/compra-con-tarjeta-dialog";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { RealizarVentaButton } from "@/components/ventas/RealizarVentaButton";
import RealizarVentaButtonEsqueleto from "@/components/ventas/realizar-venta-button-esqueleto";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import AjusteStockModal from "@/components/inventario/AjusteStockModal";
import type { ProductoInventario } from "@/types/inventario.types";

// Define the type for the product data received from Supabase
type ProductoRaw = {
  id: string;
  nombre: string;
  sku: string | null;
  stock: number;
  stock_min: number;
  costo_unit: number | null;
  precio_unit: number | null;
  categoria_id: string | null;
  categorias?: { nombre: string | null } | null; // Supabase join structure
};

// Define the type for the product data after transformation
type Producto = {
  id: string;
  nombre: string;
  sku: string | null;
  stock: number;
  stock_min: number;
  costo_unit: number | null;
  precio_unit: number | null;
  categoria_id: string | null;
  categoria_nombre: string | null; // Flattened category name
};

export default function InventarioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient(); // Get queryClient instance
  const [stockBajoAlertado, setStockBajoAlertado] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [isAjusteModalOpen, setIsAjusteModalOpen] = useState(false);
  const [productoParaAjuste, setProductoParaAjuste] = useState<ProductoInventario | null>(null);

  // Fetch products using react-query
  const {
    data: productos,
    isLoading,
    error,
  } = useQuery<Producto[], Error>({
    queryKey: ["productos"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("productos")
        .select(
          `
          id, nombre, sku, stock, stock_min, costo_unit, precio_unit, categoria_id,
          categorias (nombre)
        `
        )
        .order("nombre");

      if (error) {
        console.error("Error fetching products:", error.message);
        throw new Error(
          `Error al cargar productos: ${error.message || "Desconocido"}`
        );
      }

      // Explicit type guard and transformation
      const transformedData: Producto[] = [];
      if (data) {
        for (const p of data as any[]) { // Iterate as any first
          let categoriaNombre: string | null = null;
          if (p.categorias && typeof p.categorias === 'object' && 'nombre' in p.categorias) {
            categoriaNombre = p.categorias.nombre;
          }
          transformedData.push({
            id: String(p.id ?? ''), // Ensure string
            nombre: String(p.nombre ?? ''), // Ensure string
            sku: p.sku ? String(p.sku) : null,
            stock: typeof p.stock === 'number' ? p.stock : 0, // Ensure number
            stock_min: typeof p.stock_min === 'number' ? p.stock_min : 0, // Ensure number
            costo_unit: typeof p.costo_unit === 'number' ? p.costo_unit : null,
            precio_unit: typeof p.precio_unit === 'number' ? p.precio_unit : null,
            categoria_id: p.categoria_id ? String(p.categoria_id) : null,
            categoria_nombre: categoriaNombre,
          });
        }
      }
      return transformedData;
    },
  });

  // Mutation for updating stock
  const updateStockMutation = useMutation<
    void, // Expected return type on success
    Error, // Expected error type
    { productoId: string; incremento: number } // Variables type
  >({
    mutationFn: async ({ productoId, incremento }) => {
      const supabase = createClient();

      // 1. Get current stock and cost
      const { data: producto, error: fetchError } = await supabase
        .from("productos")
        .select("stock, costo_unit")
        .eq("id", productoId)
        .single();

      if (fetchError) {
        throw new Error(
          `Error fetching product for update: ${fetchError.message}`
        );
      }

      // Ensure producto.stock is treated as a number
      const currentStock = (typeof producto?.stock === 'number') ? producto.stock : 0;
      const nuevoStock = Math.max(0, currentStock + incremento);

      if (nuevoStock === currentStock) {
        // No change needed
        return;
      }

      // 2. Update stock
      const { error: updateError } = await supabase
        .from("productos")
        .update({ stock: nuevoStock })
        .eq("id", productoId);

      if (updateError) {
        throw new Error(`Error updating stock: ${updateError.message}`);
      }

      // 3. If incrementing, record purchase/history
      if (incremento > 0) {
        const costoUnitario = producto?.costo_unit || 0;

        try {
          // Check if 'compras' table exists and record purchase if it does
          const { error: checkError } = await supabase
            .from("compras")
            .select("*", { count: "exact", head: true });

          if (
            checkError &&
            checkError.message.includes("relation") &&
            checkError.message.includes("does not exist")
          ) {
            console.warn("Table 'compras' does not exist. Purchase not logged.");
          } else if (checkError) {
            // Some other error checking the table
             console.error("Error checking 'compras' table:", checkError.message);
          }
           else {
            // Table exists, attempt to insert purchase
            const { data: compra, error: compraError } = await supabase
              .from("compras")
              .insert({
                producto_id: productoId,
                costo_unit: costoUnitario,
                cantidad: incremento,
                restante: incremento, // Assuming remaining quantity is the same as purchased initially
              })
              .select()
              .single(); // Use single() if inserting one row and expecting one back

            if (compraError) {
              console.error("Error logging purchase:", compraError.message);
            } else {
              // Log price history
              const { error: historyError } = await supabase
                .from("price_history")
                .insert({
                  producto_id: productoId,
                  tipo: "costo", // Assuming 'costo' is the type for purchase price
                  precio: costoUnitario,
                  // Ensure compra.id exists before using it
                  compra_id: compra ? compra.id : null,
                });

              if (historyError) {
                console.error(
                  "Error logging price history:",
                  historyError.message
                );
              }
            }
          }
        } catch (logError: any) {
           console.error("Unexpected error during purchase logging:", logError.message);
        }
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate the 'productos' query to refetch data after successful update
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      const updatedProduct = productos?.find(
        (p) => p.id === variables.productoId
      );
      const newStock = Math.max(
        0,
        (updatedProduct?.stock || 0) + variables.incremento
      ); // Calculate anticipated new stock for toast

      toast({
        title: "Stock actualizado",
        description: `El stock ha sido actualizado a ${newStock} unidades.`,
      });
    },
    onError: (err) => {
      toast({
        title: "Error al actualizar stock",
        description: err.message || "Ocurrió un error desconocido.",
        variant: "destructive",
      });
    },
  });

  // Verify if there are products with low stock and show alert
  useEffect(() => {
    if (productos && !stockBajoAlertado) {
      const productosBajoStock = productos.filter(
        (p) => p.stock_min > 0 && p.stock <= p.stock_min
      );

      if (productosBajoStock.length > 0) {
        toast({
          title: "Stock bajo",
          description: `Hay ${productosBajoStock.length} producto(s) con stock por debajo del mínimo.`,
          variant: "destructive",
        });
        setStockBajoAlertado(true); // Set flag to true after showing the alert
      }
    }
  }, [productos, toast, stockBajoAlertado]); // Added stockBajoAlertado to dependency array

  // Function to determine if a product has critical stock
  const tieneStockCritico = (producto: Producto) => {
    return producto.stock_min > 0 && producto.stock <= producto.stock_min;
  };

  const handleOpenAjusteModal = (producto: Producto) => {
    const productoInventario: ProductoInventario = {
        id: producto.id,
        nombre: producto.nombre,
        sku: producto.sku,
        stock: producto.stock,
        stock_actual: producto.stock,
        costo_unit: producto.costo_unit,
        precio_unit: producto.precio_unit,
        precio_venta: producto.precio_unit ?? 0,
        created_at: "",
    };
    setProductoParaAjuste(productoInventario);
    setIsAjusteModalOpen(true);
  };

  const productosFiltrados = productos?.filter((producto) =>
    producto.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (producto.sku && producto.sku.toLowerCase().includes(busqueda.toLowerCase())) ||
    (producto.categoria_nombre && producto.categoria_nombre.toLowerCase().includes(busqueda.toLowerCase()))
  ) || [];

  return (
    <div className="container mx-auto py-6 px-2 sm:px-4 lg:px-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="mr-2 sm:mr-4 flex-shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary truncate">Inventario</h1>
        </div>
        
        {/* Botones en vista móvil (en grid) */}
        <div className="grid grid-cols-2 sm:hidden gap-2 w-full">
          <Button 
            variant="outline"
            size="sm"
            onClick={() => router.push("/reportes")}
            className="h-10 flex items-center justify-center"
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Reportes
          </Button>
          <CompraConTarjetaDialog>
            <Button 
              size="sm"
              className="h-10 flex items-center justify-center"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Registrar Compra
            </Button>
          </CompraConTarjetaDialog>
          <AddProductDialog>
            <Button 
              variant="outline" 
              size="sm"
              className="h-10 flex items-center justify-center"
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar producto
            </Button>
          </AddProductDialog>
          <Button 
            variant="destructive"
            size="sm"
            onClick={() => router.push('/inventario/eliminar-productos')}
            className="h-10 flex items-center justify-center"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar Productos
          </Button>
          <div className="col-span-2">
            <Suspense fallback={<RealizarVentaButtonEsqueleto />}>
              <RealizarVentaButton className="w-full h-10 flex items-center justify-center" />
            </Suspense>
          </div>
        </div>
        
        {/* Botones en vista desktop (flex) */}
        <div className="hidden sm:flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/reportes")}>
            <AlertTriangle className="mr-2 h-4 w-4" />
            Reportes
          </Button>
          <CompraConTarjetaDialog>
            <Button size="sm">
              <CreditCard className="mr-2 h-4 w-4" />
              Registrar Compra
            </Button>
          </CompraConTarjetaDialog>
          <AddProductDialog>
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Agregar producto
            </Button>
          </AddProductDialog>
          <Suspense fallback={<RealizarVentaButtonEsqueleto />}>
            <RealizarVentaButton />
          </Suspense>
          <Button 
            variant="destructive"
            size="sm"
            onClick={() => router.push('/inventario/eliminar-productos')}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar Productos
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[60px] w-full rounded-lg" />
          <Skeleton className="h-[60px] w-full rounded-lg" />
          <Skeleton className="h-[60px] w-full rounded-lg sm:hidden" />
        </div>
      ) : error ? (
        <Card className="rounded-lg shadow-sm border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error al Cargar Inventario</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : !productos || productos.length === 0 ? (
        <EmptyState
          title="Sin productos registrados"
          description="Agrega tu primer producto."
          action={
            <AddProductDialog>
              <Button size="sm">Agregar producto</Button>
            </AddProductDialog>
          }
        />
      ) : (
        <div>
          <div className="sm:hidden space-y-3 pb-8 overflow-y-auto max-h-screen">
            <Input
              className="w-full px-4 py-2 mb-4 rounded border bg-card text-base focus:ring-primary focus:border-primary"
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {productosFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron productos para "{busqueda}"
              </div>
            ) : (
              productosFiltrados.map((producto) => (
                <div
                  key={producto.id}
                  className={cn(
                    "border rounded-lg p-4 bg-card shadow-sm flex flex-col",
                    tieneStockCritico(producto) ? "border-red-300 bg-red-50" : ""
                  )}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-grow pr-2">
                       <h3 className={cn(
                           "font-medium text-base leading-tight",
                            tieneStockCritico(producto) ? "text-red-700" : ""
                         )}>
                         {producto.nombre}
                       </h3>
                       {producto.categoria_nombre && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            {producto.categoria_nombre}
                          </Badge>
                        )}
                       <p className={cn(
                            "text-xs mt-1",
                            tieneStockCritico(producto) ? "text-red-600" : "text-muted-foreground"
                          )}>
                         SKU: {producto.sku || "-"}
                       </p>
                    </div>
                     <div className={cn(
                         "text-right flex-shrink-0 pl-2",
                         tieneStockCritico(producto) ? "text-red-700" : ""
                       )}>
                       <p className="font-bold text-lg">{producto.stock}</p>
                       <p className="text-xs text-muted-foreground">Stock</p>
                     </div>
                  </div>

                   <div className="flex justify-between items-center text-xs text-muted-foreground border-t pt-2 mb-3">
                     <span>Costo: {producto.costo_unit ? `$${producto.costo_unit.toFixed(2)}` : "-"}</span>
                     <span>Precio: {producto.precio_unit ? `$${producto.precio_unit.toFixed(2)}` : "-"}</span>
                   </div>

                  <div className="flex items-center justify-end space-x-2 border-t pt-3 mt-auto">
                    <Button
                      variant="outline"
                      size="icon"
                      className="p-2 h-8 w-8"
                      title="Ajustar Stock Manualmente"
                      onClick={() => handleOpenAjusteModal(producto)}
                    >
                      <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="p-2 h-8 w-8"
                      aria-label="Disminuir stock"
                      onClick={() => updateStockMutation.mutate({ productoId: producto.id, incremento: -1 })}
                      disabled={updateStockMutation.isPending || producto.stock <= 0}
                    >
                      <MinusCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="p-2 h-8 w-8"
                      aria-label="Aumentar stock"
                      onClick={() => updateStockMutation.mutate({ productoId: producto.id, incremento: 1 })}
                      disabled={updateStockMutation.isPending}
                    >
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                    <EditProductDialog producto={producto}>
                       <Button variant="outline" size="icon" className="p-2 h-8 w-8" aria-label="Editar producto">
                          <Edit className="h-4 w-4" />
                       </Button>
                    </EditProductDialog>
                    <ProductPurchasesDialog productoId={producto.id} productoNombre={producto.nombre}>
                       <Button variant="outline" size="icon" className="p-2 h-8 w-8" aria-label="Ver compras producto">
                          <Eye className="h-4 w-4" />
                       </Button>
                    </ProductPurchasesDialog>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden sm:block">
            <Input
              className="w-full px-4 py-2 mb-4 rounded border bg-card text-base focus:ring-primary focus:border-primary"
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {productosFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg shadow-sm">
                No se encontraron productos para "{busqueda}"
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border shadow-sm">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="py-3 px-4">Nombre</TableHead>
                      <TableHead className="py-3 px-4">Categoría</TableHead>
                      <TableHead className="py-3 px-4">SKU</TableHead>
                      <TableHead className="text-center py-3 px-4">Stock</TableHead>
                      <TableHead className="text-center py-3 px-4">Stock Min</TableHead>
                      <TableHead className="text-right py-3 px-4">Costo unit.</TableHead>
                      <TableHead className="text-right py-3 px-4">Precio venta</TableHead>
                      <TableHead className="text-center py-3 px-4">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productosFiltrados.map((producto) => (
                      <TableRow
                        key={producto.id}
                        className={cn(
                          tieneStockCritico(producto) ? "bg-red-50 text-red-600 hover:bg-red-100" : "hover:bg-muted/50"
                        )}
                      >
                        <TableCell className="font-medium py-3 px-4">
                          {producto.nombre}
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          {producto.categoria_nombre ? (
                            <Badge variant="outline">{producto.categoria_nombre}</Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="py-3 px-4">{producto.sku || "-"}</TableCell>
                        <TableCell className="text-center py-3 px-4">{producto.stock}</TableCell>
                        <TableCell className="text-center py-3 px-4">{producto.stock_min}</TableCell>
                        <TableCell className="text-right py-3 px-4">
                          {producto.costo_unit ? `$${producto.costo_unit.toFixed(2)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right py-3 px-4">
                          {producto.precio_unit ? `$${producto.precio_unit.toFixed(2)}` : "-"}
                        </TableCell>
                        <TableCell className="py-2 px-4">
                          <div className="flex items-center justify-center space-x-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Ajustar Stock Manualmente"
                              onClick={() => handleOpenAjusteModal(producto)}
                            >
                              <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Disminuir stock"
                              onClick={() => updateStockMutation.mutate({ productoId: producto.id, incremento: -1 })}
                              disabled={updateStockMutation.isPending || producto.stock <= 0}
                            >
                              <MinusCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Aumentar stock"
                              onClick={() => updateStockMutation.mutate({ productoId: producto.id, incremento: 1 })}
                              disabled={updateStockMutation.isPending}
                            >
                              <PlusCircle className="h-4 w-4" />
                            </Button>
                            <EditProductDialog producto={producto}>
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar producto">
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </EditProductDialog>
                            <ProductPurchasesDialog productoId={producto.id} productoNombre={producto.nombre}>
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ver compras producto">
                                    <Eye className="h-4 w-4" />
                                </Button>
                            </ProductPurchasesDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}
      {productoParaAjuste && (
        <AjusteStockModal
          producto={productoParaAjuste}
          open={isAjusteModalOpen}
          onOpenChange={setIsAjusteModalOpen}
        />
      )}
    </div>
  );
}