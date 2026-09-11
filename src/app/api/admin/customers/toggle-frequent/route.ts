import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getActorFromRequest, logAdminAction } from '@/lib/activityLog'

// Marca/desmarca un cliente como frecuente. El atributo vive en quote_prospects (por cliente),
// así que se aplica a TODAS las fichas de ese email => queda consistente entre Prospectos y Reservas.
// Si el cliente no tiene ninguna ficha (p.ej. reserva creada a mano) y se está marcando como
// frecuente, se crea una ficha mínima para no perder el dato.
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, is_frequent, name, phone } = body as {
      email?: string
      is_frequent?: boolean
      name?: string
      phone?: string
    }

    const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : ''
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    }

    const frequent = Boolean(is_frequent)
    const nowIso = new Date().toISOString()

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('quote_prospects')
      .update({ is_frequent: frequent, updated_at: nowIso })
      .eq('email', normalizedEmail)
      .select('id')

    if (updateError) {
      console.error('[toggle-frequent] Error actualizando:', updateError)
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
    }

    let affected = updated ? updated.length : 0

    // No había ficha para este cliente y se está marcando frecuente => crear una mínima.
    if (affected === 0 && frequent) {
      const { error: insertError } = await supabaseAdmin.from('quote_prospects').insert({
        name: name || normalizedEmail,
        email: normalizedEmail,
        phone: phone || null,
        is_frequent: true,
        status: 'converted',
        source: 'web',
      })
      if (insertError) {
        console.error('[toggle-frequent] Error creando ficha mínima:', insertError)
        return NextResponse.json({ error: 'Error al crear ficha de cliente' }, { status: 500 })
      }
      affected = 1
    }

    await logAdminAction({
      actor: getActorFromRequest(request),
      action: 'customer.frequent_toggled',
      entityType: 'prospect',
      entityLabel: name || email,
      summary: frequent
        ? `Marcó a ${name || email} como cliente frecuente`
        : `Quitó a ${name || email} de clientes frecuentes`,
      changes: { is_frequent: { from: !frequent, to: frequent } },
      request,
    })

    return NextResponse.json({ success: true, affected, is_frequent: frequent })
  } catch (error) {
    console.error('[toggle-frequent] Exception:', error)
    return NextResponse.json({ error: 'Error al marcar frecuente' }, { status: 500 })
  }
}
