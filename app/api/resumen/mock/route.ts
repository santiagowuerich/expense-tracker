import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Datos de ejemplo
    const data = [
      { tarjeta: "Visa", monto: 1250.75 },
      { tarjeta: "Mastercard", monto: 875.3 },
      { tarjeta: "American Express", monto: 2340.0 },
    ]

    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    console.error("Error al obtener el resumen:", error)
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 })
  }
}
