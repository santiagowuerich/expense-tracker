"use client"

// Importar createBrowserClient de @supabase/ssr
import { createBrowserClient as oryginalCreateBrowserClient} from '@supabase/ssr'

// Tipar explícitamente el cliente para mayor claridad
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('createClient (supabase-browser) solo debe llamarse en el lado del cliente.');
  }

  if (client) {
    return client;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Faltan variables de entorno de Supabase");
    throw new Error("Faltan variables de entorno de Supabase");
  }

  // Crear el cliente usando createBrowserClient de @supabase/ssr
  client = oryginalCreateBrowserClient(supabaseUrl, supabaseAnonKey);
  
  return client;
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
