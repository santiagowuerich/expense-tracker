"use client"

import type React from "react"

import { useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
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
import { createClient } from "@/lib/supabase-browser"
import { queryClient } from "@/lib/queries"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useQuery } from "@tanstack/react-query"
import AddCategoryDialog from "./add-category-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const formSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  sku: z.string().optional(),
  stock: z.coerce.number().int().min(0, "El stock no puede ser negativo").default(0),
  costo_unit: z.coerce.number().min(0, "El costo no puede ser negativo").nullable(),
  precio_unit: z.coerce.number().min(0, "El precio no puede ser negativo").nullable(),
  stock_min: z.coerce.number().int().min(0, "El stock mínimo no puede ser negativo").default(0),
  categoria_id: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

type Categoria = {
  id: string
  nombre: string
}

// Props actualizadas
interface AddProductDialogProps {
  children?: React.ReactNode; // Para el trigger interno si no se controla externamente
  open?: boolean; // Para controlar externamente
  onOpenChange?: (open: boolean) => void; // Para controlar externamente
}

export default function AddProductDialog({ children, open: controlledOpen, onOpenChange: controlledOnOpenChange }: AddProductDialogProps) {
  // Usar estado interno solo si no se controla externamente
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Determinar si el diálogo está controlado externamente
  const isControlled = controlledOpen !== undefined && controlledOnOpenChange !== undefined;

  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange : setInternalOpen;

  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: "",
      sku: "",
      stock: 0,
      costo_unit: null,
      precio_unit: null,
      stock_min: 0,
      categoria_id: undefined,
    },
  })

  // Consultar categorías
  const {
    data: categorias,
    isLoading: isLoadingCategorias,
    error: errorCategorias,
    refetch: refetchCategorias,
  } = useQuery<Categoria[]>({
    queryKey: ["categorias"],
    queryFn: async (): Promise<Categoria[]> => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from("categorias").select("id, nombre").order("nombre")

        if (error) {
          throw new Error(error.message)
        }

        // Mapear explícitamente para asegurar el tipo
        const typedData: Categoria[] = (data || []).map(item => ({
           id: String(item.id), // Convertir a string
           nombre: String(item.nombre) // Convertir a string
        }));
        return typedData;

      } catch (error: any) {
        console.error("Error al cargar categorías:", error)
        return []
      }
    },
    enabled: open, // Solo ejecutar la consulta cuando el modal está abierto
  })

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/save-product", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Error al guardar el producto")
      }

      toast({
        title: "Producto creado",
        description: "El producto ha sido agregado exitosamente",
      })

      // Invalidar la caché de consultas para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ["productos"] })

      form.reset()
      setOpen(false)
    } catch (error: any) {
      console.error("Error al guardar el producto:", error)
      toast({
        title: "Error",
        description: error.message || "Error desconocido al guardar el producto",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Usar DialogTrigger para que funcione correctamente con el children */}
      <DialogTrigger asChild>
        {children || <Button>Agregar producto</Button>}
      </DialogTrigger>
      <DialogContent className={cn(
        "w-full max-w-md max-h-[90vh] flex flex-col p-0 sm:rounded-lg",
        "sm:max-w-[425px]"
      )}>
        <div className="sticky top-0 z-20 bg-background px-4 sm:px-6 pt-4 pb-3 border-b">
          <DialogHeader className="pr-8">
            <DialogTitle>Agregar nuevo producto</DialogTitle>
            <DialogDescription>Ingresa los detalles del producto.</DialogDescription>
          </DialogHeader>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1 h-auto w-auto rounded-full"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </div>
        <div className="flex-grow overflow-y-auto px-4 sm:px-6 pt-4 pb-16">
          <Form {...form}>
            <form id="add-product-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Laptop HP" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: PROD-001" {...field} />
                    </FormControl>
                    <FormDescription>Código único del producto (opcional)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoria_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <div className="flex space-x-2">
                      <div className="flex-1">
                        <Select value={field.value ?? ''} onValueChange={(value) => field.onChange(value === 'no-category' ? undefined : value)}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar categoría" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="no-category">Sin categoría</SelectItem>
                            {isLoadingCategorias ? (
                              <SelectItem value="loading" disabled>
                                Cargando categorías...
                              </SelectItem>
                            ) : errorCategorias ? (
                              <SelectItem value="error" disabled>
                                Error al cargar categorías
                              </SelectItem>
                            ) : categorias && categorias.length > 0 ? (
                              categorias.map((categoria: Categoria) => (
                                <SelectItem key={categoria.id} value={categoria.id}>
                                  {categoria.nombre}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="empty" disabled>
                                No hay categorías disponibles
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <AddCategoryDialog>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setTimeout(() => {
                              refetchCategorias()
                            }, 500)
                          }}
                        >
                          +
                        </Button>
                      </AddCategoryDialog>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock inicial</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        value={field.value || 0}
                        onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number.parseInt(e.target.value))}
                      />
                    </FormControl>
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
                    <FormDescription>Precio al que vendes el producto (opcional)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto mt-6">
                {isSubmitting ? "Guardando..." : "Guardar"}
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
