'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../supabase-server'
import { z } from 'zod'

const emailSchema = z.string().email({ message: 'Correo electrónico inválido.' })
const passwordSchema = z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' })

export async function signUpUser(prevState: any, formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const emailValidation = emailSchema.safeParse(email)
  if (!emailValidation.success) {
    return { message: emailValidation.error.errors[0].message, field: 'email' }
  }

  const passwordValidation = passwordSchema.safeParse(password)
  if (!passwordValidation.success) {
    return { message: passwordValidation.error.errors[0].message, field: 'password' }
  }

  const { data, error } = await supabase.auth.signUp({
    email: emailValidation.data,
    password: passwordValidation.data,
    options: {
      // Opcional: puedes redirigir aquí o desde el middleware/página
      // emailRedirectTo: '/confirm',
    },
  })

  if (error) {
    console.error('Error en signUpUser:', error)
    if (error.message.includes('User already registered')) {
        return { message: 'Este correo electrónico ya está registrado.', field: 'email' }
    }
    return { message: `Error al registrar: ${error.message}`, field: 'general' }
  }

  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { message: 'Este correo electrónico ya está registrado, pero no confirmado.', field: 'email' };
  }

  // Supabase puede requerir confirmación por correo electrónico.
  // Si es así, el usuario no estará logueado inmediatamente.
  // Puedes mostrar un mensaje para que revisen su correo.
  revalidatePath('/', 'layout') // Revalida todo el layout para reflejar el cambio de estado (si aplica)
  // Considera redirigir a una página específica post-registro o mostrar mensaje.
  // Por ahora, redirigimos a login, asumiendo que se necesita confirmación de email
  // o que el usuario debe loguearse explícitamente.
  if (data.session) {
    // Si hay sesión (ej. auto-confirm activado y usuario logueado)
    redirect('/') // O a donde quieras después del login
  } else {
    // Si no hay sesión (ej. se requiere confirmación de email)
    return { message: '¡Registro exitoso! Por favor, revisa tu correo para confirmar tu cuenta.', field: 'success' }
  }
}

export async function signInUser(prevState: any, formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const emailValidation = emailSchema.safeParse(email)
  if (!emailValidation.success) {
    return { message: emailValidation.error.errors[0].message, field: 'email' }
  }

  const passwordValidation = passwordSchema.safeParse(password)
  // No validamos longitud aquí, solo presencia, Supabase lo hará.
  if (!passwordValidation.success && passwordValidation.error.errors[0].code !== 'too_small') {
    return { message: passwordValidation.error.errors[0].message, field: 'password' }
  }
  if (!password) {
    return { message: "La contraseña es requerida.", field: 'password' };
  }


  const { error, data } = await supabase.auth.signInWithPassword({
    email: emailValidation.data,
    password: password, // usamos la contraseña sin validar longitud aquí
  })

  if (error) {
    console.error('Error en signInUser:', error)
    if (error.message.includes('Invalid login credentials')) {
        return { message: 'Credenciales de inicio de sesión inválidas.', field: 'general' }
    } else if (error.message.includes('Email not confirmed')) {
        return { message: 'Por favor, confirma tu correo electrónico antes de iniciar sesión.', field: 'email' }
    }
    return { message: `Error al iniciar sesión: ${error.message}`, field: 'general' }
  }
  
  // Si el login es exitoso, Supabase maneja la cookie.
  // Revalidamos el path y redirigimos.
  revalidatePath('/', 'layout')
  redirect('/') // Redirige a la página principal o dashboard
}

export async function signOutUser() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
} 