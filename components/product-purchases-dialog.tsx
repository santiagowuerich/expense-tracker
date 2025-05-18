"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Eye, PackageSearch, ShoppingCart, TrendingUp, History } from "lucide-react"
import { createClient } from "@/lib/supabase-browser"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import PaymentDetailsDialog from "./payment-details-dialog"
import type React from "react"
import { useMovimientosStockQuery } from "@/lib/queries"
import type { MovimientoStock, ProductoInventario } from "@/types/inventario.types"

type ProductPurchase = {
  id: string
  created_at: string
  costo_unit: number
  cantidad: number
  restante: number
}

type PriceHistory = {
  id: string
  tipo: string
  precio: number
  created_at: string
  compra_id: string | null
}

interface ProductInfo extends ProductoInventario {
  // Puedes añadir más campos específicos si es necesario
}

interface ProductPurchasesDialogProps {
  productoId: string
  productoNombre: string
  children?: React.ReactNode
}

const formatTipoMovimiento = (tipo: MovimientoStock['tipo_movimiento']): string => {
  const map: Record<MovimientoStock['tipo_movimiento'], string> = {
    stock_inicial: "Stock Inicial",
    entrada_compra: "Entrada por Compra",
    salida_venta: "Salida por Venta",
    ajuste_manual_positivo: "Ajuste Manual (+)",
    ajuste_manual_negativo: "Ajuste Manual (-)",
    devolucion_cliente: "Devolución de Cliente",
    perdida_rotura: "Pérdida/Rotura",
  };
  return map[tipo] || tipo;
};

export default function ProductPurchasesDialog({ productoId, productoNombre, children }: ProductPurchasesDialogProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()

  const {
    data: compras,
    isLoading: isLoadingCompras,
    error: errorCompras,
    refetch: refetchCompras,
  } = useQuery<ProductPurchase[]>({
    queryKey: ["compras", productoId],
    queryFn: async (): Promise<ProductPurchase[]> => {
      try {
        const supabase = createClient()

        // Verificar si la tabla compras existe
        try {
          const { count, error: errorVerificacion } = await supabase
            .from("compras")
            .select("*", { count: "exact", head: true })

          // Si hay un error específico de "relation does not exist", la tabla no existe
          if (
            errorVerificacion &&
            errorVerificacion.message.includes("relation") &&
            errorVerificacion.message.includes("does not exist")
          ) {
            console.warn("La tabla compras no existe.")
            return []
          }
        } catch (error) {
          console.error("Error al verificar la tabla compras:", error)
          return []
        }

        const { data, error } = await supabase
          .from("compras")
          .select("id, created_at, costo_unit, cantidad, restante")
          .eq("producto_id", productoId)
          .order("created_at", { ascending: false })

        if (error) {
          throw new Error(error.message)
        }

        // Mapear explícitamente para asegurar el tipo
        const typedData: ProductPurchase[] = (data || []).map(item => ({
            id: String(item.id),
            created_at: String(item.created_at),
            costo_unit: Number(item.costo_unit),
            cantidad: Number(item.cantidad),
            restante: Number(item.restante)
        }));
        return typedData;

      } catch (error: any) {
        console.error("Error al cargar compras:", error)
        return []
      }
    },
    enabled: open,
  })

  const {
    data: historialPrecios,
    isLoading: isLoadingHistorial,
    error: errorHistorial,
    refetch: refetchHistorial,
  } = useQuery<PriceHistory[]>({
    queryKey: ["price-history", productoId],
    queryFn: async (): Promise<PriceHistory[]> => {
      try {
        const supabase = createClient()

        // Verificar si la tabla price_history existe
        try {
          const { count, error: errorVerificacion } = await supabase
            .from("price_history")
            .select("*", { count: "exact", head: true })

          // Si hay un error específico de "relation does not exist", la tabla no existe
          if (
            errorVerificacion &&
            errorVerificacion.message.includes("relation") &&
            errorVerificacion.message.includes("does not exist")
          ) {
            console.warn("La tabla price_history no existe.")
            return []
          }
        } catch (error) {
          console.error("Error al verificar la tabla price_history:", error)
          return []
        }

        const { data, error } = await supabase
          .from("price_history")
          .select("id, tipo, precio, created_at, compra_id")
          .eq("producto_id", productoId)
          .order("created_at", { ascending: false })

        if (error) {
          throw new Error(error.message)
        }

        // Mapear explícitamente para asegurar el tipo
        const typedData: PriceHistory[] = (data || []).map(item => ({
            id: String(item.id),
            tipo: String(item.tipo),
            precio: Number(item.precio),
            created_at: String(item.created_at),
            compra_id: item.compra_id ? String(item.compra_id) : null
        }));
        return typedData;

      } catch (error: any) {
        console.error("Error al cargar historial de precios:", error)
        return []
      }
    },
    enabled: open,
  })

  const {
    data: movimientosStock,
    isLoading: isLoadingMovimientosStock,
    error: errorMovimientosStock,
    refetch: refetchMovimientosStock,
  } = useMovimientosStockQuery(productoId, open)

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen)
        if (newOpen) {
          refetchCompras()
          refetchHistorial()
          refetchMovimientosStock()
        }
      }}
    >
      <DialogTrigger asChild>
        {children ? children : (
          <Button variant="ghost" size="icon" title={`Detalles de ${productoNombre}`}>
            <Eye className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] md:max-w-[900px] lg:max-w-[1000px]">
        <DialogHeader>
          <DialogTitle>Detalles de {productoNombre}</DialogTitle>
          <DialogDescription>Historial de compras, precios y movimientos de stock del producto.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="compras" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="compras"><ShoppingCart className="mr-2 h-4 w-4 inline-block" />Historial de Compras</TabsTrigger>
            <TabsTrigger value="precios"><TrendingUp className="mr-2 h-4 w-4 inline-block" />Historial de Precios</TabsTrigger>
            <TabsTrigger value="stock"><History className="mr-2 h-4 w-4 inline-block" />Historial de Stock</TabsTrigger>
          </TabsList>

          <TabsContent value="compras" className="max-h-[60vh] overflow-y-auto">
            {isLoadingCompras ? (
              <div className="space-y-2 py-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : errorCompras ? (
              <div className="text-center py-8 text-destructive">Error al cargar las compras.</div>
            ) : compras && compras.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Costo unitario</TableHead>
                    <TableHead className="text-right">Cantidad inicial</TableHead>
                    <TableHead className="text-right">Restante</TableHead>
                    <TableHead className="text-right">Total compra</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compras.map((compra: ProductPurchase) => (
                    <TableRow key={compra.id}>
                      <TableCell>{format(parseISO(compra.created_at), "d MMM yyyy, HH:mm", { locale: es })}</TableCell>
                      <TableCell className="text-right">${compra.costo_unit.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{compra.cantidad}</TableCell>
                      <TableCell className="text-right">{compra.restante}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${(compra.cantidad * compra.costo_unit).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center space-x-2">
                          <PaymentDetailsDialog compraId={compra.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Sin compras registradas para este producto.</div>
            )}
          </TabsContent>

          <TabsContent value="precios" className="max-h-[60vh] overflow-y-auto">
            {isLoadingHistorial ? (
              <div className="space-y-2 py-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : errorHistorial ? (
              <div className="text-center py-8 text-destructive">Error al cargar el historial de precios.</div>
            ) : historialPrecios && historialPrecios.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead>Referencia Compra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historialPrecios.map((precio: PriceHistory) => (
                    <TableRow key={precio.id}>
                      <TableCell>{format(parseISO(precio.created_at), "d MMM yyyy, HH:mm", { locale: es })}</TableCell>
                      <TableCell>
                        <Badge variant={precio.tipo === "venta" ? "default" : "secondary"}>
                          {precio.tipo === "venta" ? "Precio Venta" : "Precio Costo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">${precio.precio.toFixed(2)}</TableCell>
                      <TableCell>
                        {precio.compra_id ? (
                          <PaymentDetailsDialog compraId={precio.compra_id} />
                        ) : (
                          <span className="text-muted-foreground text-sm">N/A</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Sin historial de precios para este producto.</div>
            )}
          </TabsContent>

          <TabsContent value="stock" className="max-h-[60vh] overflow-y-auto">
            {isLoadingMovimientosStock ? (
              <div className="space-y-2 py-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : errorMovimientosStock ? (
              <div className="text-center py-8 text-destructive">Error al cargar el historial de stock.</div>
            ) : movimientosStock && movimientosStock.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo Movimiento</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Stock Anterior</TableHead>
                    <TableHead className="text-right">Stock Nuevo</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Ref. ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientosStock.map((mov: MovimientoStock & { usuario_email?: string | null }) => (
                    <TableRow key={mov.id}>
                      <TableCell>{format(parseISO(mov.fecha), "d MMM yyyy, HH:mm", { locale: es })}</TableCell>
                      <TableCell>{formatTipoMovimiento(mov.tipo_movimiento)}</TableCell>
                      <TableCell className={`text-right font-medium ${mov.cantidad > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {mov.cantidad > 0 ? `+${mov.cantidad}` : mov.cantidad}
                      </TableCell>
                      <TableCell className="text-right">{mov.stock_anterior}</TableCell>
                      <TableCell className="text-right">{mov.stock_nuevo}</TableCell>
                      <TableCell className="max-w-[150px] truncate" title={mov.notas || undefined}>{mov.notas || "-"}</TableCell>
                      <TableCell className="max-w-[150px] truncate" title={mov.usuario_email || undefined}>{mov.usuario_email || "Sistema"}</TableCell>
                      <TableCell>{mov.referencia_id || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Sin movimientos de stock para este producto.</div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
