import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizeUsername } from '@/lib/adminAuth'
import { hashPassword, validatePasswordStrength } from '@/lib/passwordHash'
import { getActorFromRequest, logAdminAction } from '@/lib/activityLog'

export const dynamic = 'force-dynamic'

// Gestión de usuarios del panel. Todos tienen los MISMOS permisos (no hay roles).
// Nunca se devuelve el password_hash al cliente.
const SAFE_FIELDS = 'id, username, display_name, is_active, must_change_password, created_at, last_login_at'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select(SAFE_FIELDS)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[admin/users] Error listando:', error)
      return NextResponse.json({ error: 'Error obteniendo usuarios' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error en /api/admin/users GET:', error)
    return NextResponse.json({ error: 'Error obteniendo usuarios' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, displayName, password } = await request.json()

    const normalized = normalizeUsername(String(username || ''))
    if (!normalized || !displayName || !password) {
      return NextResponse.json(
        { error: 'Usuario, nombre y contraseña son obligatorios' },
        { status: 400 }
      )
    }

    const strengthError = validatePasswordStrength(String(password))
    if (strengthError) {
      return NextResponse.json({ error: strengthError }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('username', normalized)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Ese usuario ya existe' }, { status: 409 })
    }

    const password_hash = await hashPassword(String(password))

    const { data: created, error } = await supabaseAdmin
      .from('admin_users')
      .insert({
        username: normalized,
        display_name: String(displayName).trim(),
        password_hash,
        // Contraseña definida por otra persona: el titular debe cambiarla al entrar.
        must_change_password: true,
      })
      .select(SAFE_FIELDS)
      .single()

    if (error) {
      console.error('[admin/users] Error creando:', error)
      return NextResponse.json({ error: 'No se pudo crear el usuario' }, { status: 500 })
    }

    await logAdminAction({
      actor: getActorFromRequest(request),
      action: 'user.created',
      entityType: 'user',
      entityId: created.id,
      entityLabel: created.username,
      summary: `Creó el usuario ${created.username} (${created.display_name})`,
      request,
    })

    return NextResponse.json({ success: true, user: created }, { status: 201 })
  } catch (error) {
    console.error('Error en /api/admin/users POST:', error)
    return NextResponse.json({ error: 'Error creando el usuario' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, isActive, newPassword } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const actor = getActorFromRequest(request)

    const { data: target } = await supabaseAdmin
      .from('admin_users')
      .select('id, username, display_name, is_active')
      .eq('id', id)
      .maybeSingle()

    if (!target) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Reseteo de contraseña por otro admin
    if (typeof newPassword === 'string' && newPassword.length > 0) {
      const strengthError = validatePasswordStrength(newPassword)
      if (strengthError) {
        return NextResponse.json({ error: strengthError }, { status: 400 })
      }

      const password_hash = await hashPassword(newPassword)
      const { error } = await supabaseAdmin
        .from('admin_users')
        .update({ password_hash, must_change_password: true })
        .eq('id', id)

      if (error) {
        console.error('[admin/users] Error reseteando contraseña:', error)
        return NextResponse.json(
          { error: 'No se pudo actualizar la contraseña' },
          { status: 500 }
        )
      }

      await logAdminAction({
        actor,
        action: 'user.password_reset',
        entityType: 'user',
        entityId: id,
        entityLabel: target.username,
        // Nunca se guarda la contraseña, solo el hecho.
        summary: `Reseteó la contraseña de ${target.username}`,
        request,
      })

      return NextResponse.json({ success: true })
    }

    // Activar / desactivar
    if (typeof isActive === 'boolean') {
      // Nadie puede desactivarse a sí mismo: se quedaría fuera del panel.
      if (!isActive && actor?.username === target.username) {
        return NextResponse.json(
          { error: 'No puedes desactivar tu propio usuario' },
          { status: 400 }
        )
      }

      // Tampoco se puede dejar el panel sin ningún usuario activo.
      if (!isActive) {
        const { count } = await supabaseAdmin
          .from('admin_users')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)

        if ((count || 0) <= 1) {
          return NextResponse.json(
            { error: 'Debe quedar al menos un usuario activo' },
            { status: 400 }
          )
        }
      }

      const { error } = await supabaseAdmin
        .from('admin_users')
        .update({ is_active: isActive })
        .eq('id', id)

      if (error) {
        console.error('[admin/users] Error cambiando estado:', error)
        return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 500 })
      }

      await logAdminAction({
        actor,
        action: isActive ? 'user.updated' : 'user.deactivated',
        entityType: 'user',
        entityId: id,
        entityLabel: target.username,
        summary: isActive
          ? `Reactivó el usuario ${target.username}`
          : `Desactivó el usuario ${target.username}`,
        changes: { is_active: { from: target.is_active, to: isActive } },
        request,
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  } catch (error) {
    console.error('Error en /api/admin/users PATCH:', error)
    return NextResponse.json({ error: 'Error actualizando el usuario' }, { status: 500 })
  }
}
