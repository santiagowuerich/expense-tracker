import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const compraId = url.searchParams.get("id")

    if (!compraId) {
      return NextResponse.json({ error: "ID de compra requerido" }, { status: 400 })
    }

    // Uso asíncrono de cookies()
    const cookieStore = await cookies()
    const supabase = await createClient(cookieStore)

    // Buscar el pago asociado a la compra
    const { data, error } = await supabase
      .from("pagos")
      .select(`
        id, monto, fecha, descripcion, tarjeta_id,
        tarjetas (alias)
      `)
      .eq("compra_id", compraId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error) {
      // Si es error de no encontrado, devolver 404
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 })
      }

      console.error("Error al buscar pago:", error)
      return NextResponse.json({ error: "Error al buscar pago" }, { status: 500 })
    }

    // Transformar los datos para incluir el nombre de la tarjeta
    const pagoTransformado = {
      id: data.id,
      monto: data.monto,
      fecha: data.fecha,
      descripcion: data.descripcion,
      tarjeta_id: data.tarjeta_id,
      // Simplificamos para evitar problemas de tipado, usando tipado explícito
      tarjeta_alias: data.tarjetas ? (data.tarjetas as any).alias : null,
    }

    return NextResponse.json(pagoTransformado)
  } catch (error: any) {
    console.error("Error al procesar la solicitud:", error)
    return NextResponse.json({ error: error.message || "Error al procesar la solicitud" }, { status: 500 })
  }
}
