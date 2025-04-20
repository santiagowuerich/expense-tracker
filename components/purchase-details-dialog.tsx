"use client"

import type React from "react"

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
import { Skeleton } from "@/components/ui/skeleton"
import { Package, CreditCard } from "lucide-react"
import { createClient } from "@/lib/supabase-browser"
import { useToast } from "@/components/ui/use-toast"
import PaymentDetailsDialog from "./payment-details-dialog"

type PurchaseDetails = {
  id: string
  created_at: string
  costo_unit: number
  cantidad: number
  restante: number
}

interface PurchaseDetailsDialogProps {
  compraId: string
  children?: React.ReactNode
  trigger?: React.ReactNode
}

export default function PurchaseDetailsDialog({ compraId, children, trigger }: PurchaseDetailsDialogProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()

  const {
    data: purchase,
    isLoading,
    error,
    refetch,
  } = useQuery<PurchaseDetails>({
    queryKey: ["purchase-details", compraId],
    queryFn: async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("compras")
          .select("id, created_at, costo_unit, cantidad, restante")
          .eq("id", compraId)
          .single()

        if (error) {
          throw new Error(error.message)
        }

        return data
      } catch (error: any) {
        console.error("Error al cargar detalles de compra:", error)
        throw error
      }
    },
    enabled: open, // Solo ejecutar la consulta cuando el diálogo está abierto
  })

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen) {
      refetch()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || children || (
          <Button variant="ghost" size="icon" title="Ver compra">
            <Package className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Detalles de la compra</DialogTitle>
          <DialogDescription>Información detallada de la compra.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : error ? (
          <div className="text-center py-4 text-destructive">Error al cargar los detalles de la compra.</div>
        ) : purchase ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="font-medium">Fecha:</div>
              <div className="col-span-2">{format(parseISO(purchase.created_at), "PPP", { locale: es })}</div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="font-medium">Costo unitario:</div>
              <div className="col-span-2">${purchase.costo_unit.toFixed(2)}</div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="font-medium">Cantidad inicial:</div>
              <div className="col-span-2">{purchase.cantidad}</div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="font-medium">Restante:</div>
              <div className="col-span-2">{purchase.restante}</div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="font-medium">Total compra:</div>
              <div className="col-span-2 font-semibold">${(purchase.cantidad * purchase.costo_unit).toFixed(2)}</div>
            </div>

            <div className="flex justify-end pt-4">
              <PaymentDetailsDialog compraId={compraId}>
                <Button variant="outline" size="sm">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Ver gasto
                </Button>
              </PaymentDetailsDialog>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">No se encontraron detalles de la compra.</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
