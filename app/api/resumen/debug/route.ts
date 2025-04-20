import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Datos de ejemplo para depuración
    const data = {
      tarjetas: [
        { id: "1", alias: "Visa", cierre_dia: 15, venc_dia: 20 },
        { id: "2", alias: "Mastercard", cierre_dia: 10, venc_dia: 15 },
      ],
      pagos: [
        {
          id: "1",
          tarjeta_id: "1",
          monto: 1250.75,
          fecha: new Date().toISOString(),
          descripcion: "Compra en supermercado",
          payment_method: "tarjeta",
        },
        {
          id: "2",
          tarjeta_id: "2",
          monto: 875.3,
          fecha: new Date().toISOString(),
          descripcion: "Pago de servicios",
          payment_method: "tarjeta",
        },
      ],
      totales: {
        totalActual: 2126.05,
        totalNext: 1250.75,
        totalFuturo: 0,
      },
      categorias: [
        { nombre: "Alimentación", total: 1250.75 },
        { nombre: "Servicios", total: 875.3 },
      ],
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error en la ruta de depuración:", error)
    return NextResponse.json({ error: "Error en la ruta de depuración" }, { status: 500 })
  }
}
