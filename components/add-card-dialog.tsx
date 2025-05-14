"use client"

import type React from "react"

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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { createClient, verificarTablas } from "@/lib/supabase-browser"
import { queryClient } from "@/lib/queries"

const formSchema = z.object({
  alias: z.string().min(1, "Requerido"),
  cierre_dia: z.coerce.number().int().min(1, "Debe ser entre 1 y 31").max(31, "Debe ser entre 1 y 31"),
  venc_dia: z.coerce.number().int().min(1, "Debe ser entre 1 y 31").max(31, "Debe ser entre 1 y 31"),
})

type FormValues = z.infer<typeof formSchema>

export default function AddCardDialog({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      alias: "",
      cierre_dia: 1,
      venc_dia: 10,
    },
  })

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    try {
      // Verificar si las tablas existen antes de intentar insertar
      const tablasExisten = await verificarTablas()
      if (!tablasExisten) {
        throw new Error(
          "Las tablas necesarias no existen en la base de datos. Por favor ejecute el script de configuración.",
        )
      }

      const supabase = createClient()

      // Obtener el usuario actual para asociar la tarjeta
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error(authError?.message || "Usuario no autenticado. No se puede guardar la tarjeta.");
      }

      // Imprimir valores para depuración
      console.log("Intentando guardar tarjeta con valores:", values, "para el usuario:", user.id)

      // Insertar directamente usando el cliente de Supabase
      const { data, error } = await supabase
        .from("tarjetas")
        .insert({
          alias: values.alias,
          cierre_dia: values.cierre_dia,
          venc_dia: values.venc_dia,
          user_id: user.id,
        })
        .select()

      // Imprimir respuesta para depuración
      console.log("Respuesta de Supabase:", { data, error })

      if (error) {
        console.error("Error detallado de Supabase:", JSON.stringify(error, null, 2))
        throw new Error(error.message || "Error desconocido al guardar la tarjeta")
      }

      toast({
        title: "Tarjeta creada",
        description: "La tarjeta ha sido agregada exitosamente",
      })

      // Invalidar la caché de consultas para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ["tarjetas"] })
      queryClient.invalidateQueries({ queryKey: ["resumen"] })

      form.reset()
      setOpen(false)
    } catch (error: any) {
      console.error("Error completo al guardar la tarjeta:", error)

      // Asegurarse de que siempre haya un mensaje de error
      const errorMessage =
        error?.message || "Error desconocido al guardar la tarjeta. Verifique la consola para más detalles."

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
      <DialogTrigger asChild>{children || <Button>Agregar tarjeta</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>Agregar nueva tarjeta</DialogTitle>
          <DialogDescription>
            Ingresa los detalles de tu tarjeta para realizar un seguimiento de tus gastos.
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
                {isSubmitting ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
