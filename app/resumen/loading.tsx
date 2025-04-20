import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function Loading() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center mb-8">
        <Button variant="ghost" size="sm" disabled className="mr-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold text-primary">Resumen de Gastos</h1>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-[120px] w-full rounded-2xl" />
        <Skeleton className="h-[120px] w-full rounded-2xl" />
        <Skeleton className="h-[120px] w-full rounded-2xl" />
        <Skeleton className="h-[300px] w-full rounded-2xl" />
      </div>
    </div>
  )
}
