import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Verificar variables de entorno (sin mostrar valores completos por seguridad)
    const envStatus = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
    }

    return NextResponse.json({
      envStatus,
      success: true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error al verificar variables de entorno",
        details: error instanceof Error ? error.message : "Unknown error",
        success: false,
      },
      { status: 500 },
    )
  }
}
