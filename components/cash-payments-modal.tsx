"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase-browser" // Asegúrate que la ruta es correcta
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { es } from "date-fns/locale"

// Función para obtener los pagos (la moveremos a supabase-queries.ts más tarde si es necesario)
async function getCashPaymentsForMonth(year: number, month: number): Promise<CashPayment[]> {
  const supabase = createClient()
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 1) // El primer día del mes siguiente

  const { data, error } = await supabase
    .from("pagos")
    .select(`
      id,
      fecha,
      monto,
      descripcion,
      payment_method,
      productos ( nombre ) // Intentar obtener nombre del producto
    `)
    .in("payment_method", ["efectivo", "transferencia"])
    .gte("fecha", startDate.toISOString())
    .lt("fecha", endDate.toISOString())
    .order("fecha", { ascending: false })

  if (error) {
    console.error("Error fetching cash payments:", error)
    // Devolver array vacío en caso de error para evitar problemas de tipo
    return [];
    // Opcional: podrías lanzar el error si prefieres manejarlo en useQuery
    // throw new Error("Error al obtener los pagos en efectivo/transferencia");
  }

  // Asegurarse que data sea un array y procesarlo
  if (!Array.isArray(data)) {
      console.warn("La respuesta de Supabase no fue un array:", data);
      return [];
  }

  return data.map((item: any) => ({
    id: item.id,
    fecha: item.fecha,
    monto: item.monto,
    descripcion: item.descripcion,
    payment_method: item.payment_method,
    // Simplificado: Acceder a productos.nombre si existe, sino null
    producto_nombre: item.productos?.nombre ?? null,
  }));
}

interface CashPayment {
  id: string;
  fecha: string;
  monto: number;
  descripcion: string | null;
  payment_method: string;
  producto_nombre: string | null; // Nombre del producto
}

export default function CashPaymentsModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1 // Mes actual (1-12)
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth)

  const years = useMemo(() => {
    const startYear = 2020 // O el año más antiguo de tus datos
    return Array.from({ length: currentYear - startYear + 1 }, (_, i) => currentYear - i)
  }, [currentYear])

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: format(new Date(0, i), "MMMM", { locale: es }), // Nombre del mes en español
    }))
  }, [])

  const { data: payments = [], isLoading, error, refetch } = useQuery<CashPayment[]>({
    queryKey: ["cashPayments", selectedYear, selectedMonth],
    queryFn: () => getCashPaymentsForMonth(selectedYear, selectedMonth),
    enabled: open, // Solo ejecutar la consulta cuando el modal está abierto
  })

  // Refrescar datos cuando cambie el mes o año
  useEffect(() => {
    if (open) {
      refetch()
    }
  }, [selectedYear, selectedMonth, open, refetch])

  const totalMes = useMemo(() => {
      return payments.reduce((sum, pago: CashPayment) => sum + pago.monto, 0);
  }, [payments]);


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pagos en Efectivo / Transferencia</DialogTitle>
          <DialogDescription>
            Consulta los pagos realizados en efectivo o transferencia para el mes seleccionado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 mb-4">
          {/* Selector de Año */}
          <Select
             value={selectedYear.toString()}
             onValueChange={(value) => setSelectedYear(parseInt(value))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Selector de Mes */}
          <Select
            value={selectedMonth.toString()}
            onValueChange={(value) => setSelectedMonth(parseInt(value))}
          >
             <SelectTrigger className="w-[180px]">
               <SelectValue placeholder="Mes" />
             </SelectTrigger>
             <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value.toString()}>
                  {month.label.charAt(0).toUpperCase() + month.label.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-grow overflow-y-auto">
          {isLoading && <p>Cargando pagos...</p>}
          {error && <p className="text-red-500">Error al cargar los pagos.</p>}
          {!isLoading && !error && payments.length === 0 && <p>No hay pagos para el mes seleccionado.</p>}
          {!isLoading && !error && payments.length > 0 && (
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Fecha</TableHead>
                   <TableHead>Descripción</TableHead>
                   <TableHead>Producto</TableHead>
                   <TableHead>Método</TableHead>
                   <TableHead className="text-right">Monto</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                {payments.map((pago: CashPayment) => (
                  <TableRow key={pago.id}>
                    <TableCell>{format(new Date(pago.fecha), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{pago.descripcion || "-"}</TableCell>
                    <TableCell>{pago.producto_nombre || "-"}</TableCell>
                    <TableCell>{pago.payment_method.charAt(0).toUpperCase() + pago.payment_method.slice(1)}</TableCell>
                    <TableCell className="text-right">${pago.monto.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
               </TableBody>
             </Table>
          )}
        </div>
         <DialogFooter className="mt-4 pt-4 border-t">
            <div className="flex justify-between w-full items-center">
                 <span className="text-lg font-semibold">Total del Mes:</span>
                 <span className="text-lg font-semibold">${totalMes.toFixed(2)}</span>
            </div>
          {/* Puedes añadir botones si necesitas acciones */}
          {/* <Button onClick={() => setOpen(false)}>Cerrar</Button> */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 