import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ENV_ADMIN_ID, normalizeUsername } from '@/lib/adminAuth'
import { hashPassword, validatePasswordStrength, verifyPassword } from '@/lib/passwordHash'
import { logAdminAction } from '@/lib/activityLog'

export const dynamic = 'force-dynamic'

/**
 * Cambio de contraseña del usuario en sesión: exige la contraseña actual.
 *
 * La identidad NO viene del body: se toma del header que inyecta el middleware a partir
 * de la cookie firmada. Así nadie puede cambiarle la contraseña a otro usuario.
 * El rate limit vive en el middleware (ver RATE_LIMIT_RULES).
 */
export async function POST(request: NextRequest) {
  try {
    const username = normalizeUsername(request.headers.get('x-admin-user') || '')
    const userId = request.headers.get('x-admin-user-id') || ''

    if (!username) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // El usuario de emergencia por variables de entorno no vive en la BD: su contraseña
    // se cambia en el servidor (env), no desde el panel.
    if (userId === ENV_ADMIN_ID) {
      return NextResponse.json(
        {
          error:
            'Este acceso está definido por variables de entorno. Su contraseña se cambia en el servidor.',
        },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = await request.json()

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const strengthError = validatePasswordStrength(newPassword)
    if (strengthError) {
      return NextResponse.json({ error: strengthError }, { status: 400 })
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe ser distinta de la actual' },
        { status: 400 }
      )
    }

    const { data: user, error } = await supabaseAdmin
      .from('admin_users')
      .select('id, password_hash, is_active')
      .eq('username', username)
      .maybeSingle()

    if (error || !user || !user.is_active) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const currentOk = await verifyPassword(currentPassword, user.password_hash)
    if (!currentOk) {
      return NextResponse.json(
        { error: 'La contraseña actual no es correcta' },
        { status: 401 }
      )
    }

    const newHash = await hashPassword(newPassword)

    const { error: updateError } = await supabaseAdmin
      .from('admin_users')
      .update({
        password_hash: newHash,
        // Al cambiarla, se levanta la obligación de cambiarla.
        must_change_password: false,
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[change-password] Error actualizando contraseña:', updateError)
      return NextResponse.json(
        { error: 'No se pudo actualizar la contraseña' },
        { status: 500 }
      )
    }

    // Nunca se registra la contraseña (ni la vieja ni la nueva), solo el hecho.
    await logAdminAction({
      actor: { username, id: userId },
      action: 'auth.password_changed',
      entityType: 'auth',
      summary: 'Cambió su contraseña',
      request,
    })

    return NextResponse.json({
      success: true,
      message: 'Contraseña actualizada correctamente',
    })
  } catch (error) {
    console.error('Error en change-password:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
