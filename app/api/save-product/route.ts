import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const body = await request.json()

    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser()
    
    // Verificar que el usuario esté autenticado
    if (!user) {
      return NextResponse.json({ error: "Usuario no autenticado" }, { status: 401 })
    }

    // Validación básica
    if (!body.nombre) {
      return NextResponse.json({ error: "El nombre del producto es requerido" }, { status: 400 })
    }

    // Preparar los datos para inserción
    const productoData = {
      nombre: body.nombre,
      sku: body.sku || null,
      stock: body.stock || 0,
      costo_unit: body.costo_unit || null,
      precio_unit: body.precio_unit || null,
      stock_min: body.stock_min || 0,
      categoria_id: body.categoria_id || null,
      user_id: user.id
    }

    console.log("Guardando producto con datos:", productoData)

    // Insertar en Supabase
    const { data: producto, error } = await supabase.from("productos").insert(productoData).select()

    if (error) {
      console.error("Error al guardar el producto:", error)
      return NextResponse.json({ error: "Error al guardar el producto" }, { status: 500 })
    }

    // Si se especificó un costo unitario, registrar en el historial de precios
    if (body.costo_unit) {
      const { error: historyError } = await supabase.from("price_history").insert({
        producto_id: producto[0].id,
        tipo: "costo",
        precio: body.costo_unit,
        user_id: user.id
      })

      if (historyError) {
        console.error("Error al registrar historial de precios:", historyError)
        // No fallamos la operación principal, solo registramos el error
      }
    }

    // Si se especificó un precio de venta, registrar en el historial de precios
    if (body.precio_unit) {
      const { error: historyError } = await supabase.from("price_history").insert({
        producto_id: producto[0].id,
        tipo: "venta",
        precio: body.precio_unit,
        user_id: user.id
      })

      if (historyError) {
        console.error("Error al registrar historial de precios:", historyError)
        // No fallamos la operación principal, solo registramos el error
      }
    }

    return NextResponse.json({ success: true, data: producto }, { status: 201 })
  } catch (error) {
    console.error("Error al procesar la solicitud:", error)
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 })
  }
}
