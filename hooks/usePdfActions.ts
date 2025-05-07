"use client";

import { useState } from 'react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { usePerfilEmpresa } from "@/lib/hooks/usePerfilEmpresa";
import { useVentaDetalle } from "@/hooks/useVentas";
import type { PerfilEmpresa } from "@/lib/types/venta.types";
import type { Venta } from "@/types/venta";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from 'lucide-react';

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

export function usePdfActions(idVenta: string | null) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null); 

  const { data: perfilEmpresa, isLoading: isLoadingPerfil, error: errorPerfil } = usePerfilEmpresa();
  const { data: ventaDetalle, isLoading: isLoadingVenta, error: errorVenta } = useVentaDetalle(idVenta);

  const isLoadingData = isLoadingPerfil || isLoadingVenta;
  const dataError = errorPerfil || errorVenta;

  const generatePdf = async (triggerDownload: boolean = true) => {
    if (!perfilEmpresa || !ventaDetalle) {
      toast.error("Faltan datos de la empresa o de la venta para generar el PDF.");
      console.error("generatePdf: Faltan perfilEmpresa o ventaDetalle", { perfilEmpresa, ventaDetalle });
      return null;
    }
    if (isGenerating) return pdfBlob;

    setIsGenerating(true);
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
        if (ventaDetalle.cliente.direccion) { yPos += 5; doc.text(`Dirección: ${ventaDetalle.cliente.direccion}`, margin, yPos); }
        if (ventaDetalle.cliente.email) { yPos += 5; doc.text(`Email: ${ventaDetalle.cliente.email}`, margin, yPos); }
        if (ventaDetalle.cliente.telefono) { yPos += 5; doc.text(`Teléfono: ${ventaDetalle.cliente.telefono}`, margin, yPos); }
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
          let footerYPos = pageHeight - 20;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.text(`Este es un comprobante no fiscal. ${perfilEmpresa.businessName} - ${perfilEmpresa.cuit}`, margin, footerYPos);
          doc.text(`Página ${data.pageNumber}`, pageWidth - margin - 10, footerYPos, { align: 'right' });
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

      const currentPdfBlob = doc.output('blob');
      const currentPdfUrl = URL.createObjectURL(currentPdfBlob);
      
      setPdfBlob(currentPdfBlob);
      setPdfUrl(currentPdfUrl); 
      
      if (triggerDownload) {
        const link = document.createElement('a');
        link.href = currentPdfUrl;
        link.download = `Recibo_Venta_${ventaDetalle.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("PDF generado y descarga iniciada.");
      } else {
        toast.success("PDF generado.");
      }
      return currentPdfBlob;

    } catch (error) {
      console.error("Error generando PDF:", error);
      toast.error("Error al generar el PDF.");
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPdf = () => {
    if (!pdfUrl || !pdfBlob || !ventaDetalle) {
        toast.error("No hay PDF generado para descargar. Genéralo primero.");
        return;
    }
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `Recibo_Venta_${ventaDetalle.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Descarga del PDF iniciada.");
  };
  
  const sharePdf = async () => {
    let currentPdfBlob = pdfBlob;
    if (!currentPdfBlob) {
        const generated = await generatePdf(false); 
        if (!generated) {
            toast.error("No se pudo generar el PDF para compartir.");
            return;
        }
        currentPdfBlob = generated;
    }

    if (!currentPdfBlob || !ventaDetalle) {
      toast.error("PDF no disponible o datos de venta no disponibles para compartir.");
      return;
    }

    const pdfFile = new File([currentPdfBlob], `Recibo_Venta_${ventaDetalle.id}.pdf`, { type: 'application/pdf' });
    const shareTitle = `Recibo Venta #${ventaDetalle.id}`;
    const shareText = `Aquí tienes tu recibo de venta de ${perfilEmpresa?.businessName || 'nuestra tienda'}`;

    try {
      if (navigator.share) {
        const canShareFile = navigator.canShare && navigator.canShare({ files: [pdfFile] });
        if (canShareFile) {
          await navigator.share({
            files: [pdfFile],
            title: shareTitle,
            text: shareText,
          });
          toast.success("PDF compartido correctamente.");
        } else {
          toast.info("Tu navegador no permite compartir archivos directamente. Descargando PDF para compartir manualmente.", { duration: 7000 });
          downloadPdf(); 
        }
      } else {
        toast.error("La función de compartir no está disponible en tu navegador. Descargando PDF...");
        downloadPdf();
      }
    } catch (error) {
      console.error("Error al compartir PDF:", error);
      toast.error(`Error al compartir: ${(error as Error).message}`);
    }
  };
  
  const formatPhoneForWhatsapp = (phone: string = ''): string | null => {
    if (!phone || phone.trim() === '') return null;
    let cleanPhone = phone.replace(/\D/g, '');
    if (!phone.startsWith('+') && cleanPhone.length <= 12) { 
      cleanPhone = `54${cleanPhone}`;
    }
    return cleanPhone;
  };

  const shareWhatsApp = async () => {
    let currentPdfBlob = pdfBlob;
    let currentPdfUrl = pdfUrl;

    if (!currentPdfBlob || !currentPdfUrl) {
        const generatedBlob = await generatePdf(true); 
        if (!generatedBlob) {
            toast.error("No se pudo generar el PDF para compartir por WhatsApp.");
            return;
        }
        currentPdfBlob = generatedBlob;
        currentPdfUrl = pdfUrl; 
    }
    
    if (!currentPdfBlob || !currentPdfUrl || !ventaDetalle || !ventaDetalle.cliente) {
      toast.error("Datos insuficientes para compartir por WhatsApp.");
      return;
    }

    const phone = ventaDetalle.cliente.telefono || '';
    const formattedPhone = formatPhoneForWhatsapp(phone);

    if (!formattedPhone) {
      toast.error("Número de teléfono del cliente no disponible o inválido.");
      return;
    }
    
    if (!currentPdfUrl) { 
        toast.error("URL del PDF no disponible. Intenta generar el PDF de nuevo.");
        return;
    }

    const link = document.createElement('a');
    link.href = currentPdfUrl;
    link.download = `Recibo_Venta_${ventaDetalle.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const text = `Hola ${ventaDetalle.cliente.nombre}, aquí tu recibo de venta de ${perfilEmpresa?.businessName || 'nuestra tienda'} por un total de ${formatCurrency(ventaDetalle.total)}.\n\nTe acabo de enviar el PDF del recibo. Por favor, revisa tus descargas para encontrarlo y adjuntarlo al chat.`;
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
    
    toast.info("PDF descargado. Abriendo WhatsApp...");
    setTimeout(() => {
      window.open(whatsappUrl, '_blank');
    }, 800);
  };

  return {
    generatePdf,
    downloadPdf,
    sharePdf,
    shareWhatsApp,
    isGenerating,
    isLoadingData,
    dataError,
    perfilEmpresa, 
    ventaDetalle,  
    pdfGenerated: !!pdfBlob, 
  };
} 