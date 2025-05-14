import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Crear cliente de Supabase con cookies de la solicitud
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Verificar si hay sesión
  const { data: { session } } = await supabase.auth.getSession();

  // Redirigir a login si no hay sesión y la ruta no es de autenticación
  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth');
  
  if (!session && !isAuthRoute) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Redirigir al dashboard si ya hay sesión y estamos en rutas de autenticación
  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

// Configurar qué rutas se procesan con el middleware
export const config = {
  matcher: [
    // Aplicar a todas las rutas excepto a las rutas de autenticación y API que comienzan con /auth o /_next
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}; 