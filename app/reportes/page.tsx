"use client"

import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase-browser"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

type ReporteData = {
  valorTotal: number
  productosSinStock: {
    id: string
    nombre: string
    costo_unit: number | null
  }[]
  stockCritico: {
    id: string
    nombre: string
    stock: number
    stock_min: number
  }[]
  historialPrecios: {
    id: string
    producto_nombre: string
    tipo: string
    precio: number
    created_at: string
  }[]
}

export default function ReportesPage() {
  const router = useRouter()

  const { data, isLoading, error } = useQuery<ReporteData>({
    queryKey: ["reportes"],
    queryFn: async () => {
      try {
        const supabase = createClient()

        // Obtener valor total del inventario
        const { data: valorData, error: valorError } = await supabase.rpc("calcular_valor_inventario")

        if (valorError) {
          console.error("Error al calcular valor del inventario:", valorError)
          throw new Error(valorError.message)
        }

        // Obtener productos sin stock usando función
        const { data: sinStockData, error: sinStockError } = await supabase.rpc("get_sin_stock")

        if (sinStockError) {
          console.error("Error al obtener productos sin stock:", sinStockError)
          throw new Error(sinStockError.message)
        }

        // Obtener productos con stock crítico usando función
        const { data: criticoData, error: criticoError } = await supabase.rpc("get_stock_critico")

        if (criticoError) {
          console.error("Error al obtener productos con stock crítico:", criticoError)
          throw new Error(criticoError.message)
        }

        // Obtener historial de precios reciente
        const { data: historialData, error: historialError } = await supabase
          .from("price_history")
          .select(`
            id, tipo, precio, created_at,
            productos (nombre)
          `)
          .order("created_at", { ascending: false })
          .limit(5)

        if (historialError) {
          console.error("Error al obtener historial de precios:", historialError)
          throw new Error(historialError.message)
        }

        // Transformar los datos del historial
        const historialTransformado = historialData
          ? historialData.map((item) => ({
              id: item.id,
              producto_nombre: item.productos?.nombre || "Desconocido",
              tipo: item.tipo,
              precio: item.precio,
              created_at: item.created_at,
            }))
          : []

        return {
          valorTotal: valorData || 0,
          productosSinStock: sinStockData || [],
          stockCritico: criticoData || [],
          historialPrecios: historialTransformado || [],
        }
      } catch (error: any) {
        console.error("Error al obtener reportes:", error)
        throw error
      }
    },
  })

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center mb-8">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="mr-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold text-primary">Reportes de Inventario</h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[200px] w-full rounded-2xl" />
          <Skeleton className="h-[200px] w-full rounded-2xl" />
          <Skeleton className="h-[300px] w-full rounded-2xl" />
          <Skeleton className="h-[300px] w-full rounded-2xl" />
        </div>
      ) : error ? (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>Ocurrió un error al cargar los reportes. Por favor, intenta nuevamente.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Valor total del inventario */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Valor Total del Inventario</CardTitle>
              <CardDescription>Suma del valor de todos los productos en stock</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">${(data?.valorTotal || 0).toFixed(2)}</p>
            </CardContent>
          </Card>

          {/* Productos sin stock */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Productos Sin Stock</CardTitle>
              <CardDescription>Productos que necesitan reposición</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.productosSinStock && data.productosSinStock.length > 0 ? (
                <div className="max-h-[200px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Costo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.productosSinStock.map((producto) => (
                        <TableRow key={producto.id}>
                          <TableCell>{producto.nombre}</TableCell>
                          <TableCell className="text-right">
                            {producto.costo_unit ? `$${producto.costo_unit.toFixed(2)}` : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-4 text-muted-foreground">No hay productos sin stock.</p>
              )}
            </CardContent>
          </Card>

          {/* Stock crítico */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Stock Crítico</CardTitle>
              <CardDescription>Productos con nivel de stock por debajo del mínimo</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.stockCritico && data.stockCritico.length > 0 ? (
                <div className="max-h-[200px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Mínimo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.stockCritico.map((producto) => (
                        <TableRow key={producto.id}>
                          <TableCell>{producto.nombre}</TableCell>
                          <TableCell className="text-right">{producto.stock}</TableCell>
                          <TableCell className="text-right">{producto.stock_min}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-4 text-muted-foreground">No hay productos con stock crítico.</p>
              )}
            </CardContent>
          </Card>

          {/* Historial de precios */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Últimas Variaciones de Precio</CardTitle>
              <CardDescription>Cambios recientes en los precios de productos</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.historialPrecios && data.historialPrecios.length > 0 ? (
                <div className="max-h-[200px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.historialPrecios.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.producto_nombre}</TableCell>
                          <TableCell>
                            <Badge variant={item.tipo === "costo" ? "outline" : "secondary"}>
                              {item.tipo === "costo" ? "Costo" : "Venta"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">${item.precio.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            {format(parseISO(item.created_at), "d MMM yyyy", { locale: es })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-4 text-muted-foreground">No hay historial de precios reciente.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
