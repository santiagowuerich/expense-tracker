"use client"

import { useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { queryClient } from "@/lib/queries"
import { Pencil } from "lucide-react"
import type React from "react"

const formSchema = z.object({
  costo_unit: z.coerce.number().min(0, "El costo no puede ser negativo").nullable(),
  precio_unit: z.coerce.number().min(0, "El precio no puede ser negativo").nullable(),
  stock_min: z.coerce.number().int().min(0, "El stock mínimo no puede ser negativo").default(0),
})

type FormValues = z.infer<typeof formSchema>

interface EditProductDialogProps {
  producto: {
    id: string
    nombre: string
    costo_unit: number | null
    precio_unit: number | null
    stock_min?: number
  }
  children?: React.ReactNode
}

export default function EditProductDialog({ producto, children }: EditProductDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      costo_unit: producto.costo_unit,
      precio_unit: producto.precio_unit,
      stock_min: producto.stock_min || 0,
    },
  })

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/edit-product", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: producto.id,
          costo_unit: values.costo_unit,
          precio_unit: values.precio_unit,
          stock_min: values.stock_min,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Error al actualizar el producto")
      }

      toast({
        title: "Producto actualizado",
        description: "Los datos del producto han sido actualizados exitosamente",
      })

      // Invalidar la caché de consultas para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      queryClient.invalidateQueries({ queryKey: ["price-history"] })

      setOpen(false)
    } catch (error: any) {
      console.error("Error al actualizar el producto:", error)
      toast({
        title: "Error",
        description: error.message || "Error desconocido al actualizar el producto",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ? children : (
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar producto: {producto.nombre}</DialogTitle>
          <DialogDescription>Actualiza los precios y el stock mínimo del producto.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <FormField
              control={form.control}
              name="costo_unit"
              render={({ field: { value, onChange, ...field } }) => (
                <FormItem>
                  <FormLabel>Costo unitario</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...field}
                      value={value === null ? "" : value}
                      onChange={(e) => onChange(e.target.value === "" ? null : Number.parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Precio al que compras el producto</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="precio_unit"
              render={({ field: { value, onChange, ...field } }) => (
                <FormItem>
                  <FormLabel>Precio de venta</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...field}
                      value={value === null ? "" : value}
                      onChange={(e) => onChange(e.target.value === "" ? null : Number.parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Precio al que vendes el producto</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stock_min"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock mínimo</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      {...field}
                      value={field.value || 0}
                      onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number.parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Nivel de stock para alertas</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
