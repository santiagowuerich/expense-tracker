"use client";

import { useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { PlusCircle, BarChart3, CreditCard, Package, FileBarChart, History, UserCircle, ShoppingCart } from "lucide-react"
import Link from "next/link"
import CompraConTarjetaDialog from "@/components/compra-con-tarjeta-dialog"
import AddCardDialog from "@/components/add-card-dialog"
import BusinessProfileModal from "@/components/business-profile-modal"
import { RealizarVentaButton } from "@/components/ventas/RealizarVentaButton"
import RealizarVentaButtonEsqueleto from "@/components/ventas/realizar-venta-button-esqueleto"
import { UserNav } from "@/components/user-nav"
import { useUser } from "@/lib/user-provider"

export default function Home() {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const { user, isLoading } = useUser()

  return (
    <div className="container flex flex-col items-center min-h-screen py-12 px-4 relative">
      <div className="absolute top-6 right-6">
        {isLoading ? (
          <div className="h-8 w-8 bg-muted rounded-full animate-pulse"></div>
        ) : (
          <UserNav user={user} />
        )}
      </div>

      <div className="max-w-md w-full space-y-8 pt-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Control de Gastos</h1>
          <p className="mt-2 text-muted-foreground">Registra y visualiza tus gastos de manera sencilla</p>
        </div>

        <div className="grid grid-cols-1 gap-6 mt-10">
          <CompraConTarjetaDialog>
            <Button size="lg" className="w-full h-16 text-lg rounded-2xl">
              <CreditCard className="mr-2 h-5 w-5" />
              Registrar Compra
            </Button>
          </CompraConTarjetaDialog>

          <Suspense fallback={<Button size="lg" className="w-full h-16 text-lg rounded-2xl"><ShoppingCart className="mr-2 h-5 w-5" />Cargando...</Button>}>
            <RealizarVentaButton className="w-full h-16 text-lg rounded-2xl">
              {/* Si RealizarVentaButton no acepta children o necesita un ícono específico, ajustar aquí */}
              {/* Por ejemplo, si el botón ya tiene su propio ícono y texto: */}
              {/* <ShoppingCart className="mr-2 h-5 w-5" /> Realizar Venta */}
            </RealizarVentaButton>
          </Suspense>

          <Link href="/resumen" className="w-full">
            <Button size="lg" variant="outline" className="w-full h-16 text-lg rounded-2xl">
              <BarChart3 className="mr-2 h-5 w-5" />
              Ver resumen
            </Button>
          </Link>

          <AddCardDialog>
            <Button size="lg" variant="secondary" className="w-full h-16 text-lg rounded-2xl">
              <CreditCard className="mr-2 h-5 w-5" />
              Agregar tarjeta
            </Button>
          </AddCardDialog>

          <Link href="/inventario" className="w-full">
            <Button size="lg" variant="outline" className="w-full h-16 text-lg rounded-2xl">
              <Package className="mr-2 h-5 w-5" />
              Inventario
            </Button>
          </Link>

          <Link href="/ventas" className="w-full">
            <Button size="lg" variant="outline" className="w-full h-16 text-lg rounded-2xl">
              <History className="mr-2 h-5 w-5" />
              Historial de Ventas
            </Button>
          </Link>

          <Link href="/reporte-inventario" className="w-full">
            <Button size="lg" variant="outline" className="w-full h-16 text-lg rounded-2xl">
              <FileBarChart className="mr-2 h-5 w-5" />
              Reportes
            </Button>
          </Link>
        </div>
      </div>

      <div className="fixed bottom-6 right-6">
        <Button
          variant="outline"
          size="lg"
          className="rounded-full h-16 w-16 p-0 flex items-center justify-center shadow-lg"
          onClick={() => setIsProfileModalOpen(true)}
          aria-label="Mi Perfil"
        >
          <UserCircle className="h-8 w-8" />
        </Button>
      </div>

      <BusinessProfileModal
        open={isProfileModalOpen}
        onOpenChange={setIsProfileModalOpen}
      />
    </div>
  )
}
