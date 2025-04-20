import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Datos de ejemplo simplificados
    const data = [
      { tarjeta: "Visa", monto: 1250.75 },
      { tarjeta: "Mastercard", monto: 875.3 },
      { tarjeta: "American Express", monto: 2340.0 },
    ]

    // Calcular el total
    const total = data.reduce((sum, item) => sum + item.monto, 0)

    return NextResponse.json(
      {
        data,
        total,
        success: true,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Error en la ruta de resumen:", error)
    return NextResponse.json(
      {
        error: "Error al procesar la solicitud",
        details: error instanceof Error ? error.message : "Unknown error",
        success: false,
      },
      { status: 500 },
    )
  }
}
