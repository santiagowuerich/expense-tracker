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
import { CreditCard } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

type PaymentDetails = {
  id: string
  monto: number
  fecha: string
  descripcion: string
  tarjeta_id: string
  tarjeta_alias: string
}

interface PaymentDetailsDialogProps {
  compraId: string
  children?: React.ReactNode
  trigger?: React.ReactNode
}

export default function PaymentDetailsDialog({ compraId, children, trigger }: PaymentDetailsDialogProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()

  const {
    data: payment,
    isLoading,
    error,
    refetch,
  } = useQuery<PaymentDetails>({
    queryKey: ["payment-by-purchase", compraId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/payment-by-purchase?id=${compraId}`)

        if (response.status === 404) {
          throw new Error("Este registro aún no tiene gasto asociado")
        }

        if (!response.ok) {
          throw new Error("Error al obtener el pago")
        }

        return await response.json()
      } catch (error: any) {
        throw error
      }
    },
    enabled: open, // Solo ejecutar la consulta cuando el diálogo está abierto
    retry: false, // No reintentar en caso de error 404
  })

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen) {
      refetch()
    }
  }

  const handleClick = async () => {
    try {
      await refetch()
      setOpen(true)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo obtener la información del pago",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild onClick={handleClick}>
        {trigger || children || (
          <Button variant="ghost" size="icon" title="Ver gasto">
            <CreditCard className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Detalles del pago</DialogTitle>
          <DialogDescription>Información del pago asociado a esta compra.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : error ? (
          <div className="text-center py-4 text-destructive">
            {error instanceof Error ? error.message : "Error al cargar los datos del pago."}
          </div>
        ) : payment ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="font-medium">Tarjeta:</div>
              <div className="col-span-2">{payment.tarjeta_alias}</div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="font-medium">Fecha:</div>
              <div className="col-span-2">{format(parseISO(payment.fecha), "PPP", { locale: es })}</div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="font-medium">Monto:</div>
              <div className="col-span-2 font-semibold">${payment.monto.toFixed(2)}</div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="font-medium">Descripción:</div>
              <div className="col-span-2">{payment.descripcion}</div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">No se encontró información del pago.</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
