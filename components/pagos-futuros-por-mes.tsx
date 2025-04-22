"use client";

import { useMemo, useState } from "react";
import { format, parseISO, startOfDay, isAfter } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { cn } from "@/lib/utils";

// Tipo Pago actualizado
type Pago = {
  id: string;
  fecha: string;
  monto: number;
  descripcion: string;
  ciclo_cierre: string | null;
  es_cuota?: boolean;
  tarjeta_id: string;
  tarjeta_alias?: string | null;
};

interface PagosFuturosPorMesProps {
  pagos: Pago[];
}

function formatCurrencyARS(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount);
}

// Tipo para un pago individual dentro del desglose
interface PagoIndividual {
    id: string;
    descripcion: string;
    monto: number;
}

// Estructura DetalleTarjeta actualizada
interface DetalleTarjeta {
  tarjetaId: string;
  alias: string | null;
  totalTarjeta: number;
  pagosDelMes: PagoIndividual[];
}

interface MesAgrupado {
  mesKey: string;
  mesLabel: string;
  totalMes: number;
  desglosePorTarjeta: DetalleTarjeta[];
}

export default function PagosFuturosPorMes({ pagos }: PagosFuturosPorMesProps) {
  const pagosAgrupados = useMemo(() => {
    const hoy = startOfDay(new Date());
    const futuros = pagos.filter((pago) => {
      if (!pago.ciclo_cierre) return false;
      try {
        const fechaCiclo = parseISO(pago.ciclo_cierre);
        return isAfter(fechaCiclo, hoy) || format(fechaCiclo, 'yyyy-MM-dd') === format(hoy, 'yyyy-MM-dd');
      } catch (e) {
        console.warn(`Fecha de ciclo_cierre inválida en pago ${pago.id}: ${pago.ciclo_cierre}`);
        return false;
      }
    });

    // Mapa actualizado: mesKey -> { totalMes, desglose: Map<tarjetaId, DetalleTarjeta> }
    const agrupados = new Map<string, { totalMes: number; desglose: Map<string, DetalleTarjeta> }>();

    futuros.forEach((pago) => {
      if (!pago.tarjeta_id || !pago.ciclo_cierre) return;
      try {
        const fechaCiclo = parseISO(pago.ciclo_cierre);
        const mesKey = format(fechaCiclo, "yyyy-MM");

        if (!agrupados.has(mesKey)) {
          agrupados.set(mesKey, { totalMes: 0, desglose: new Map() });
        }

        const mesData = agrupados.get(mesKey)!;
        mesData.totalMes += pago.monto;

        const tarjetaId = pago.tarjeta_id;
        const aliasTarjeta = pago.tarjeta_alias ?? 'Tarjeta sin nombre';

        if (!mesData.desglose.has(tarjetaId)) {
          // Inicializar con array vacío para pagosDelMes
          mesData.desglose.set(tarjetaId, { tarjetaId, alias: aliasTarjeta, totalTarjeta: 0, pagosDelMes: [] });
        }

        const tarjetaData = mesData.desglose.get(tarjetaId)!;
        tarjetaData.totalTarjeta += pago.monto;
        // Añadir el pago individual al array
        tarjetaData.pagosDelMes.push({
            id: pago.id,
            descripcion: pago.descripcion,
            monto: pago.monto
        });

      } catch (e) {
        // Error ya manejado
      }
    });

    // Convertir a array, ordenar por mes y formatear
    return Array.from(agrupados.entries())
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([mesKey, data]) => ({
        mesKey,
        mesLabel: format(parseISO(mesKey + "-01"), "MMMM yyyy", { locale: es }),
        totalMes: data.totalMes,
        // Convertir Map de desglose a array (ya no necesita ordenarse aquí)
        desglosePorTarjeta: Array.from(data.desglose.values()),
      }));
  }, [pagos]);

  return (
    <Card className="rounded-2xl shadow-sm mb-8">
      <CardHeader>
        <CardTitle>Pagos Futuros por Ciclo de Cierre</CardTitle>
        <CardDescription>
          Pagos agrupados por mes de cierre y tarjeta, con detalle de compras.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pagosAgrupados.length > 0 ? (
          <Accordion type="multiple" className="w-full">
            {pagosAgrupados.map((item) => (
              <AccordionItem value={item.mesKey} key={item.mesKey}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex justify-between w-full pr-4">
                    <span className="font-medium capitalize">{item.mesLabel}</span>
                    <span className="font-semibold">{formatCurrencyARS(item.totalMes)}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-0 pl-4 pr-2">
                  {item.desglosePorTarjeta.length > 0 ? (
                    <div className="space-y-2">
                      {item.desglosePorTarjeta.map((detalle) => (
                        <Collapsible key={detalle.tarjetaId} className="border rounded-md px-3 py-2 bg-muted/30">
                          <CollapsibleTrigger className="flex justify-between items-center w-full text-sm">
                              <span className="font-medium">{detalle.alias || 'Desconocida'}</span>
                              <div className="flex items-center">
                                  <span className="font-semibold mr-2">{formatCurrencyARS(detalle.totalTarjeta)}</span>
                                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-[data-state=open]:rotate-180" />
                              </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2 pl-2 border-l-2 border-primary/20">
                            {detalle.pagosDelMes.length > 0 ? (
                                <ul className="space-y-1 text-xs text-muted-foreground">
                                    {detalle.pagosDelMes.map(pago => (
                                        <li key={pago.id} className="flex justify-between items-center">
                                            <span className="truncate pr-2" title={pago.descripcion}>{pago.descripcion}</span>
                                            <span className="font-mono whitespace-nowrap">{formatCurrencyARS(pago.monto)}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-xs text-muted-foreground italic py-1">No hay detalle de pagos para esta tarjeta en este mes.</p>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground px-4 py-2">No hay desglose por tarjeta disponible para este mes.</p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No hay pagos futuros registrados.
          </div>
        )}
      </CardContent>
    </Card>
  );
} 