import { useQuery } from '@tanstack/react-query';
import { getBusinessProfile } from '@/lib/actions/business-profile.actions';
import type { PerfilEmpresa } from '@/lib/types/venta.types';

// Clave para la query de React Query
export const RQ_KEY_PERFIL_EMPRESA = ['perfilEmpresa'];

async function fetchPerfilEmpresa(): Promise<PerfilEmpresa | null> {
  const result = await getBusinessProfile();
  if (result.error || !result.data) {
    // Puedes manejar el error de forma más específica si es necesario
    // o simplemente devolver null si el perfil no existe o hay un error.
    console.error('Error fetching business profile for PDF:', result.error);
    return null;
  }
  // Los datos de getBusinessProfile ya están mapeados a camelCase
  return result.data as PerfilEmpresa; 
}

export function usePerfilEmpresa() {
  return useQuery<PerfilEmpresa | null, Error>({
    queryKey: RQ_KEY_PERFIL_EMPRESA,
    queryFn: fetchPerfilEmpresa,
    staleTime: Infinity, // Los datos del perfil de la empresa raramente cambian
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });
} 