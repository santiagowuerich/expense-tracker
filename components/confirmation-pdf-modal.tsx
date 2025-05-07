"use client";

import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePerfilEmpresa } from "@/lib/hooks/usePerfilEmpresa";
import { useVentaDetalle } from "@/hooks/useVentas";
import type { PerfilEmpresa } from "@/lib/types/venta.types";
import type { Venta } from "@/types/venta";
import { toast } from 'sonner';
import { Loader2, DownloadCloud, Share2, AlertTriangle } from 'lucide-react';
import { BsWhatsapp } from 'react-icons/bs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ConfirmationPdfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idVenta?: string | number;
  onPdfGeneratedProp?: () => void;
}

export default function ConfirmationPdfModal({
  open,
  onOpenChange,
  idVenta,
  onPdfGeneratedProp,
}: ConfirmationPdfModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfGenerated, setPdfGenerated] = useState(false);

  const { data: perfilEmpresa, isLoading: isLoadingPerfil, error: errorPerfil } = usePerfilEmpresa();
  const { data: ventaDetalle, isLoading: isLoadingVenta, error: errorVenta } = useVentaDetalle(idVenta ? String(idVenta) : null);

  const isLoading = isLoadingPerfil || isLoadingVenta;

  const formatCurrency = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  const formatDate = (dateString: string | Date | undefined): string => {
    if (!dateString) return 'Fecha no disponible';
    try {
      return new Date(dateString).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return 'Fecha inválida';
    }
  };

  const handleGeneratePdf = async () => {
    if (!perfilEmpresa || !ventaDetalle) {
      toast.error("Faltan datos para generar el PDF.");
      return;
    }
    
    setIsGenerating(true);
    setPdfGenerated(false);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfBlob(null);
    setPdfUrl(null);

    try {
      const doc = new jsPDF();
      let yPos = 20;
      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.width;
      const margin = 14;

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text("COMPROBANTE DE VENTA", pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`ID Venta: ${ventaDetalle.id}`, pageWidth - margin, yPos, { align: 'right' });
      doc.text(`Fecha: ${formatDate(ventaDetalle.fecha)}`, margin, yPos);
      yPos += 8;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(perfilEmpresa.businessName, margin, yPos);
      yPos += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`CUIT: ${perfilEmpresa.cuit}`, margin, yPos);
      yPos += 5;
      doc.text(`Dirección: ${perfilEmpresa.address}`, margin, yPos);
      yPos += 5;
      doc.text(`Condición IVA: ${perfilEmpresa.ivaCondition}`, margin, yPos);
      yPos += 10;

      doc.setDrawColor(200);
      doc.line(margin, yPos - 3, pageWidth - margin, yPos - 3);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text("Cliente:", margin, yPos + 4);
      yPos += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      if (ventaDetalle.cliente) {
        doc.text(ventaDetalle.cliente.nombre, margin, yPos);
        yPos += 5;
        doc.text(`DNI/CUIT: ${ventaDetalle.cliente.dni_cuit}`, margin, yPos);
        if (ventaDetalle.cliente.direccion) {
          yPos += 5;
          doc.text(`Dirección: ${ventaDetalle.cliente.direccion}`, margin, yPos);
        }
        if (ventaDetalle.cliente.email) {
          yPos += 5;
          doc.text(`Email: ${ventaDetalle.cliente.email}`, margin, yPos);
        }
        if (ventaDetalle.cliente.telefono) {
          yPos += 5;
          doc.text(`Teléfono: ${ventaDetalle.cliente.telefono}`, margin, yPos);
        }
      }
      yPos += 10;

      const mensajeExterno = ventaDetalle.mensajeExterno || (ventaDetalle as any).mensaje_externo;
      if (mensajeExterno && mensajeExterno.trim() !== "") {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        const lines = doc.splitTextToSize(mensajeExterno, pageWidth - margin * 2);
        doc.text(lines, margin, yPos);
        yPos += (lines.length * 4) + 6;
      }

      const calculatedSubtotal = (ventaDetalle.items || []).reduce((sum, item) => sum + (item.subtotal || 0), 0);

      autoTable(doc, {
        startY: yPos,
        head: [['Descripción', 'Cant.', 'P. Unit.', 'Subtotal']],
        body: (ventaDetalle.items || []).map(item => [
          item.producto_nombre || 'N/A',
          item.cantidad.toString(),
          formatCurrency(item.precio_unitario),
          formatCurrency(item.subtotal)
        ]),
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        margin: { left: margin, right: margin },
        didDrawPage: (data) => {
          let newYPos = pageHeight - 20;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.text(`Este es un comprobante no fiscal. ${perfilEmpresa.businessName} - ${perfilEmpresa.cuit}`, margin, newYPos);
          doc.text(`Página ${data.pageNumber}`, pageWidth - margin -10 , newYPos, {align: 'right'});
        }
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 10;

      const totalsX = pageWidth - margin;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text("Subtotal:", totalsX - 40, yPos, { align: 'left' });
      doc.text(formatCurrency(calculatedSubtotal), totalsX, yPos, { align: 'right' });
      yPos += 7;

      const impuestosCalculados = ventaDetalle.total - calculatedSubtotal;
      if (impuestosCalculados !== undefined && Math.abs(impuestosCalculados) >= 0.01) {
        doc.text("Impuestos:", totalsX - 40, yPos, { align: 'left' });
        doc.text(formatCurrency(impuestosCalculados), totalsX, yPos, { align: 'right' });
        yPos += 7;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text("TOTAL:", totalsX - 40, yPos, { align: 'left' });
      doc.text(formatCurrency(ventaDetalle.total), totalsX, yPos, { align: 'right' });
      yPos += 15;

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      
      setPdfBlob(blob);
      setPdfUrl(url);
      setPdfGenerated(true);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `Recibo_Venta_${ventaDetalle.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("PDF generado y descarga iniciada.");
      
      if (onPdfGeneratedProp) {
        onPdfGeneratedProp();
      }

    } catch (error) {
      console.error("Error generando PDF:", error);
      toast.error("Error al generar el PDF.");
      setPdfGenerated(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSharePdf = async () => {
    if (!pdfBlob || !ventaDetalle) {
      toast.error("PDF no generado o datos de venta no disponibles.");
      console.log("handleSharePdf: pdfBlob o ventaDetalle no están listos.");
      return;
    }

    const pdfFile = new File([pdfBlob], `Recibo_Venta_${ventaDetalle.id}.pdf`, { type: 'application/pdf' });
    const shareTitle = `Recibo Venta #${ventaDetalle.id}`;
    const shareText = `Aquí tienes tu recibo de venta de ${perfilEmpresa?.businessName || 'nuestra tienda'}`;

    console.log("handleSharePdf: Intentando compartir...", { pdfFile, shareTitle, shareText });
    toast.info("Preparando para compartir...");

    try {
      if (navigator.share) {
        console.log("handleSharePdf: navigator.share está disponible.");
        const canShareFile = navigator.canShare && navigator.canShare({ files: [pdfFile] });
        console.log("handleSharePdf: navigator.canShare({ files: [pdfFile] }) =", canShareFile);
        toast.info(`Capacidad de compartir archivo: ${canShareFile}`);

        if (canShareFile) {
          console.log("handleSharePdf: Intentando navigator.share con archivo.");
          await navigator.share({
            files: [pdfFile],
            title: shareTitle,
            text: shareText,
          });
          toast.success("PDF compartido correctamente.");
          console.log("handleSharePdf: navigator.share con archivo tuvo éxito (aparentemente).");
        } else {
          console.log("handleSharePdf: navigator.canShare({ files: [...] }) es false. Mostrando toast de fallback.");
          toast.custom((t) => (
            <div className="flex items-start p-4 bg-background border rounded-md shadow-lg">
              <AlertTriangle className="h-6 w-6 text-yellow-500 mr-3 flex-shrink-0" />
              <div className="flex-grow">
                <p className="font-semibold">Compartir Manualmente</p>
                <p className="text-sm text-muted-foreground">
                  Tu navegador no permite enviar archivos directamente.
                  Por favor, descarga el PDF y compártelo manualmente.
                </p>
                <Button
                  variant="link"
                  className="text-xs p-0 h-auto mt-2 text-blue-500"
                  onClick={() => {
                    const whatsappMessage = encodeURIComponent(`${shareText}`);
                    window.open(`https://wa.me/?text=${whatsappMessage}`, '_blank');
                  }}
                >
                  Abrir WhatsApp (solo texto)
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => toast.dismiss(t)} className="ml-2">Cerrar</Button>
            </div>
          ), { duration: 15000 }); 
        }
      } else {
        console.log("handleSharePdf: navigator.share NO está disponible.");
        toast.error("La función de compartir no está disponible en tu navegador.");
         const whatsappMessage = encodeURIComponent(`${shareText}. Puedes descargar el PDF usando el botón correspondiente.`);
         window.open(`https://wa.me/?text=${whatsappMessage}`, '_blank');
      }
    } catch (error) {
      console.error("Error detallado al compartir PDF:", error);
      toast.error(`Error al compartir: ${(error as Error).message} (Nombre: ${(error as Error).name})`);
    }
  };

  // Función para formatear el número de teléfono para WhatsApp
  const formatPhoneForWhatsapp = (phone: string = ''): string | null => {
    if (!phone || phone.trim() === '') return null;
    
    // Eliminar cualquier carácter que no sea dígito
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Si el número ya tiene un código de país, usarlo
    if (phone.startsWith('+')) {
      // Nada que hacer, ya procesamos arriba
    } 
    // Si no empieza con código de país y tiene menos de 12 dígitos, añadir +54 para Argentina
    else if (cleanPhone.length <= 12) {
      cleanPhone = `54${cleanPhone}`;
    }
    
    return cleanPhone;
  };

  const handleShareWhatsApp = () => {
    if (!ventaDetalle || !ventaDetalle.cliente) {
      toast.error("Datos de venta o cliente no disponibles.");
      return;
    }

    try {
      // Extraer y formatear el número de teléfono
      const phone = ventaDetalle.cliente.telefono || '';
      const formattedPhone = formatPhoneForWhatsapp(phone);
      
      // Verificar si hay número de teléfono
      if (!formattedPhone) {
        toast.error("Número de teléfono del cliente no disponible.");
        return;
      }
      
      // Si el PDF no está generado, notificar al usuario
      if (!pdfBlob || !pdfUrl) {
        toast.error("Primero debes generar el PDF para poder compartirlo.");
        return;
      }
      
      // Descargar el PDF primero (si no se ha descargado)
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Recibo_Venta_${ventaDetalle.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Construir mensaje para WhatsApp con más contexto
      const text = `Hola ${ventaDetalle.cliente.nombre}, aquí tu recibo de venta de ${perfilEmpresa?.businessName || 'nuestra tienda'} por un total de ${formatCurrency(ventaDetalle.total)}.\n\nTe acabo de enviar el PDF del recibo. Por favor, revisa tus descargas para encontrarlo.`;
      const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
      
      // Notificar al usuario antes de abrir WhatsApp
      toast.success("PDF descargado. Abriendo WhatsApp...");
      
      // Breve retraso para asegurar que el toast sea visible
      setTimeout(() => {
        // Abrir WhatsApp en nueva ventana
        window.open(url, '_blank');
      }, 800);
    } catch (error) {
      console.error("Error al compartir por WhatsApp:", error);
      toast.error("Error al abrir WhatsApp. Intenta más tarde.");
    }
  };

  const internalOnOpenChange = useCallback((isOpen: boolean) => {
    if (isGenerating) { 
      return;
    }
    onOpenChange(isOpen); 
    if (!isOpen) {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      setPdfBlob(null);
      setPdfUrl(null);
      setPdfGenerated(false);
    }
  }, [isGenerating, onOpenChange, pdfUrl]);

  const uiSubtotal = useMemo(() => {
    if (!ventaDetalle || !ventaDetalle.items) return 0;
    return ventaDetalle.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  }, [ventaDetalle]);

  const uiImpuestos = useMemo(() => {
    if (!ventaDetalle) return 0;
    const impuestos = ventaDetalle.total - uiSubtotal;
    return Math.abs(impuestos) < 0.01 ? 0 : impuestos;
  }, [ventaDetalle, uiSubtotal]);

  return (
    <Dialog open={open} onOpenChange={internalOnOpenChange}>
      <DialogContent className="bg-card w-full max-w-sm p-4 sm:p-6 sm:max-w-lg md:max-w-2xl rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center mb-4">
          <DialogTitle className="text-2xl font-semibold">Resumen de la Venta</DialogTitle>
          {ventaDetalle && <DialogDescription>ID Venta: {ventaDetalle.id}</DialogDescription>}
        </DialogHeader>

        {isLoading && (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Cargando resumen...</p>
          </div>
        )}

        {errorPerfil && <p className="text-red-500 text-center">Error al cargar datos de la empresa: {errorPerfil.message}</p>}
        {errorVenta && <p className="text-red-500 text-center">Error al cargar detalles de la venta: {errorVenta.message}</p>}

        {!isLoading && !errorPerfil && !errorVenta && perfilEmpresa && ventaDetalle && (
          <div className="space-y-6 text-sm">
            <section>
              <h3 className="font-semibold text-lg mb-2 text-primary">Datos de la Empresa</h3>
              <p>{perfilEmpresa.businessName}</p>
              <p>CUIT: {perfilEmpresa.cuit}</p>
              <p>Dirección: {perfilEmpresa.address}</p>
              <p>Condición IVA: {perfilEmpresa.ivaCondition}</p>
            </section>

            <section>
              <h3 className="font-semibold text-lg mb-2 text-primary">Datos del Cliente</h3>
              {ventaDetalle.cliente ? (
                <>
                  <p>{ventaDetalle.cliente.nombre}</p>
                  <p>DNI/CUIT: {ventaDetalle.cliente.dni_cuit}</p>
                  {ventaDetalle.cliente.direccion && <p>Dirección: {ventaDetalle.cliente.direccion}</p>}
                  {ventaDetalle.cliente.email && <p>Email: {ventaDetalle.cliente.email}</p>}
                  {ventaDetalle.cliente.telefono && <p>Teléfono: {ventaDetalle.cliente.telefono}</p>}
                </>
              ) : <p>Cliente no especificado.</p>}
            </section>

            {(() => {
              const mensajeExterno = ventaDetalle.mensajeExterno || (ventaDetalle as any).mensaje_externo;
              return mensajeExterno && mensajeExterno.trim() !== "" ? (
                <section>
                  <h3 className="font-semibold text-lg mb-2 text-primary">Mensaje Adicional</h3>
                  <p className="whitespace-pre-wrap italic">{mensajeExterno}</p>
                </section>
              ) : null;
            })()}

            <section>
              <h3 className="font-semibold text-lg mb-2 text-primary">Productos Vendidos</h3>
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Descripción</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cant.</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">P. Unit.</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {(ventaDetalle.items || []).map((item, index) => (
                      <tr key={item.producto_id + "-" + index}>
                        <td className="px-4 py-2 whitespace-nowrap">{item.producto_nombre || 'N/A'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-right">{item.cantidad}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-right">{formatCurrency(item.precio_unitario)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-right">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="text-right space-y-1 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p><span className="font-semibold">Subtotal Venta:</span> {formatCurrency(uiSubtotal)}</p>
              {uiImpuestos !== 0 && (
                <p><span className="font-semibold">Impuestos:</span> {formatCurrency(uiImpuestos)}</p>
              )}
              <p className="text-lg font-bold text-primary"><span className="font-semibold">Total Venta:</span> {formatCurrency(ventaDetalle.total)}</p>
            </section>

            <DialogFooter className="mt-8">
              <div className="flex flex-col space-y-2 w-full">
                {!pdfGenerated ? (
                  <Button 
                    type="button" 
                    onClick={handleGeneratePdf} 
                    disabled={isGenerating || isLoading}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 w-full py-3 rounded-md text-base"
                  >
                    {isGenerating ? 
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generando...</> : 
                      <><DownloadCloud className="mr-2 h-5 w-5" /> Generar y Descargar PDF</>
                    }
                  </Button>
                ) : (
                  <>
                    <Button 
                      type="button" 
                      onClick={() => {
                        if (pdfUrl) {
                          const link = document.createElement('a');
                          link.href = pdfUrl;
                          link.download = `Recibo_Venta_${ventaDetalle.id}.pdf`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        } else {
                          toast.error("No hay PDF para descargar. Intenta generarlo de nuevo.");
                        }
                      }} 
                      className="bg-primary text-primary-foreground hover:bg-primary/90 w-full py-3 rounded-md text-base"
                    >
                      <DownloadCloud className="mr-2 h-5 w-5" /> Descargar PDF de Nuevo
                    </Button>
                    <div className="flex space-x-2 w-full">
                      <Button 
                        type="button" 
                        onClick={handleSharePdf} 
                        variant="outline"
                        className="w-1/2 py-3 rounded-md mt-2 text-base"
                        disabled={!pdfBlob} 
                      >
                        <Share2 className="mr-2 h-5 w-5" /> Compartir PDF
                      </Button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              type="button" 
                              onClick={handleShareWhatsApp} 
                              variant="outline"
                              className="w-1/2 py-3 rounded-md mt-2 text-base flex items-center justify-center gap-2 border border-green-500 text-green-500 hover:bg-green-600 hover:text-white"
                              disabled={!ventaDetalle?.cliente?.telefono || !pdfBlob} 
                              aria-label="Compartir recibo por WhatsApp"
                            >
                              <BsWhatsapp className="h-5 w-5" /> Enviar por WhatsApp
                            </Button>
                          </TooltipTrigger>
                          {!ventaDetalle?.cliente?.telefono && (
                            <TooltipContent>
                              <p>Número de cliente no disponible</p>
                            </TooltipContent>
                          )}
                          {!pdfBlob && ventaDetalle?.cliente?.telefono && (
                            <TooltipContent>
                              <p>Primero debes generar el PDF</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {pdfGenerated && (
                      <p className="text-xs text-muted-foreground mt-3 text-center">
                        <span className="font-medium">Nota:</span> Al usar WhatsApp, el PDF se descargará primero y luego deberás adjuntarlo manualmente al chat. Esto es debido a limitaciones técnicas de WhatsApp.
                      </p>
                    )}
                  </>
                )}
              </div>
            </DialogFooter>
          </div>
        )}
        
        {!isLoading && (!perfilEmpresa || !ventaDetalle) && !errorPerfil && !errorVenta && (
            <div className="text-center py-10">
                <p className="text-muted-foreground">No se pudieron cargar todos los datos para el resumen.</p>
                <p className="text-xs text-muted-foreground mt-1">Asegúrate de que el ID de venta sea válido y el perfil de empresa esté configurado.</p>
            </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 