"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { ArrowLeft, RefreshCw } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Registrar el error en un servicio de análisis o monitoreo
    console.error("Error en la página de resumen:", error)
  }, [error])

  const router = useRouter()

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center mb-8">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="mr-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold text-primary">Resumen de Gastos</h1>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>Ocurrió un error al cargar el resumen. Por favor, intenta nuevamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Detalles del error: {error.message || "Error desconocido"}</p>
        </CardContent>
        <CardFooter className="flex justify-end space-x-4">
          <Button variant="outline" onClick={() => router.push("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al inicio
          </Button>
          <Button onClick={() => reset()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Intentar nuevamente
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
