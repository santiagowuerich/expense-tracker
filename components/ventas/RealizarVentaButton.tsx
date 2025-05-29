"use client";

import { Button, ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { VentaForm } from "./VentaForm";
import { cn } from "@/lib/utils";
import { ShoppingCart } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

interface RealizarVentaButtonProps {
  className?: string;
  clienteId?: string;
}

export function RealizarVentaButton({ className, clienteId }: RealizarVentaButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ventaFormKey, setVentaFormKey] = useState(Date.now());
  const [activeClienteId, setActiveClienteId] = useState<string | undefined>(clienteId);
  const searchParams = useSearchParams();
  
  // Capturar el clienteId desde los parámetros de la URL si no se proporcionó como prop
  const clienteIdFromUrl = searchParams?.get('cliente');
  const effectiveClienteId = activeClienteId || clienteIdFromUrl || undefined;

  // Si se proporciona un clienteId en la URL, abrir automáticamente el diálogo
  useEffect(() => {
    if (clienteIdFromUrl) {
      setOpen(true);
      setActiveClienteId(clienteIdFromUrl);
    }
  }, [clienteIdFromUrl]);
  
  // Si cambia el clienteId como prop, actualizar el activeClienteId
  useEffect(() => {
    setActiveClienteId(clienteId);
  }, [clienteId]);

  const handleFormSuccess = () => {
    setOpen(false);
    setVentaFormKey(Date.now());
    setActiveClienteId(undefined);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      // Resetear completamente el formulario cuando se cierra
      setVentaFormKey(Date.now());
      setActiveClienteId(undefined);
      
      // Si se abrió con un clienteId en la URL, limpiamos ese parámetro
      if (clienteIdFromUrl && router) {
        router.push('/ventas');
      }
    }
  };

  return (
    <>
      <Button 
        onClick={() => {
          setOpen(true);
        }}
        className={cn(className)}
        variant={clienteId ? "outline" : "default"}
        size={clienteId ? "sm" : "default"}
      >
        <ShoppingCart className="mr-2 h-5 w-5" />
        {clienteId ? "Crear venta para este cliente" : "Realizar Venta"}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Venta</DialogTitle>
          </DialogHeader>
          <VentaForm 
            key={ventaFormKey} 
            onSuccess={handleFormSuccess} 
            clienteId={effectiveClienteId}
          />
        </DialogContent>
      </Dialog>
    </>
  );
} 