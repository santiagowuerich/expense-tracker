'use server'

import { cookies } from 'next/headers'
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

// ID fijo para el perfil único. Considerar si esto debería estar vinculado a un user_id
// si la aplicación es multiusuario con perfiles de negocio individuales.
const PROFILE_ID = 1; 

export async function upsertBusinessProfile(data: BusinessProfileFormValues) {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error("Error de autenticación al guardar perfil de negocio:", authError)
    return { success: false, error: "Usuario no autenticado." }
  }

  const validatedData = businessProfileSchema.safeParse(data)
  if (!validatedData.success) {
    console.error("Error de validación de datos:", validatedData.error.flatten().fieldErrors)
    return { success: false, error: "Datos inválidos.", issues: validatedData.error.issues }
  }

  const profileData = {
    id: PROFILE_ID, 
    // user_id: user.id, // Descomentar y usar si la tabla business_profile tiene user_id
    business_name: validatedData.data.businessName,
    seller_name: validatedData.data.sellerName,
    cuit: validatedData.data.cuit,
    address: validatedData.data.address,
    iva_condition: validatedData.data.ivaCondition,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('business_profile')
    .upsert(profileData, { onConflict: 'id' })

  if (error) {
    console.error("Error al guardar el perfil del negocio en Supabase:", error)
    return { success: false, error: `Error al guardar: ${error.message}` }
  }

  revalidatePath('/')
  return { success: true, message: "Perfil del negocio guardado con éxito." }
}

export async function getBusinessProfile() {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error("Error de autenticación al obtener perfil de negocio:", authError)
    // Si no hay usuario, no se debería poder acceder al perfil, incluso si es un ID fijo.
    // Esto depende de la RLS de la tabla 'business_profile'.
    return { data: null, error: "Usuario no autenticado." }
  }

  const { data, error } = await supabase
    .from('business_profile')
    .select('business_name, seller_name, cuit, address, iva_condition')
    .eq('id', PROFILE_ID) 
    // .eq('user_id', user.id) // Descomentar si la tabla tiene user_id y se filtra por él
    .single() // Restaurar .single()

  if (error && error.code !== 'PGRST116') { // PGRST116: No rows found (lo cual es ok para un perfil nuevo)
    console.error("Error al obtener el perfil del negocio desde Supabase:", error)
    return { data: null, error: `Error al obtener el perfil: ${error.message}` }
  }
  
  // Si data es null (PGRST116 o no hay perfil para este ID), se devuelve data: null
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

  // Si no hay datos y no hubo error (o fue PGRST116), significa que el perfil no existe aún.
  return { data: null, error: null } 
} 