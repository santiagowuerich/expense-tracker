import { createServerClient, type CookieOptions } from '@supabase/ssr'
// No es necesario importar ReadonlyRequestCookies si usamos un tipo más genérico o 'any'
// para el parámetro cookieStore, ya que el objeto real de next/headers' cookies()
// en el contexto de Server Actions/Route Handlers sí tiene .set().

// Función única para crear el cliente Supabase en el servidor 
// (para uso en API Routes, Server Actions, y Server Components que leen cookies)
export function createClient(cookieStore: any) { // Usar 'any' para simplificar el tipado aquí
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
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
