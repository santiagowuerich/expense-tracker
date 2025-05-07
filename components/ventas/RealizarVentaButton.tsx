"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { VentaForm } from "./VentaForm";

export function RealizarVentaButton() {
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
      <Button onClick={() => {
        setOpen(true);
      }}>
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