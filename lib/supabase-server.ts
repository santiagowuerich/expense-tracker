import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Función única para crear el cliente Supabase en el servidor 
// (para uso en API Routes, Server Actions, y Server Components que leen cookies)
export async function createClient(cookieStore?: any) {
  // Si no se proporciona cookieStore, intentamos obtenerlo aquí de forma asíncrona
  if (!cookieStore) {
    try {
      cookieStore = await cookies();
    } catch (error) {
      // Si falla, es probable que estemos fuera del contexto de un request
      console.warn('Error al intentar obtener cookies automáticamente. Asegúrate de pasar cookieStore explícitamente para Route Handlers.');
      
      // Proporcionamos un store vacío para evitar errores
      cookieStore = {
        get: () => null,
        set: () => {},
        remove: () => {},
      };
    }
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = cookieStore.get(name);
          return cookie?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {
            // Silenciar errores, el middleware debería ser el principal responsable
            // de la persistencia de cookies de sesión.
            if (process.env.NODE_ENV === 'development') {
              // console.warn(`Supabase client: error setting cookie '${name}'`, error);
            }
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            // Supabase/ssr espera que remove actúe como set con valor vacío y maxAge 0
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              // console.warn(`Supabase client: error removing cookie '${name}'`, error);
            }
          }
        },
      },
    }
  );
}
