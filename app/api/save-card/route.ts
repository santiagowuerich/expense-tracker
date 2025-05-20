import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    // Uso asíncrono de cookies()
    const cookieStore = await cookies()
    const supabase = await createClient(cookieStore)
    const body = await request.json()

    // Validación básica
    if (!body.alias || !body.cierre_dia || !body.venc_dia) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }

    // Insertar en Supabase
    const { data, error } = await supabase.from("tarjetas").insert({
      alias: body.alias,
      cierre_dia: body.cierre_dia,
      venc_dia: body.venc_dia,
    })

    if (error) {
      console.error("Error al guardar la tarjeta:", error)
      return NextResponse.json({ error: "Error al guardar la tarjeta" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error("Error al procesar la solicitud:", error)
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 })
  }
}
