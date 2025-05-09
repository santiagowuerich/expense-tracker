"use client"

import type React from "react"

import { useState, useEffect } from "react"
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { createClient } from "@/lib/supabase-browser"
import { queryClient } from "@/lib/queries"

const formSchema = z.object({
  alias: z.string().min(1, "Requerido"),
  cierre_dia: z.coerce.number().int().min(1, "Debe ser entre 1 y 31").max(31, "Debe ser entre 1 y 31"),
  venc_dia: z.coerce.number().int().min(1, "Debe ser entre 1 y 31").max(31, "Debe ser entre 1 y 31"),
})

type FormValues = z.infer<typeof formSchema>

interface Tarjeta {
  id: string
  alias: string
  cierre_dia: number
  venc_dia: number
}

interface EditCardDialogProps {
  tarjeta: Tarjeta
  children?: React.ReactNode
  onSuccess?: () => void
}

export default function EditCardDialog({ tarjeta, children, onSuccess }: EditCardDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      alias: tarjeta.alias,
      cierre_dia: tarjeta.cierre_dia,
      venc_dia: tarjeta.venc_dia,
    },
  })

  // Actualizar el formulario cuando cambia la tarjeta seleccionada
  useEffect(() => {
    if (tarjeta && open) {
      form.reset({
        alias: tarjeta.alias,
        cierre_dia: tarjeta.cierre_dia,
        venc_dia: tarjeta.venc_dia,
      })
    }
  }, [tarjeta, form, open])

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    try {
      const supabase = createClient()

      // Actualizar la tarjeta en Supabase
      const { data, error } = await supabase
        .from("tarjetas")
        .update({
          alias: values.alias,
          cierre_dia: values.cierre_dia,
          venc_dia: values.venc_dia,
        })
        .eq('id', tarjeta.id)
        .select()

      // Imprimir respuesta para depuración
      console.log("Respuesta de Supabase:", { data, error })

      if (error) {
        console.error("Error detallado de Supabase:", JSON.stringify(error, null, 2))
        throw new Error(error.message || "Error desconocido al actualizar la tarjeta")
      }

      toast({
        title: "Tarjeta actualizada",
        description: "La tarjeta ha sido modificada exitosamente",
      })

      // Invalidar la caché de consultas para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ["tarjetas"] })
      queryClient.invalidateQueries({ queryKey: ["resumen"] })

      if (onSuccess) {
        onSuccess()
      }

      setOpen(false)
    } catch (error: any) {
      console.error("Error completo al actualizar la tarjeta:", error)

      const errorMessage =
        error?.message || "Error desconocido al actualizar la tarjeta. Verifique la consola para más detalles."

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children || <Button variant="outline" size="sm">Editar</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>Editar tarjeta</DialogTitle>
          <DialogDescription>
            Modifica los detalles de tu tarjeta.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <FormField
              control={form.control}
              name="alias"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alias</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Visa Personal" {...field} className="h-10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cierre_dia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Día de cierre</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={31} {...field} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="venc_dia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Día de vencimiento</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={31} {...field} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="flex-col sm:flex-row pt-4">
              <Button type="submit" className="mt-2 sm:mt-0 w-full sm:w-auto h-10" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
} 