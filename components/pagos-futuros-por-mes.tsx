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
  pago_original_id?: string | null;
  cuota_actual?: number;
  cuotas?: number;
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
    fecha: string; // Fecha de compra original
    cuota_actual?: number;
    cuotas?: number;
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
            monto: pago.monto,
            fecha: pago.fecha,
            cuota_actual: pago.cuota_actual,
            cuotas: pago.cuotas
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
    <Card className="rounded-lg shadow-sm mb-10">
      <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
        <CardTitle className="text-base sm:text-lg">Pagos Futuros por Ciclo</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Pagos agrupados por mes de cierre y tarjeta.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 sm:px-2 pb-4">
        {pagosAgrupados.length > 0 ? (
          <Accordion type="multiple" className="w-full">
            {pagosAgrupados.map((item) => (
              <AccordionItem value={item.mesKey} key={item.mesKey} className="border-b last:border-b-0">
                <AccordionTrigger className="hover:no-underline px-4 py-4 sm:px-6 group">
                  <div className="flex justify-between items-center w-full">
                    <span className="font-medium capitalize text-sm sm:text-base group-hover:text-primary transition-colors">{item.mesLabel}</span>
                    <div className="flex items-center">
                      <span className="font-semibold text-sm sm:text-base mr-2">{formatCurrencyARS(item.totalMes)}</span>
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180 flex-shrink-0" />
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4 px-4 sm:px-6 bg-muted/20">
                  {item.desglosePorTarjeta.length > 0 ? (
                    <div className="space-y-3">
                      {item.desglosePorTarjeta.map((detalle) => (
                        <div key={detalle.tarjetaId}>
                          <Collapsible className="border rounded-md bg-card shadow-sm overflow-hidden">
                            <CollapsibleTrigger className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full text-sm px-4 py-3 text-left group">
                              <span className="font-medium truncate group-hover:text-primary transition-colors">{detalle.alias || 'Desconocida'}</span>
                              <div className="flex items-center w-full sm:w-auto justify-end mt-1 sm:mt-0">
                                  <span className="font-semibold mr-2">{formatCurrencyARS(detalle.totalTarjeta)}</span>
                                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180 flex-shrink-0" />
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-0 px-4 pt-3 pb-4 border-t border-border/50 bg-muted/30">
                              {detalle.pagosDelMes.length > 0 ? (
                                  <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
                                      {detalle.pagosDelMes.map(pago => (
                                          <li key={pago.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center border rounded-md p-3 bg-background shadow-sm">
                                              <div className="flex-1 pr-2 mb-1 sm:mb-0">
                                                  <div className="whitespace-normal break-words leading-tight font-medium text-foreground" title={pago.descripcion}>{pago.descripcion}</div>
                                                  <div className="text-[0.7rem] sm:text-xs text-muted-foreground/80 mt-0.5">
                                                      {pago.fecha && format(parseISO(pago.fecha), "dd/MM/yy")}
                                                      {pago.cuota_actual && pago.cuotas && pago.cuota_actual > 0 &&
                                                       ` • Cuota ${pago.cuota_actual}/${pago.cuotas}`}
                                                  </div>
                                              </div>
                                              <span className="font-mono whitespace-nowrap text-xs sm:text-sm self-end sm:self-center text-foreground font-semibold">{formatCurrencyARS(pago.monto)}</span>
                                          </li>
                                      ))}
                                  </ul>
                              ) : (
                                  <p className="text-xs sm:text-sm text-muted-foreground italic py-1">No hay detalle de pagos.</p>
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground px-4 py-2">No hay desglose por tarjeta.</p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="text-center py-8 text-muted-foreground px-4">
            No hay pagos futuros registrados.
          </div>
        )}
      </CardContent>
    </Card>
  );
} 