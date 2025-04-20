import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const body = await request.json()

    // Validación básica
    if (!body.id) {
      return NextResponse.json({ error: "ID del producto es requerido" }, { status: 400 })
    }

    // Obtener datos actuales del producto para comparar cambios
    const { data: productoActual, error: errorConsulta } = await supabase
      .from("productos")
      .select("costo_unit, precio_unit")
      .eq("id", body.id)
      .single()

    if (errorConsulta) {
      console.error("Error al consultar producto:", errorConsulta)
      return NextResponse.json({ error: "Error al consultar producto" }, { status: 500 })
    }

    // Preparar datos para actualización
    const updateData: any = {}

    if (body.costo_unit !== undefined) updateData.costo_unit = body.costo_unit
    if (body.precio_unit !== undefined) updateData.precio_unit = body.precio_unit
    if (body.stock_min !== undefined) updateData.stock_min = body.stock_min

    // Actualizar producto
    const { data, error } = await supabase.from("productos").update(updateData).eq("id", body.id).select()

    if (error) {
      console.error("Error al actualizar producto:", error)
      return NextResponse.json({ error: "Error al actualizar producto" }, { status: 500 })
    }

    // Registrar cambios de precio en historial
    const priceHistoryEntries = []

    // Verificar si cambió el costo unitario
    if (body.costo_unit !== undefined && body.costo_unit !== productoActual.costo_unit) {
      priceHistoryEntries.push({
        producto_id: body.id,
        tipo: "costo",
        precio: body.costo_unit,
      })
    }

    // Verificar si cambió el precio de venta
    if (body.precio_unit !== undefined && body.precio_unit !== productoActual.precio_unit) {
      priceHistoryEntries.push({
        producto_id: body.id,
        tipo: "venta",
        precio: body.precio_unit,
      })
    }

    // Insertar entradas de historial de precios si hay cambios
    if (priceHistoryEntries.length > 0) {
      const { error: historyError } = await supabase.from("price_history").insert(priceHistoryEntries)

      if (historyError) {
        console.error("Error al registrar historial de precios:", historyError)
        // No fallamos la operación principal, solo registramos el error
      }
    }

    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (error) {
    console.error("Error al procesar la solicitud:", error)
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 })
  }
}
