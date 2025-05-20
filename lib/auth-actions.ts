'use server';

// import { createServerClient } from '@supabase/ssr'; // No se necesita si usamos el centralizado
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
// import { type CookieOptions } from '@supabase/ssr'; // No se necesita directamente aquí
import { createClient } from './supabase-server'; // Importar el cliente centralizado

/**
 * Inicia sesión con email y contraseña
 */
export async function loginWithEmail(email: string, password: string) {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
}

/**
 * Registra un nuevo usuario con email y contraseña
 */
export async function registerWithEmail(email: string, password: string, name: string) {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  
  // Registro del usuario en Supabase Auth
  const authResponse = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  });

  // Si el registro es exitoso, crear un perfil en la tabla de usuarios
  if (authResponse.data.user && !authResponse.error) {
    const { error } = await supabase
      .from('profiles')
      .insert([
        {
          id: authResponse.data.user.id,
          name,
          email,
        },
      ]);

    if (error) {
      console.error('Error al crear el perfil:', error);
    }
  }

  return authResponse;
}

/**
 * Cierra la sesión del usuario actual
 */
export async function signOut() {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  await supabase.auth.signOut();
  redirect('/auth/login');
}

/**
 * Obtiene el usuario actual
 */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Middleware para verificar si hay un usuario autenticado
 * Redirige a la página de login si no hay sesión
 */
export async function requireAuth() {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    redirect('/auth/login');
  }
  
  return session.user;
} 