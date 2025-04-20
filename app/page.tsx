import { Button } from "@/components/ui/button"
import { PlusCircle, BarChart3, CreditCard, Package, FileBarChart } from "lucide-react"
import Link from "next/link"
import CompraConTarjetaDialog from "@/components/compra-con-tarjeta-dialog"
import AddCardDialog from "@/components/add-card-dialog"

export default function Home() {
  return (
    <div className="container flex flex-col items-center justify-center min-h-screen py-12 px-4">
      <div className="max-w-md w-full space-y-8">
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

          <Link href="/reporte-inventario" className="w-full">
            <Button size="lg" variant="outline" className="w-full h-16 text-lg rounded-2xl">
              <FileBarChart className="mr-2 h-5 w-5" />
              Reportes
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
