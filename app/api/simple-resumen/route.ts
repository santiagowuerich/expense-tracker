import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { cookies } from 'next/headers'

export async function GET() {
  try {
    // Uso asíncrono de cookies()
    const cookieStore = await cookies()
    const supabase = await createClient(cookieStore)

    // Consulta simple a la tabla tarjetas
    const { data, error } = await supabase.from("tarjetas").select("id, alias").limit(5)

    if (error) {
      throw error
    }

    return NextResponse.json({
      tarjetas: data,
      success: true,
    })
  } catch (error) {
    console.error("Error en la consulta simple:", error)
    return NextResponse.json(
      {
        error: "Error al consultar datos",
        details: error instanceof Error ? error.message : "Unknown error",
        success: false,
      },
      { status: 500 },
    )
  }
}
