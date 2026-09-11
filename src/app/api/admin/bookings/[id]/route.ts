import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { deleteBookingPhotos } from '@/lib/deletePhotos'
import { getActiveCapacity } from '@/lib/fleetCapacity'
import {
  getActorFromRequest,
  logAdminAction,
  statusLabel,
  type FieldChange,
} from '@/lib/activityLog'

/** Etiqueta legible de una reserva, para poder leer el log aunque luego se borre. */
function bookingLabel(b: { client_name?: string | null; scheduled_date?: string | null }) {
  return [b?.client_name, b?.scheduled_date].filter(Boolean).join(' · ') || 'Reserva'
}

/**
 * Traduce el update a uno o más eventos de auditoría. Se emite un evento por TIPO de
 * cambio (reprogramación, estado, pago) para poder filtrarlos por separado después.
 */
async function logBookingUpdate(args: {
  request: NextRequest
  id: string
  before: Record<string, any> | null
  after: Record<string, any>
  updateData: Record<string, any>
}) {
  const { request, id, before, after, updateData } = args
  const actor = getActorFromRequest(request)
  const label = bookingLabel(after || before || {})
  const base = { actor, entityType: 'booking', entityId: id, entityLabel: label, request }

  // Reprogramación
  const dateChanged =
    'scheduled_date' in updateData && before?.scheduled_date !== after?.scheduled_date
  const timeChanged =
    'scheduled_time' in updateData && before?.scheduled_time !== after?.scheduled_time

  if (dateChanged || timeChanged) {
    const changes: Record<string, FieldChange> = {}
    if (dateChanged) {
      changes.scheduled_date = { from: before?.scheduled_date, to: after?.scheduled_date }
    }
    if (timeChanged) {
      changes.scheduled_time = { from: before?.scheduled_time, to: after?.scheduled_time }
    }
    await logAdminAction({
      ...base,
      action: 'booking.rescheduled',
      summary: `Reprogramó de ${before?.scheduled_date ?? '—'} ${String(
        before?.scheduled_time ?? ''
      ).slice(0, 5)} a ${after?.scheduled_date ?? '—'} ${String(
        after?.scheduled_time ?? ''
      ).slice(0, 5)}`,
      changes,
    })
  }

  // Cambio de estado
  if ('status' in updateData && before?.status !== after?.status) {
    await logAdminAction({
      ...base,
      action: 'booking.status_changed',
      summary: `Cambió el estado de ${statusLabel(before?.status)} a ${statusLabel(
        after?.status
      )}`,
      changes: { status: { from: before?.status, to: after?.status } },
    })
  }

  // Pagos
  const paymentChanges: Record<string, FieldChange> = {}
  if ('payment_type' in updateData && before?.payment_type !== after?.payment_type) {
    paymentChanges.payment_type = { from: before?.payment_type, to: after?.payment_type }
  }
  if ('payment_status' in updateData && before?.payment_status !== after?.payment_status) {
    paymentChanges.payment_status = {
      from: before?.payment_status,
      to: after?.payment_status,
    }
  }
  if (Object.keys(paymentChanges).length) {
    const parts: string[] = []
    if (paymentChanges.payment_status) {
      parts.push(
        `estado de pago: ${statusLabel(
          paymentChanges.payment_status.from as string
        )} → ${statusLabel(paymentChanges.payment_status.to as string)}`
      )
    }
    if (paymentChanges.payment_type) {
      parts.push(
        `tipo de pago: ${paymentChanges.payment_type.from ?? '—'} → ${
          paymentChanges.payment_type.to ?? '—'
        }`
      )
    }
    await logAdminAction({
      ...base,
      action: 'booking.payment_updated',
      summary: `Actualizó el pago (${parts.join(', ')})`,
      changes: paymentChanges,
    })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const {
      status,
      notes,
      payment_type,
      payment_status,
      service_completed_at,
      scheduled_date,
      scheduled_time,
    } = body

    const reschedules = Boolean(scheduled_date || scheduled_time)

    if (
      !status &&
      !payment_type &&
      !payment_status &&
      service_completed_at === undefined &&
      notes === undefined &&
      !reschedules
    ) {
      return NextResponse.json(
        { error: 'No hay cambios que aplicar' },
        { status: 400 }
      )
    }

    // Preparar datos de actualización
    const updateData: any = {}
    if (status) updateData.status = status
    if (payment_type) updateData.payment_type = payment_type
    if (payment_status) updateData.payment_status = payment_status
    if (service_completed_at !== undefined) updateData.service_completed_at = service_completed_at

    // Cambio de fecha/hora: hay que validar que el cupo nuevo exista, o se puede
    // sobrevender un camión moviendo reservas a un horario ya lleno.
    if (reschedules) {
      const { data: current, error: currentErr } = await supabaseAdmin
        .from('bookings')
        .select('scheduled_date, scheduled_time, status, is_provisional')
        .eq('id', id)
        .single()

      if (currentErr || !current) {
        return NextResponse.json(
          { error: 'No se encontró la reserva a reprogramar' },
          { status: 404 }
        )
      }

      const newDate = scheduled_date || current.scheduled_date
      const newTime = scheduled_time || current.scheduled_time
      const movedSlot =
        newDate !== current.scheduled_date || newTime !== current.scheduled_time

      // Solo validamos capacidad si realmente cambia de slot y la reserva ocupa cupo.
      const occupiesSlot =
        !current.is_provisional &&
        !['cancelled', 'no_show'].includes(status || current.status)

      if (movedSlot && occupiesSlot) {
        const { data: fleet } = await supabaseAdmin
          .from('fleet_config')
          .select('*')
          .single()
        const capacity = getActiveCapacity(fleet)

        // Excluimos la propia reserva del conteo: se está moviendo, no duplicando.
        const { count: taken } = await supabaseAdmin
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('scheduled_date', newDate)
          .eq('scheduled_time', newTime)
          .in('status', ['confirmed', 'pending'])
          .neq('id', id)

        const { data: blocked } = await supabaseAdmin
          .from('blocked_slots')
          .select('id')
          .eq('date', newDate)
          .lte('start_time', newTime)
          .gt('end_time', newTime)

        if (blocked && blocked.length > 0) {
          return NextResponse.json(
            { error: 'Ese horario está bloqueado en la agenda' },
            { status: 409 }
          )
        }

        if ((taken || 0) >= capacity) {
          return NextResponse.json(
            {
              error: `Sin cupo a esa hora: ${taken}/${capacity} camiones ya ocupados`,
            },
            { status: 409 }
          )
        }
      }

      if (scheduled_date) updateData.scheduled_date = scheduled_date
      if (scheduled_time) updateData.scheduled_time = scheduled_time
    }

    // Si se marca como pago completo, sincronizar total_price con original_price
    if (payment_type === 'completo') {
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('bookings')
        .select('original_price, total_price')
        .eq('id', id)
        .single()

      if (!fetchError && existing && existing.original_price) {
        updateData.total_price = existing.original_price
      }
    }

    // Agregar timestamp según el estado
    if (status === 'confirmed' && !body.confirmed_at) {
      updateData.confirmed_at = new Date().toISOString()
    } else if (status === 'completed' && !body.completed_at) {
      updateData.completed_at = new Date().toISOString()
    } else if (status === 'cancelled' && !body.cancelled_at) {
      updateData.cancelled_at = new Date().toISOString()
    }

    // Agregar notas si se proporcionan
    if (notes !== undefined) {
      updateData.notes = notes
    }

    // Si se marca como completada, eliminar las fotos automáticamente
    if (status === 'completed') {
      console.log('[PATCH Booking] Reserva marcada como completada, eliminando fotos...')
      
      // Obtener las fotos actuales antes de actualizar
      const { data: currentBooking, error: fetchError } = await supabaseAdmin
        .from('bookings')
        .select('photo_urls')
        .eq('id', id)
        .single()

      if (!fetchError && currentBooking?.photo_urls) {
        // Eliminar fotos de Supabase Storage
        const deleteResult = await deleteBookingPhotos(currentBooking.photo_urls)
        
        if (deleteResult.success) {
          console.log(`[PATCH Booking] ✓ ${deleteResult.deletedCount} foto(s) eliminada(s) exitosamente`)
          // Limpiar photo_urls en la BD
          updateData.photo_urls = []
        } else {
          console.error(`[PATCH Booking] Error eliminando fotos:`, deleteResult.errors)
          // Continuar con la actualización aunque falle la eliminación de fotos
        }
      } else {
        console.log('[PATCH Booking] No hay fotos para eliminar')
      }
    }

    // Estado previo para el log (antes → después). Se lee aquí, justo antes de mutar.
    const { data: before } = await supabaseAdmin
      .from('bookings')
      .select(
        'client_name, scheduled_date, scheduled_time, status, payment_type, payment_status'
      )
      .eq('id', id)
      .maybeSingle()

    // Actualizar la reserva
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating booking:', error)
      return NextResponse.json(
        { error: 'Error al actualizar la reserva' },
        { status: 500 }
      )
    }

    await logBookingUpdate({ request, id, before, after: booking, updateData })

    return NextResponse.json({
      success: true,
      booking,
      message: status === 'completed' 
        ? 'Reserva completada y fotos eliminadas correctamente' 
        : 'Reserva actualizada correctamente'
    })
  } catch (error) {
    console.error('Error in /api/admin/bookings/[id]:', error)
    return NextResponse.json(
      { error: 'Error al actualizar la reserva' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Se leen los datos ANTES de borrar: después ya no hay de dónde sacarlos para el log.
    const { data: before } = await supabaseAdmin
      .from('bookings')
      .select('client_name, scheduled_date, scheduled_time, status, quote_id, total_price')
      .eq('id', id)
      .maybeSingle()

    // Eliminar la reserva
    const { error } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting booking:', error)
      return NextResponse.json(
        { error: 'Error al eliminar la reserva' },
        { status: 500 }
      )
    }

    await logAdminAction({
      actor: getActorFromRequest(request),
      action: 'booking.deleted',
      entityType: 'booking',
      entityId: id,
      entityLabel: bookingLabel(before || {}),
      summary: `Eliminó la reserva${before?.quote_id ? ` ${before.quote_id}` : ''} de ${
        before?.scheduled_date ?? '—'
      } ${String(before?.scheduled_time ?? '').slice(0, 5)}`,
      // Guardamos el registro borrado: es la única copia que queda de qué se eliminó.
      changes: before
        ? { deleted_booking: { from: before, to: null } }
        : null,
      request,
    })

    return NextResponse.json({
      success: true,
      message: 'Reserva eliminada correctamente'
    })
  } catch (error) {
    console.error('Error in /api/admin/bookings/[id] DELETE:', error)
    return NextResponse.json(
      { error: 'Error al eliminar la reserva' },
      { status: 500 }
    )
  }
}
