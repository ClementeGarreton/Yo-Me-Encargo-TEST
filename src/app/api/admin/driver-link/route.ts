import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getActorFromRequest, logAdminAction } from '@/lib/activityLog'
import { randomBytes } from 'crypto'
import { getDriverPin } from '@/lib/driverSession'

// Gestión del token del link público de choferes. Protegido por el middleware
// de admin (está bajo /api/admin). Solo el admin puede leer/regenerar el token.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('fleet_config')
      .select('*')
      .single()

    if (error) {
      console.error('[driver-link] GET error:', error)
      return NextResponse.json({ error: 'Error obteniendo el link' }, { status: 500 })
    }

    const token =
      (data as { driver_access_token?: string | null } | null)?.driver_access_token || null
    // El PIN se devuelve solo por esta ruta (protegida por sesión de admin), para que el
    // panel lo muestre sin hornearlo en el bundle público.
    return NextResponse.json({ token, pin: getDriverPin() })
  } catch (error) {
    console.error('Error in /api/admin/driver-link GET:', error)
    return NextResponse.json({ error: 'Error obteniendo el link' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = randomBytes(24).toString('base64url')

    const { data: existing } = await supabaseAdmin
      .from('fleet_config')
      .select('id')
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'No se encontró configuración de flota' },
        { status: 404 }
      )
    }

    const { error } = await supabaseAdmin
      .from('fleet_config')
      .update({ driver_access_token: token, updated_at: new Date().toISOString() })
      .eq('id', existing.id)

    if (error) {
      console.error('[driver-link] POST error:', error)
      return NextResponse.json(
        {
          error:
            'No se pudo generar el link. ¿Está aplicada la migración add_driver_access_token.sql?',
        },
        { status: 500 }
      )
    }

    await logAdminAction({
      actor: getActorFromRequest(request),
      action: 'driver_link.regenerated',
      entityType: 'fleet',
      entityLabel: 'Acceso choferes',
      summary: 'Regeneró el link de choferes (el anterior dejó de funcionar)',
      request,
    })

    return NextResponse.json({ token })
  } catch (error) {
    console.error('Error in /api/admin/driver-link POST:', error)
    return NextResponse.json({ error: 'Error generando el link' }, { status: 500 })
  }
}
