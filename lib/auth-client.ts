'use client';

import { supabase } from './supabase-client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

/**
 * Inicia sesión con email y contraseña (cliente)
 */
export async function loginWithEmailClient(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    toast.error(error.message);
    return { data, error };
  }

  toast.success('Has iniciado sesión correctamente');
  return { data, error: null };
}

/**
 * Registra un nuevo usuario con email y contraseña (cliente)
 */
export async function registerWithEmailClient(email: string, password: string, name: string) {
  // Registro del usuario en Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  });

  if (error) {
    toast.error(error.message);
    return { data, error };
  }

  // Si el registro es exitoso, crear un perfil en la tabla de usuarios
  if (data.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: data.user.id,
          name,
          email,
        },
      ]);

    if (profileError) {
      console.error('Error al crear el perfil:', profileError);
      // Incluso si falla la creación del perfil, el usuario ya está registrado en Auth
    }
  }

  toast.success('Registro exitoso. Ahora puedes iniciar sesión.');
  return { data, error: null };
}

/**
 * Cierra la sesión del usuario actual (cliente)
 */
export async function signOutClient() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    toast.error(error.message);
    return { error };
  }
  
  toast.info('Has cerrado sesión');
  return { error: null };
}

/**
 * Hook personalizado para cerrar sesión con redirección
 */
export function useSignOut() {
  const router = useRouter();
  
  return async () => {
    await signOutClient();
    router.push('/auth/login');
    router.refresh();
  };
} 