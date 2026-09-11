import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ENV_ADMIN_ID, normalizeUsername } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

/** Usuario de la sesión actual. La identidad sale del header que inyecta el middleware. */
export async function GET(request: NextRequest) {
  try {
    const username = normalizeUsername(request.headers.get('x-admin-user') || '')
    const userId = request.headers.get('x-admin-user-id') || ''

    if (!username) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Acceso de emergencia por variables de entorno: no está en la tabla.
    if (userId === ENV_ADMIN_ID) {
      return NextResponse.json({
        username,
        displayName: 'Administrador',
        mustChangePassword: false,
        canChangePassword: false,
      })
    }

    const { data: user } = await supabaseAdmin
      .from('admin_users')
      .select('username, display_name, must_change_password')
      .eq('username', username)
      .maybeSingle()

    return NextResponse.json({
      username,
      displayName: user?.display_name || username,
      mustChangePassword: Boolean(user?.must_change_password),
      canChangePassword: true,
    })
  } catch (error) {
    console.error('Error en /api/admin/auth/me:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
