import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export async function GET() {
  try {
    const supabase = createClient()

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
