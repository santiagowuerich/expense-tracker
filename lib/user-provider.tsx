'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
// import { supabase } from '@/lib/supabase-client'; // Comentar o eliminar esta línea
import { createClient } from '@/lib/supabase-browser'; // Importar la función createClient
import { toast } from 'sonner';

// Crear un contexto para el usuario
export const UserContext = createContext<{
  user: User | null;
  isLoading: boolean;
  error: Error | null;
}>({
  user: null,
  isLoading: true,
  error: null,
});

// Hook personalizado para acceder al contexto
export const useUser = () => useContext(UserContext);

// Provider para envolver la aplicación y proporcionar el usuario
export default function UserProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const supabase = createClient(); // Obtener la instancia del cliente aquí

    // Obtener el usuario actual
    const getCurrentUser = async () => {
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error('Error al obtener el usuario:', error);
        setError(error as Error);
        toast.error('Error al obtener la información del usuario');
      } finally {
        setIsLoading(false);
      }
    };

    // Invocar la función para obtener el usuario
    getCurrentUser();

    // Suscribirse a cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (event === 'SIGNED_IN') {
          toast.success('Has iniciado sesión correctamente');
        }
        if (event === 'SIGNED_OUT') {
          toast.info('Has cerrado sesión');
        }
      }
    );

    // Limpiar la suscripción al desmontar
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, isLoading, error }}>
      {children}
    </UserContext.Provider>
  );
} 