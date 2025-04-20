"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Plus, MinusCircle, PlusCircle, AlertTriangle, CreditCard } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase-browser"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import AddProductDialog from "@/components/add-product-dialog"
import EditProductDialog from "@/components/edit-product-dialog"
import ProductPurchasesDialog from "@/components/product-purchases-dialog"
import CompraConTarjetaDialog from "@/components/compra-con-tarjeta-dialog"
import { useToast } from "@/components/ui/use-toast"
import { queryClient } from "@/lib/queries"
import { Badge } from "@/components/ui/badge"

type Producto = {
  id: string
  nombre: string
  sku: string | null
  stock: number
  stock_min: number
  costo_unit: number | null
  precio_unit: number | null
  categoria_id: string | null
  categoria_nombre?: string
}

export default function InventarioPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [stockBajoAlertado, setStockBajoAlertado] = useState(false)

  const {
    data: productos,
    isLoading,
    error,
  } = useQuery<Producto[]>({
    queryKey: ["productos"],
    queryFn: async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("productos")
          .select(`
            id, nombre, sku, stock, stock_min, costo_unit, precio_unit, categoria_id,
            categorias (nombre)
          `)
          .order("nombre")

        if (error) {
          throw new Error(error.message)
        }

        // Transformar los datos para incluir el nombre de la categoría
        return (data || []).map((producto) => ({
          ...producto,
          categoria_nombre: producto.categorias ? producto.categorias.nombre : null,
          categorias: undefined, // Eliminar el objeto anidado
        }))
      } catch (error: any) {
        console.error("Error al cargar productos:", error)
        return []
      }
    },
  })

  // Verificar si hay productos con stock bajo y mostrar alerta
  useEffect(() => {
    if (productos && !stockBajoAlertado) {
      const productosBajoStock = productos.filter((p) => p.stock_min > 0 && p.stock <= p.stock_min)

      if (productosBajoStock.length > 0) {
        toast({
          title: "Stock bajo",
          description: `Hay ${productosBajoStock.length} producto(s) con stock por debajo del mínimo.`,
          variant: "destructive",
        })
        setStockBajoAlertado(true)
      }
    }
  }, [productos, toast, stockBajoAlertado])

  const actualizarStock = async (productoId: string, incremento: number) => {
    if (isUpdating) return

    setIsUpdating(productoId)
    try {
      const supabase = createClient()

      // Primero obtenemos el stock actual y el costo unitario
      const { data: producto, error: errorConsulta } = await supabase
        .from("productos")
        .select("stock, costo_unit")
        .eq("id", productoId)
        .single()

      if (errorConsulta) {
        throw new Error(errorConsulta.message)
      }

      const nuevoStock = Math.max(0, (producto.stock || 0) + incremento)

      // Actualizar el stock del producto
      const { error: errorActualizacion } = await supabase
        .from("productos")
        .update({ stock: nuevoStock })
        .eq("id", productoId)

      if (errorActualizacion) {
        throw new Error(errorActualizacion.message)
      }

      // Si estamos incrementando el stock, registrar una nueva compra
      if (incremento > 0) {
        const costoUnitario = producto.costo_unit || 0

        try {
          // Verificar si la tabla compras existe
          const { count, error: errorVerificacion } = await supabase
            .from("compras")
            .select("*", { count: "exact", head: true })

          // Si hay un error específico de "relation does not exist", la tabla no existe
          if (
            errorVerificacion &&
            errorVerificacion.message.includes("relation") &&
            errorVerificacion.message.includes("does not exist")
          ) {
            console.warn("La tabla compras no existe. No se registrará la compra.")
          } else {
            // Registrar la compra solo si la tabla existe
            const { data: compra, error: errorCompra } = await supabase
              .from("compras")
              .insert({
                producto_id: productoId,
                costo_unit: costoUnitario,
                cantidad: incremento,
                restante: incremento,
              })
              .select()

            if (errorCompra) {
              console.error("Error al registrar la compra:", errorCompra)
            } else {
              // Registrar en historial de precios
              const { error: historyError } = await supabase.from("price_history").insert({
                producto_id: productoId,
                tipo: "costo",
                precio: costoUnitario,
                compra_id: compra ? compra[0].id : null,
              })

              if (historyError) {
                console.error("Error al registrar historial de precios:", historyError)
              }
            }
          }
        } catch (error) {
          console.error("Error al verificar la tabla compras:", error)
        }
      }

      // Actualizar la caché de React Query
      queryClient.invalidateQueries({ queryKey: ["productos"] })

      toast({
        title: "Stock actualizado",
        description: `El stock ha sido actualizado a ${nuevoStock} unidades.`,
      })
    } catch (error: any) {
      console.error("Error al actualizar stock:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el stock",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(null)
    }
  }

  // Función para determinar si un producto tiene stock crítico
  const tieneStockCritico = (producto: Producto) => {
    return producto.stock_min > 0 && producto.stock <= producto.stock_min
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="mr-4">
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
          <CompraConTarjetaDialog>
            <Button>
              <CreditCard className="mr-2 h-4 w-4" />
              Comprar con Tarjeta
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
            <CardDescription>Ocurrió un error al cargar el inventario. Por favor, intenta nuevamente.</CardDescription>
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
                  <TableRow key={producto.id} className={tieneStockCritico(producto) ? "bg-red-50 text-red-600" : ""}>
                    <TableCell className="font-medium">{producto.nombre}</TableCell>
                    <TableCell>
                      {producto.categoria_nombre ? <Badge variant="outline">{producto.categoria_nombre}</Badge> : "-"}
                    </TableCell>
                    <TableCell>{producto.sku || "-"}</TableCell>
                    <TableCell className="text-center">{producto.stock}</TableCell>
                    <TableCell className="text-center">{producto.stock_min}</TableCell>
                    <TableCell className="text-right">
                      {producto.costo_unit ? `$${producto.costo_unit.toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {producto.precio_unit ? `$${producto.precio_unit.toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => actualizarStock(producto.id, -1)}
                          disabled={isUpdating === producto.id || producto.stock <= 0}
                        >
                          <MinusCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => actualizarStock(producto.id, 1)}
                          disabled={isUpdating === producto.id}
                        >
                          <PlusCircle className="h-4 w-4" />
                        </Button>
                        <EditProductDialog producto={producto} />
                        <ProductPurchasesDialog productoId={producto.id} productoNombre={producto.nombre} />
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
  )
}
