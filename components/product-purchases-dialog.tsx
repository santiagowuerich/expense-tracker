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
import { Eye } from "lucide-react"
import { createClient } from "@/lib/supabase-browser"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import PaymentDetailsDialog from "./payment-details-dialog"
import PurchaseDetailsDialog from "./purchase-details-dialog"

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

interface ProductPurchasesDialogProps {
  productoId: string
  productoNombre: string
}

export default function ProductPurchasesDialog({ productoId, productoNombre }: ProductPurchasesDialogProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()

  const {
    data: compras,
    isLoading: isLoadingCompras,
    error: errorCompras,
    refetch: refetchCompras,
  } = useQuery<ProductPurchase[]>({
    queryKey: ["compras", productoId],
    queryFn: async () => {
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

        return data || []
      } catch (error: any) {
        console.error("Error al cargar compras:", error)
        return []
      }
    },
    enabled: open, // Solo ejecutar la consulta cuando el diálogo está abierto
  })

  const {
    data: historialPrecios,
    isLoading: isLoadingHistorial,
    error: errorHistorial,
    refetch: refetchHistorial,
  } = useQuery<PriceHistory[]>({
    queryKey: ["price-history", productoId],
    queryFn: async () => {
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

        return data || []
      } catch (error: any) {
        console.error("Error al cargar historial de precios:", error)
        return []
      }
    },
    enabled: open, // Solo ejecutar la consulta cuando el diálogo está abierto
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen)
        if (newOpen) {
          refetchCompras() // Refrescar las compras cuando se abre el diálogo
          refetchHistorial() // Refrescar el historial de precios
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Detalles de {productoNombre}</DialogTitle>
          <DialogDescription>Historial de compras y precios del producto.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="compras">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="compras">Historial de Compras</TabsTrigger>
            <TabsTrigger value="precios">Historial de Precios</TabsTrigger>
          </TabsList>

          <TabsContent value="compras">
            {isLoadingCompras ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : errorCompras ? (
              <div className="text-center py-4 text-destructive">Error al cargar las compras.</div>
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
                  {compras.map((compra) => (
                    <TableRow key={compra.id}>
                      <TableCell>{format(parseISO(compra.created_at), "d MMM yyyy", { locale: es })}</TableCell>
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
              <div className="text-center py-8 text-muted-foreground">Sin compras registradas.</div>
            )}
          </TabsContent>

          <TabsContent value="precios">
            {isLoadingHistorial ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : errorHistorial ? (
              <div className="text-center py-4 text-destructive">Error al cargar el historial de precios.</div>
            ) : historialPrecios && historialPrecios.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historialPrecios.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{format(parseISO(item.created_at), "d MMM yyyy", { locale: es })}</TableCell>
                      <TableCell>
                        <Badge variant={item.tipo === "costo" ? "outline" : "secondary"}>
                          {item.tipo === "costo" ? "Costo" : "Venta"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">${item.precio.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center space-x-2">
                          {item.compra_id ? (
                            <PurchaseDetailsDialog compraId={item.compra_id} />
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Sin historial de precios registrado.</div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
