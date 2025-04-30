"use client";

import { useParams, useRouter } from "next/navigation";
import { useVentaDetalle } from "@/hooks/useVentas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { VentaItem as BaseVentaItem } from "@/types/venta";

interface VentaItemConNombre extends BaseVentaItem {
  producto_nombre?: string;
}

export default function DetalleVentaPage() {
  const router = useRouter();
  const params = useParams();
  const idVenta = params.idVenta as string;

  const { data: venta, isLoading, error } = useVentaDetalle(idVenta);

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

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 flex justify-center items-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5" /> Error al cargar la venta
            </CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={() => router.push('/ventas')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Historial
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!venta) {
    return (
      <div className="container mx-auto py-8 px-4">
         <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-muted-foreground">Venta no encontrada</CardTitle>
            <CardDescription>No se encontró la venta solicitada.</CardDescription>
          </CardHeader>
           <CardFooter>
            <Button variant="outline" onClick={() => router.push('/ventas')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Historial
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
       <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/ventas')} // Ir al historial
            className="mr-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Historial
          </Button>
          <h1 className="text-3xl font-bold text-primary">Detalle de Venta</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Datos Cliente y Pagos */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Card Datos Cliente */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Datos del Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p><strong>Nombre:</strong> {venta.cliente?.nombre}</p>
              <p><strong>DNI/CUIT:</strong> {venta.cliente?.dni_cuit}</p>
              {venta.cliente?.direccion && <p><strong>Dirección:</strong> {venta.cliente.direccion}</p>}
              {venta.cliente?.ciudad && <p><strong>Ciudad:</strong> {venta.cliente.ciudad}</p>}
              {venta.cliente?.codigo_postal && <p><strong>Cód. Postal:</strong> {venta.cliente.codigo_postal}</p>}
              {venta.cliente?.telefono && <p><strong>Teléfono:</strong> {venta.cliente.telefono}</p>}
              {venta.cliente?.email && <p><strong>Email:</strong> {venta.cliente.email}</p>}
            </CardContent>
          </Card>

          {/* Card Métodos de Pago (NUEVO) */}
          {venta.pagos && venta.pagos.length > 0 && (
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Métodos de Pago Utilizados</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {venta.pagos.map((pago, index) => (
                    <li key={index} className="flex justify-between items-center text-sm">
                      <span>{pago.metodo_pago}</span>
                      <span className="font-medium">{formatCurrency(pago.monto)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Columna Items y Total */}
        <div className="lg:col-span-2">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Productos Vendidos</CardTitle>
              <CardDescription>Fecha de venta: {formatDate(venta.fecha)}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Cantidad</TableHead>
                    <TableHead className="text-right">Precio Unit.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(venta?.items as VentaItemConNombre[] | undefined)?.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.producto_nombre || "Producto no encontrado"}</TableCell>
                      <TableCell className="text-center">{item.cantidad}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.precio_unitario)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.subtotal || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex justify-end pt-4 border-t">
              <div className="text-right">
                <p className="text-lg font-medium">Total Venta:</p>
                <p className="text-2xl font-bold">{formatCurrency(venta.total)}</p>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
} 