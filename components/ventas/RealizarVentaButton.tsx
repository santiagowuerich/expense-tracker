"use client";

import { Button, ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { VentaForm } from "./VentaForm";
import { cn } from "@/lib/utils";
import { ShoppingCart } from "lucide-react";

interface RealizarVentaButtonProps {
  className?: string;
}

export function RealizarVentaButton({ className }: RealizarVentaButtonProps) {
  const [open, setOpen] = useState(false);
  const [ventaFormKey, setVentaFormKey] = useState(Date.now());

  const handleFormSuccess = () => {
    setOpen(false);
    setVentaFormKey(Date.now());
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setVentaFormKey(Date.now());
    }
  };

  return (
    <>
      <Button 
        onClick={() => {
          setOpen(true);
        }}
        className={cn(className)}
      >
        <ShoppingCart className="mr-2 h-5 w-5" />
        Realizar Venta
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Venta</DialogTitle>
          </DialogHeader>
          <VentaForm key={ventaFormKey} onSuccess={handleFormSuccess} />
        </DialogContent>
      </Dialog>
    </>
  );
} 