'use client';

import { createBrowserClient } from '@supabase/ssr';

// Creamos un cliente de Supabase para el lado del cliente
export function createClientSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Esta función es un atajo para obtener el cliente de Supabase en componentes cliente
export const supabase = createClientSupabaseClient(); 