"use client";

import { useMemo } from "react";
import { format, parseISO, startOfDay, isAfter } from "date-fns";
import { es } from "date-fns/locale";
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

// Asumiendo que tienes un tipo Pago similar a este
// Si no, ajusta según tu definición real
type Pago = {
  id: string;
  fecha: string; // Fecha original de la transacción
  monto: number;
  ciclo_cierre: string | null; // Fecha de cierre del ciclo (ISO o null)
  es_cuota?: boolean; // Opcional: para identificar cuotas
  // ... otras propiedades
};

interface PagosFuturosPorMesProps {
  pagos: Pago[]; // Recibe el array completo de pagos
}

// Función para formatear montos (puedes moverla a un archivo utils si la usas en más sitios)
function formatCurrencyARS(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount);
}

export default function PagosFuturosPorMes({ pagos }: PagosFuturosPorMesProps) {
  const pagosAgrupados = useMemo(() => {
    const hoy = startOfDay(new Date()); // Inicio del día de hoy
    const futuros = pagos.filter((pago) => {
      // Usar ciclo_cierre si existe y es válido, sino no incluir como futuro (o usar fecha como fallback?)
      // Por ahora, solo consideramos futuros si tienen ciclo_cierre válido
      if (!pago.ciclo_cierre) return false;

      try {
        const fechaCiclo = parseISO(pago.ciclo_cierre);
        // Filtra pagos cuyo ciclo de cierre sea hoy o posterior
        return isAfter(fechaCiclo, hoy) || format(fechaCiclo, 'yyyy-MM-dd') === format(hoy, 'yyyy-MM-dd');
      } catch (e) {
        console.warn(`Fecha de ciclo_cierre inválida en pago ${pago.id}: ${pago.ciclo_cierre}`);
        return false;
      }
    });

    const agrupados = new Map<string, number>(); // Clave: yyyy-MM, Valor: total

    futuros.forEach((pago) => {
      // Sabemos que ciclo_cierre existe por el filtro anterior
      try {
        const fechaCiclo = parseISO(pago.ciclo_cierre!);
        const mesKey = format(fechaCiclo, "yyyy-MM");
        const totalActual = agrupados.get(mesKey) || 0;
        agrupados.set(mesKey, totalActual + pago.monto);
      } catch (e) {
         // Ya advertido en el filtro
      }
    });

    // Convertir a array, ordenar y formatear
    return Array.from(agrupados.entries())
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // Ordenar por yyyy-MM
      .map(([mesKey, total]) => ({
        mes: format(parseISO(mesKey + "-01"), "MMM yy", { locale: es }), // Formato "Abr 25"
        total,
      }));
  }, [pagos]); // Recalcular solo si la lista de pagos cambia

  return (
    <Card className="rounded-2xl shadow-sm mb-8">
      <CardHeader>
        <CardTitle>Pagos Futuros por Mes</CardTitle>
        <CardDescription>
          Suma de los montos de pagos programados para los próximos meses.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pagosAgrupados.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Total a pagar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagosAgrupados.map((item) => (
                <TableRow key={item.mes}>
                  <TableCell className="font-medium">{item.mes}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrencyARS(item.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No hay pagos futuros registrados.
          </div>
        )}
      </CardContent>
    </Card>
  );
} 