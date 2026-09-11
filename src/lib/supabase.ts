import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  // En lugar de lanzar error, crear cliente con valores por defecto para evitar crashes
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
}

// Cliente para el navegador y operaciones públicas
export const supabase = createClient(supabaseUrl, supabaseKey)

// Cliente para el servidor (con permisos de admin)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. Please check your .env.local file.')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
