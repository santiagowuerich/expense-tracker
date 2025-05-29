"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useVentasPorCliente } from "@/hooks/useVentas";
import { Cliente } from "@/types/venta";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ExternalLink } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

interface ClienteVentasDialogProps {
  cliente: Cliente;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ClienteVentasDialog({ cliente, open, onOpenChange }: ClienteVentasDialogProps) {
  const { data: ventas, isLoading, error } = useVentasPorCliente(cliente?.id || null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "d MMM yyyy, HH:mm", { locale: es });
    } catch {
      return "Fecha inválida";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Compras asociadas al DNI/CUIT: {cliente?.dni_cuit}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-grow pr-4 -mr-4">
          {isLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
              <p>Error al cargar las compras: {error instanceof Error ? error.message : String(error)}</p>
            </div>
          ) : !ventas || ventas.length === 0 ? (
            <EmptyState
              title="Sin compras registradas"
              description="Este cliente no tiene compras asociadas."
            />
          ) : (
            <div className="space-y-4 py-2">
              {ventas.map((venta) => (
                <Card key={venta.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-base font-medium leading-tight">{formatDate(venta.fecha)}</span>
                      <span className="text-lg font-semibold whitespace-nowrap pl-2">{formatCurrency(venta.total)}</span>
                    </div>
                    
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                    >
                      <Link href={`/ventas/${venta.id}`} className="flex items-center justify-center">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Ver detalle
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
} 