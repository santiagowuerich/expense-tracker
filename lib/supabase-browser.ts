"use client"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

let client: ReturnType<typeof createSupabaseClient> | null = null

export function createClient() {
  if (client) return client

  // Usar las variables de entorno disponibles a través de process.env
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Faltan variables de entorno de Supabase")
    throw new Error("Faltan variables de entorno de Supabase")
  }

  client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    db: {
      schema: "public",
    },
  })

  return client
}

// Función para verificar si las tablas existen
export async function verificarTablas() {
  const supabase = createClient()

  try {
    console.log("Verificando si existe la tabla tarjetas...")

    // Intentar hacer una consulta simple a la tabla tarjetas
    const { data, error } = await supabase.from("tarjetas").select("id").limit(1)

    if (error) {
      console.error("Error detallado al verificar tabla tarjetas:", JSON.stringify(error, null, 2))
      return false
    }

    console.log("Tabla tarjetas verificada correctamente:", data)
    return true
  } catch (error) {
    console.error("Error al verificar tablas:", error)
    return false
  }
}
