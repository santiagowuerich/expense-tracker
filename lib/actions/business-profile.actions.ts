'use server'

import { createClient } from '../supabase-server'
import { revalidatePath } from 'next/cache'
import * as z from 'zod'

// Esquema de validación (duplicado del modal, idealmente se compartiría desde un archivo común)
const businessProfileSchema = z.object({
  businessName: z.string().min(1, "El nombre del negocio es obligatorio."),
  sellerName: z.string().min(1, "El nombre del vendedor es obligatorio."),
  cuit: z.string().min(1, "El CUIT es obligatorio."),
  address: z.string().min(1, "La dirección comercial es obligatoria."),
  ivaCondition: z.string().min(1, "La condición frente al IVA es obligatoria."),
})

type BusinessProfileFormValues = z.infer<typeof businessProfileSchema>

const PROFILE_ID = 1; // ID fijo para el perfil único

export async function upsertBusinessProfile(data: BusinessProfileFormValues) {
  const supabase = createClient()

  // Ya no se necesita autenticación para esta acción específica
  // const {
  //   data: { user },
  //   error: authError,
  // } = await supabase.auth.getUser()
  // if (authError || !user) { ... }

  const validatedData = businessProfileSchema.safeParse(data)
  if (!validatedData.success) {
    console.error("Error de validación de datos:", validatedData.error)
    return { success: false, error: "Datos inválidos.", issues: validatedData.error.issues }
  }

  const profileData = {
    id: PROFILE_ID, // Usar el ID fijo
    business_name: validatedData.data.businessName,
    seller_name: validatedData.data.sellerName,
    cuit: validatedData.data.cuit,
    address: validatedData.data.address,
    iva_condition: validatedData.data.ivaCondition,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('business_profile')
    .upsert(profileData, { onConflict: 'id' }) // Conflicto en 'id'

  if (error) {
    console.error("Error al guardar el perfil del negocio en Supabase:", error)
    return { success: false, error: `Error al guardar: ${error.message}` }
  }

  revalidatePath('/')
  return { success: true, message: "Perfil del negocio guardado con éxito." }
}

export async function getBusinessProfile() {
  const supabase = createClient()

  // Ya no se necesita autenticación para esta acción específica

  const { data, error } = await supabase
    .from('business_profile')
    .select('business_name, seller_name, cuit, address, iva_condition')
    .eq('id', PROFILE_ID) // Seleccionar por el ID fijo
    .single()

  if (error && error.code !== 'PGRST116') { 
    console.error("Error al obtener el perfil del negocio desde Supabase:", error)
    return { data: null, error: `Error al obtener el perfil: ${error.message}` }
  }
  
  if (data) {
    return {
      data: {
        businessName: data.business_name,
        sellerName: data.seller_name,
        cuit: data.cuit,
        address: data.address,
        ivaCondition: data.iva_condition,
      },
      error: null,
    }
  }

  return { data: null, error: null } 
} 