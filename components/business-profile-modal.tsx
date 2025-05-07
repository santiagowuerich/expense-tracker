"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getBusinessProfile, upsertBusinessProfile } from "@/lib/actions/business-profile.actions"

// El esquema Zod define la forma y las reglas de validación.
// Los .default("") se usarán por Zod durante la validación si un campo está ausente,
// pero para la inicialización de react-hook-form, proveeremos valores explícitos.
const businessProfileSchema = z.object({
  businessName: z.string().min(1, "El nombre del negocio es obligatorio.").default(""),
  sellerName: z.string().min(1, "El nombre del vendedor es obligatorio.").default(""),
  cuit: z.string().min(1, "El CUIT es obligatorio.").default(""),
  address: z.string().min(1, "La dirección comercial es obligatoria.").default(""),
  ivaCondition: z.string().min(1, "La condición frente al IVA es obligatoria.").default(""),
})

type BusinessProfileFormValues = z.infer<typeof businessProfileSchema>

// Valores por defecto explícitos para inicializar el formulario y el estado de reseteo.
const initialEmptyFormValues: BusinessProfileFormValues = {
  businessName: "",
  sellerName: "",
  cuit: "",
  address: "",
  ivaCondition: "",
};

interface BusinessProfileModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function BusinessProfileModal({ open, onOpenChange }: BusinessProfileModalProps) {
  const [isPending, startTransition] = useTransition()
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  // Estado para guardar los datos a los que se debe resetear el formulario al cerrar/cancelar
  const [initialDataForReset, setInitialDataForReset] = useState<BusinessProfileFormValues>(initialEmptyFormValues);

  const form = useForm<BusinessProfileFormValues>({
    resolver: zodResolver(businessProfileSchema),
    defaultValues: initialEmptyFormValues, // Usar los defaults explícitos que no causan error al cargar
  })

  useEffect(() => {
    if (open) {
      setIsLoadingProfile(true);
      startTransition(async () => {
        const result = await getBusinessProfile();
        let dataToSet: BusinessProfileFormValues;
        if (result.error) {
          toast.error(result.error || "Error al cargar el perfil.");
          dataToSet = initialEmptyFormValues; // En caso de error al cargar, usar los defaults vacíos
        } else if (result.data) {
          // Mapear desde result.data, asegurando que todos los campos estén presentes
          dataToSet = {
            businessName: result.data.businessName || "",
            sellerName: result.data.sellerName || "",
            cuit: result.data.cuit || "",
            address: result.data.address || "",
            ivaCondition: result.data.ivaCondition || "",
          };
        } else {
          // Si no hay datos (perfil nuevo), usar los defaults vacíos
          dataToSet = initialEmptyFormValues;
        }
        form.reset(dataToSet); // Resetea el formulario a los datos cargados/defaults
        setInitialDataForReset(dataToSet); // Guarda este estado para el reseteo al cancelar/cerrar
        setIsLoadingProfile(false);
      });
    }
  }, [open]);

  function onSubmit(data: BusinessProfileFormValues) {
    startTransition(async () => {
      const result = await upsertBusinessProfile(data)
      if (result.success) {
        toast.success(result.message || "Perfil guardado con éxito.")
        setInitialDataForReset(data); // Actualizar el estado de reseteo con los datos guardados
        onOpenChange(false) // Cerrar el modal después de enviar
      } else {
        toast.error(result.error || "Ocurrió un error al guardar.")
        if (result.issues) {
          console.error("Validation issues:", result.issues)
        }
      }
    })
  }

  const handleCloseDialog = (isOpen: boolean) => {
    if (isPending || isLoadingProfile) return; // Prevenir cerrar mientras carga
    onOpenChange(isOpen);
    if (!isOpen) {
      form.reset(initialDataForReset); // Resetear al estado guardado/inicial al cerrar con 'X' o clic fuera
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleCloseDialog}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Perfil del Negocio</DialogTitle>
          <DialogDescription>
            Actualiza la información de tu negocio. Estos datos se usarán para generar recibos.
            {(isPending || isLoadingProfile) && <Loader2 className="animate-spin h-4 w-4 ml-2 inline-block" />}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del negocio</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Tienda XYZ" {...field} disabled={isPending || isLoadingProfile} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sellerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendedor</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Juan Pérez" {...field} disabled={isPending || isLoadingProfile} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cuit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CUIT del negocio</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: 20-12345678-9" {...field} disabled={isPending || isLoadingProfile} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección comercial</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Av. Siempre Viva 742" {...field} disabled={isPending || isLoadingProfile} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ivaCondition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condición frente al IVA</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""} // Asegurar que el value no sea undefined para el Select
                    disabled={isPending || isLoadingProfile}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una condición" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Responsable Monotributo">Responsable Monotributo</SelectItem>
                      <SelectItem value="Responsable Inscripto">Responsable Inscripto</SelectItem>
                      <SelectItem value="Exento">Exento</SelectItem>
                      <SelectItem value="Consumidor Final">Consumidor Final</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (isPending || isLoadingProfile) return;
                  onOpenChange(false);
                  form.reset(initialDataForReset); // Resetear al estado guardado/inicial al cancelar
                }}
                disabled={isPending || isLoadingProfile}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || isLoadingProfile}>
                {isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                {isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
} 