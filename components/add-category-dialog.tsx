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
import { createClient } from "@/lib/supabase-browser"
import { queryClient } from "@/lib/queries"
import { Plus } from "lucide-react"

const formSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
})

type FormValues = z.infer<typeof formSchema>

export default function AddCategoryDialog({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: "",
    },
  })

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    try {
      const supabase = createClient()

      // Insertar en Supabase
      const { data, error } = await supabase
        .from("categorias")
        .insert({
          nombre: values.nombre,
        })
        .select()

      if (error) {
        console.error("Error al guardar la categoría:", error)
        throw new Error(error.message || "Error desconocido al guardar la categoría")
      }

      toast({
        title: "Categoría creada",
        description: "La categoría ha sido agregada exitosamente",
      })

      // Invalidar la caché de consultas para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ["categorias"] })

      form.reset()
      setOpen(false)
    } catch (error: any) {
      console.error("Error al guardar la categoría:", error)
      toast({
        title: "Error",
        description: error.message || "Error desconocido al guardar la categoría",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" /> Nueva categoría
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Añadir nueva categoría</DialogTitle>
          <DialogDescription>Crea una nueva categoría para clasificar tus productos.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Electrónicos" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
