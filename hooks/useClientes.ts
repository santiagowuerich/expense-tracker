import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase-browser';
import type { Cliente } from '@/types/venta';

// Hook para obtener lista de clientes con búsqueda opcional
export function useClientes(searchTerm?: string) {
  return useQuery<Cliente[], Error>({
    queryKey: ['clientes', searchTerm],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('clientes')
        .select('*')
        .order('nombre', { ascending: true });

      if (searchTerm && searchTerm.trim() !== '') {
        const cleanedSearchTerm = searchTerm.trim();
        // Filtrar por nombre o dni_cuit usando ilike
        query = query.or(`nombre.ilike.%${cleanedSearchTerm}%,dni_cuit.ilike.%${cleanedSearchTerm}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error en Supabase (useClientes):", error);
        throw new Error(error.message);
      }
      
      // Filtrar clientes duplicados por dni_cuit
      const clientesFiltrados: Cliente[] = [];
      const dniCuitSet = new Set<string>();
      
      (data || []).forEach(cliente => {
        if (!dniCuitSet.has(cliente.dni_cuit)) {
          dniCuitSet.add(cliente.dni_cuit);
          clientesFiltrados.push(cliente);
        }
      });
      
      return clientesFiltrados as Cliente[];
    }
  });
}

// Hook para obtener un cliente por ID
export function useClienteById(clienteId: string | null) {
  return useQuery<Cliente | null, Error>({
    queryKey: ['cliente', clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      
      const supabase = createClient();
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .single();

      if (error) {
        console.error("Error en Supabase (useClienteById):", error);
        throw new Error(error.message);
      }
      
      return data as Cliente;
    },
    enabled: !!clienteId // Solo ejecutar cuando hay un ID
  });
}

// Hook para crear un nuevo cliente
export function useCreateCliente() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (cliente: Omit<Cliente, 'id'>) => {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('clientes')
        .insert([cliente])
        .select()
        .single();
        
      if (error) {
        console.error("Error al crear cliente:", error);
        throw new Error(error.message);
      }
      
      return data as Cliente;
    },
    onSuccess: () => {
      // Invalidar la caché de clientes para actualizar las listas
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    }
  });
}

// Hook para actualizar un cliente existente
export function useUpdateCliente() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (cliente: Cliente) => {
      if (!cliente.id) {
        throw new Error("Se requiere el ID del cliente para actualizarlo");
      }
      
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('clientes')
        .update({
          nombre: cliente.nombre,
          dni_cuit: cliente.dni_cuit,
          direccion: cliente.direccion || null,
          ciudad: cliente.ciudad || null,
          codigo_postal: cliente.codigo_postal || null,
          telefono: cliente.telefono || null,
          email: cliente.email || null
        })
        .eq('id', cliente.id)
        .select()
        .single();
        
      if (error) {
        console.error("Error al actualizar cliente:", error);
        throw new Error(error.message);
      }
      
      return data as Cliente;
    },
    onSuccess: (data) => {
      // Invalidar las consultas afectadas
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cliente', data.id] });
    }
  });
} 