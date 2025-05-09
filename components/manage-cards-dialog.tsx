"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { createClient } from "@/lib/supabase-browser"
import { queryClient } from "@/lib/queries"
import { useQuery } from "@tanstack/react-query"
import { Pencil, Trash2, Plus, AlertCircle, Calendar, Clock } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import AddCardDialog from "./add-card-dialog"
import EditCardDialog from "./edit-card-dialog"

interface Tarjeta {
  id: string
  alias: string
  cierre_dia: number
  venc_dia: number
}

export default function ManageCardsDialog({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [selectedCard, setSelectedCard] = useState<Tarjeta | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeletingCard, setIsDeletingCard] = useState(false)
  const { toast } = useToast()

  // Consultar tarjetas desde Supabase
  const {
    data: tarjetas = [],
    isLoading: isLoadingTarjetas,
    error: errorTarjetas,
    refetch: refetchTarjetas,
  } = useQuery<Tarjeta[]>({
    queryKey: ["tarjetas"],
    queryFn: async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("tarjetas")
          .select("id, alias, cierre_dia, venc_dia")
          .order("alias")

        if (error) {
          throw new Error(error.message)
        }

        return (data as Tarjeta[]) || []
      } catch (error: any) {
        console.error("Error al cargar tarjetas:", error)
        toast({
          title: "Error al cargar tarjetas",
          description: error.message || "No se pudieron cargar las tarjetas",
          variant: "destructive",
        })
        return []
      }
    },
    enabled: open,
  })

  const handleDeleteCard = async () => {
    if (!selectedCard) return

    setIsDeletingCard(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("tarjetas")
        .delete()
        .eq("id", selectedCard.id)

      if (error) {
        throw new Error(error.message || "Error al eliminar la tarjeta")
      }

      toast({
        title: "Tarjeta eliminada",
        description: "La tarjeta ha sido eliminada exitosamente",
      })

      queryClient.invalidateQueries({ queryKey: ["tarjetas"] })
      queryClient.invalidateQueries({ queryKey: ["resumen"] })
      
      setShowDeleteDialog(false)
      setSelectedCard(null)
    } catch (error: any) {
      console.error("Error al eliminar tarjeta:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la tarjeta",
        variant: "destructive",
      })
    } finally {
      setIsDeletingCard(false)
    }
  }

  // Renderizado de tarjetas móviles
  const renderMobileCards = () => {
    return (
      <div className="space-y-4">
        {tarjetas.map((tarjeta) => (
          <Card key={tarjeta.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="p-4 bg-primary/5">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-base">{tarjeta.alias}</h3>
                  <div className="flex space-x-1">
                    <EditCardDialog 
                      tarjeta={tarjeta}
                      onSuccess={() => refetchTarjetas()}
                    >
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Editar</span>
                      </Button>
                    </EditCardDialog>
                    
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setSelectedCard(tarjeta)
                        setShowDeleteDialog(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                      <span className="sr-only">Eliminar</span>
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Día de cierre: <strong>{tarjeta.cierre_dia}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Día de vencimiento: <strong>{tarjeta.venc_dia}</strong></span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Renderizado de tabla desktop
  const renderDesktopTable = () => {
    return (
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alias</TableHead>
              <TableHead className="text-center">Día de Cierre</TableHead>
              <TableHead className="text-center">Día de Vencimiento</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tarjetas.map((tarjeta) => (
              <TableRow key={tarjeta.id}>
                <TableCell className="font-medium">{tarjeta.alias}</TableCell>
                <TableCell className="text-center">{tarjeta.cierre_dia}</TableCell>
                <TableCell className="text-center">{tarjeta.venc_dia}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    <EditCardDialog 
                      tarjeta={tarjeta}
                      onSuccess={() => refetchTarjetas()}
                    >
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Editar</span>
                      </Button>
                    </EditCardDialog>
                    
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setSelectedCard(tarjeta)
                        setShowDeleteDialog(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                      <span className="sr-only">Eliminar</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <>
      <Dialog 
        open={open} 
        onOpenChange={(newOpen) => {
          setOpen(newOpen)
          if (newOpen) {
            refetchTarjetas()
          }
        }}
      >
        <DialogTrigger asChild>{children || <Button>Gestionar Tarjetas</Button>}</DialogTrigger>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestionar Tarjetas</DialogTitle>
            <DialogDescription>
              Agrega, modifica o elimina tus tarjetas de crédito/débito.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex justify-end mb-4">
              <AddCardDialog>
                <Button size="sm" className="px-3 py-2 h-9">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Agregar Tarjeta</span>
                  <span className="sm:hidden">Agregar</span>
                </Button>
              </AddCardDialog>
            </div>

            {isLoadingTarjetas ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : errorTarjetas ? (
              <div className="p-4 border border-destructive/50 rounded-md bg-destructive/10 text-destructive flex items-center">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                <p className="text-sm">Error al cargar las tarjetas. Por favor, intenta nuevamente.</p>
              </div>
            ) : tarjetas.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No hay tarjetas registradas.</p>
                <p className="text-sm mt-2">Haz clic en "Agregar Tarjeta" para comenzar.</p>
              </div>
            ) : (
              <>
                {/* Mostrar tarjetas en vista móvil */}
                <div className="md:hidden">
                  {renderMobileCards()}
                </div>
                
                {/* Mostrar tabla en vista desktop */}
                <div className="hidden md:block">
                  {renderDesktopTable()}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-[90vw] w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la tarjeta "{selectedCard?.alias}". Esta acción no se puede deshacer.
              Ten en cuenta que si hay pagos asociados a esta tarjeta, también se eliminarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={isDeletingCard} className="mt-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteCard()
              }}
              disabled={isDeletingCard}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeletingCard ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
} 