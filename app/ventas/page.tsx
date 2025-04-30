"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { useVentas } from "@/hooks/useVentas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";

export default function HistorialVentasPage() {
  const router = useRouter();
  const { data: ventas, isLoading, error } = useVentas();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: es });
    } catch {
      return "Fecha inválida";
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="mr-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <h1 className="text-3xl font-bold text-primary">Historial de Ventas</h1>
        </div>
        {/* Podrías agregar aquí un botón para realizar una nueva venta si es necesario */}
      </div>

      {isLoading ? (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>
              Ocurrió un error al cargar el historial de ventas: {error.message}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : !ventas || ventas.length === 0 ? (
        <EmptyState
          title="Sin ventas registradas"
          description="Aún no se ha realizado ninguna venta."
        />
      ) : (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Ventas Registradas</CardTitle>
            <CardDescription>Listado de todas las ventas realizadas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Total Venta</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventas.map((venta) => (
                  <TableRow key={venta.id}>
                    <TableCell>{formatDate(venta.fecha)}</TableCell>
                    <TableCell className="font-medium">{venta.cliente?.nombre || "N/A"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(venta.total)}</TableCell>
                    <TableCell className="text-center">
                      <Button asChild variant="link" size="sm">
                        <Link href={`/ventas/${venta.id}`}>Ver detalle</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 