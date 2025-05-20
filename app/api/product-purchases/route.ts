import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    // Uso asíncrono de cookies()
    const cookieStore = await cookies()
    const supabase = await createClient(cookieStore)
    
    const { data, error } = await supabase
      .from("compras")
      .select("created_at, costo_unit, cantidad, restante")
      .eq("producto_id", id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error al obtener compras:", error)
      return NextResponse.json({ error: "Error al obtener compras" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error al procesar la solicitud:", error)
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 })
  }
}
