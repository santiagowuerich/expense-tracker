"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Import useMutation and useQueryClient
import {
  ArrowLeft,
  Plus,
  MinusCircle,
  PlusCircle,
  AlertTriangle,
  CreditCard,
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
// import { queryClient } from "@/lib/queries"; // queryClient already available via useQueryClient
import { Badge } from "@/components/ui/badge";
// import { v4 as uuidv4 } from "uuid"; // Not needed here anymore

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

      // Transform data to flatten the category name
      return (data as ProductoRaw[] | null)?.map((producto) => ({
        ...producto,
        categoria_nombre: producto.categorias?.nombre || null,
        categorias: undefined, // Remove the nested object
      })) || [];
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

      const currentStock = producto?.stock || 0;
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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="mr-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <h1 className="text-3xl font-bold text-primary">Inventario</h1>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => router.push("/reportes")}>
            <AlertTriangle className="mr-2 h-4 w-4" />
            Ver reportes
          </Button>
          {/* Assuming CompraConTarjetaDialog is for recording purchases/expenses */}
          <CompraConTarjetaDialog>
             {/* The purpose of this dialog button is unclear in the context of "Inventario".
                 If it's for recording expenses related to inventory purchases,
                 it might be better placed contextually. Leaving it as is for now
                 but note the potential confusion.
             */}
            <Button>
              <CreditCard className="mr-2 h-4 w-4" />
              Registrar Egreso
            </Button>
          </CompraConTarjetaDialog>
          <AddProductDialog>
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Agregar producto
            </Button>
          </AddProductDialog>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>
      ) : error ? (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>
              Ocurrió un error al cargar el inventario: {error.message}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : !productos || productos.length === 0 ? (
        <EmptyState
          title="Sin productos registrados"
          description="Agrega tu primer producto para empezar a gestionar tu inventario."
          action={
            <AddProductDialog>
              <Button>Agregar producto</Button>
            </AddProductDialog>
          }
        />
      ) : (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Listado de productos</CardTitle>
            <CardDescription>Gestiona tu inventario de productos</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-center">Stock Min</TableHead>
                  <TableHead className="text-right">Costo unitario</TableHead>
                  <TableHead className="text-right">Precio venta</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productos.map((producto) => (
                  <TableRow
                    key={producto.id}
                    className={
                      tieneStockCritico(producto)
                        ? "bg-red-50 text-red-600"
                        : ""
                    }
                  >
                    <TableCell className="font-medium">
                      {producto.nombre}
                    </TableCell>
                    <TableCell>
                      {producto.categoria_nombre ? (
                        <Badge variant="outline">
                          {producto.categoria_nombre}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{producto.sku || "-"}</TableCell>
                    <TableCell className="text-center">
                      {producto.stock}
                    </TableCell>
                    <TableCell className="text-center">
                      {producto.stock_min}
                    </TableCell>
                    <TableCell className="text-right">
                      {producto.costo_unit
                        ? `$${producto.costo_unit.toFixed(2)}`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {producto.precio_unit
                        ? `$${producto.precio_unit.toFixed(2)}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            updateStockMutation.mutate({
                              productoId: producto.id,
                              incremento: -1,
                            })
                          }
                          disabled={
                            updateStockMutation.isLoading || producto.stock <= 0
                          }
                        >
                          <MinusCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            updateStockMutation.mutate({
                              productoId: producto.id,
                              incremento: 1,
                            })
                          }
                          disabled={updateStockMutation.isLoading}
                        >
                          <PlusCircle className="h-4 w-4" />
                        </Button>
                        <EditProductDialog producto={producto} />
                        <ProductPurchasesDialog
                          productoId={producto.id}
                          productoNombre={producto.nombre}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}