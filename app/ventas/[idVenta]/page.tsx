"use client";

import { useParams, useRouter } from "next/navigation";
import { useVentaDetalle } from "@/hooks/useVentas";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Loader2, DownloadCloud, Share2, FileText } from "lucide-react";
import { BsWhatsapp } from 'react-icons/bs';
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/hooks/useResumenCompras"; // Reutilizar helper si existe
import { usePdfActions } from "@/hooks/usePdfActions"; // Importar el nuevo hook
import { toast } from "sonner";

export default function VentaDetallePage() {
  const router = useRouter();
  const params = useParams();
  const idVenta = params.idVenta as string; // Obtener ID de la ruta

  const { data: venta, isLoading, error } = useVentaDetalle(idVenta);
  
  // Usar el hook de acciones PDF
  const { 
    generatePdf,
    // downloadPdf, // generatePdf con triggerDownload=true ya descarga. downloadPdf es para redescargar si ya existe blob.
    sharePdf,
    shareWhatsApp,
    isGenerating: isPdfGenerating, // Renombrar para evitar conflicto con isLoading de useVentaDetalle
    // isLoadingData: isLoadingPdfData, // Podríamos usarlo para deshabilitar botones si los datos base (perfil) no cargan
    // dataError: pdfDataError, // Para mostrar errores específicos de carga de datos para PDF
    pdfGenerated 
  } = usePdfActions(idVenta);

  const formatDate = (dateString: string | Date) => {
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      return format(date, "dd/MM/yyyy HH:mm", { locale: es });
    } catch {
      return "Fecha inválida";
    }
  };

  // Función local para formatear moneda (si no se importa)
  // const formatCurrency = (amount: number | null | undefined): string => {
  //   if (amount === null || amount === undefined) return "-";
  //   return new Intl.NumberFormat("es-AR", {
  //     style: "currency",
  //     currency: "ARS",
  //   }).format(amount);
  // };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 flex justify-center items-center min-h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/ventas')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al historial
        </Button>
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error al cargar la Venta</CardTitle>
            <CardDescription className="text-destructive">
              No se pudo obtener el detalle de la venta. {error.message}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!venta) {
     return (
      <div className="container mx-auto py-8 px-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/ventas')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al historial
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Venta no encontrada</CardTitle>
            <CardDescription>
              No se encontró una venta con el ID proporcionado.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Renderizar detalle de la venta
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl"> {/* Limitar ancho máximo */}
      {/* Botón Volver y Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/ventas')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al historial
        </Button>
         <div className="text-right text-sm text-muted-foreground">
             <p>ID Venta: {venta.id}</p>
             <p>Fecha: {formatDate(venta.fecha)}</p>
         </div>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-8 text-center">Detalle de Venta</h1>

      {/* NUEVA SECCIÓN: Acciones del Comprobante */}
      {venta && (
        <Card className="my-8 rounded-lg shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Acciones del Comprobante</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <Button 
              onClick={() => generatePdf(true)} 
              disabled={isPdfGenerating || isLoading} // Deshabilitar si carga datos de venta o genera PDF
              className="w-full sm:w-auto"
            >
              {isPdfGenerating && !pdfGenerated ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DownloadCloud className="mr-2 h-4 w-4" />}
              {isPdfGenerating && !pdfGenerated ? 'Generando PDF...' : (pdfGenerated ? 'Descargar de Nuevo' : 'Generar y Descargar PDF')}
            </Button>
            <Button 
              onClick={sharePdf} 
              disabled={isPdfGenerating || isLoading}
              variant="outline"
              className="w-full sm:w-auto"
            >
              {isPdfGenerating && !pdfGenerated ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
              Compartir PDF
            </Button>
            <Button 
              onClick={shareWhatsApp} 
              disabled={isPdfGenerating || isLoading || !venta.cliente?.telefono}
              variant="outline"
              className="w-full sm:w-auto flex items-center justify-center border-green-500 text-green-500 hover:bg-green-500 hover:text-white"
            >
              {isPdfGenerating && !pdfGenerated ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BsWhatsapp className="mr-2 h-5 w-5" />}
              Enviar por WhatsApp
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Datos del Cliente */}
      <Card className="mb-8 rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Datos del Cliente</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div><span className="font-medium">Nombre:</span> {venta.cliente?.nombre || "N/A"}</div>
          <div><span className="font-medium">DNI/CUIT:</span> {venta.cliente?.dni_cuit || "N/A"}</div>
          <div><span className="font-medium">Dirección:</span> {venta.cliente?.direccion || "N/A"}</div>
          <div><span className="font-medium">Ciudad:</span> {venta.cliente?.ciudad || "N/A"}</div>
          <div><span className="font-medium">Código Postal:</span> {venta.cliente?.codigo_postal || "N/A"}</div>
          <div><span className="font-medium">Teléfono:</span> {venta.cliente?.telefono || "N/A"}</div>
          <div className="sm:col-span-2"><span className="font-medium">Email:</span> {venta.cliente?.email || "N/A"}</div>
        </CardContent>
      </Card>

      {/* Mensaje Interno (si existe) */}
      {venta.mensajeInterno && (
        <Card className="mb-8 rounded-lg shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Mensaje Interno</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{venta.mensajeInterno}</p>
          </CardContent>
        </Card>
      )}

      {/* Mensaje Externo (si existe) */}
      {venta.mensajeExterno && (
        <Card className="mb-8 rounded-lg shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Mensaje para el Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{venta.mensajeExterno}</p>
          </CardContent>
        </Card>
      )}

      {/* Productos Vendidos */}
      <Card className="rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Productos Vendidos</CardTitle>
        </CardHeader>
        <CardContent>
           <div className="overflow-x-auto">
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
                  {(venta.items || []).map((item, index) => (
                    <TableRow key={`${item.producto_id}-${index}`}>
                      <TableCell className="font-medium">{item.producto_nombre || "Producto no encontrado"}</TableCell>
                      <TableCell className="text-center">{item.cantidad}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.precio_unitario)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
           </div>
        </CardContent>
        <CardFooter className="flex justify-end pt-4 border-t">
             <div className="text-lg font-bold">
                 Total Venta: {formatCurrency(venta.total)}
             </div>
        </CardFooter>
      </Card>

      {/* Desglose de Pagos */}
      {venta.pagos && venta.pagos.length > 0 && (
          <Card className="mt-8 rounded-lg shadow-sm">
              <CardHeader>
                  <CardTitle className="text-xl">Formas de Pago</CardTitle>
              </CardHeader>
              <CardContent>
                  <ul className="space-y-2 text-sm">
                      {venta.pagos.map((pago, index) => (
                          <li key={index} className="flex justify-between items-center border-b last:border-b-0 pb-1">
                              <span className="capitalize">
                                {pago.metodo_pago.replace("_", " ")}
                                {pago.metodo_pago === "Tarjeta Crédito" && pago.cuotas && pago.cuotas > 1 && (
                                  <span className="text-muted-foreground ml-2 text-xs">
                                    ({pago.cuotas} cuotas
                                    {pago.recargo ? `, recargo ${pago.recargo * 100}%` : ""})
                                  </span>
                                )}
                              </span>
                              <span className="font-medium">{formatCurrency(pago.monto)}</span>
                          </li>
                      ))}
                  </ul>
              </CardContent>
          </Card>
       )}
    </div>
  );
} 