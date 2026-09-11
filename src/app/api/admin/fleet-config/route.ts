import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getActorFromRequest, logAdminAction } from '@/lib/activityLog'

export async function GET() {
  try {
    // Obtener configuración de flota
    const { data: config, error } = await supabaseAdmin
      .from('fleet_config')
      .select('*')
      .single()

    if (error) {
      console.error('Error fetching fleet config:', error)
      return NextResponse.json(
        { error: 'Error obteniendo configuración de flota' },
        { status: 500 }
      )
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('Error in /api/admin/fleet-config:', error)
    return NextResponse.json(
      { error: 'Error obteniendo configuración de flota' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { num_vehicles, vehicles } = body

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (Array.isArray(vehicles)) {
      // Persistir la lista de vehículos con su estado (activo/mantenimiento).
      const sanitized = vehicles.map((v, i) => ({
        id: typeof v?.id === 'number' ? v.id : i + 1,
        name:
          typeof v?.name === 'string' && v.name.trim()
            ? v.name.trim()
            : `Camión ${i + 1}`,
        capacity:
          typeof v?.capacity === 'number' && v.capacity > 0 ? v.capacity : 1,
        driver: typeof v?.driver === 'string' ? v.driver : '',
        phone: typeof v?.phone === 'string' ? v.phone : '',
        status: v?.status === 'maintenance' ? 'maintenance' : 'active'
      }))

      if (sanitized.length < 1) {
        return NextResponse.json(
          { error: 'Debe haber al menos 1 vehículo' },
          { status: 400 }
        )
      }

      updates.vehicles = sanitized
      // num_vehicles refleja el total de vehículos (activos + en mantenimiento).
      updates.num_vehicles = sanitized.length
    } else if (num_vehicles !== undefined) {
      if (!num_vehicles || num_vehicles < 1) {
        return NextResponse.json(
          { error: 'Número de vehículos debe ser mayor a 0' },
          { status: 400 }
        )
      }
      updates.num_vehicles = num_vehicles
    } else {
      return NextResponse.json(
        { error: 'Nada que actualizar' },
        { status: 400 }
      )
    }

    // Primero obtener el ID del registro existente
    const { data: existingConfig } = await supabaseAdmin
      .from('fleet_config')
      .select('id')
      .single()

    if (!existingConfig) {
      return NextResponse.json(
        { error: 'No se encontró configuración de flota' },
        { status: 404 }
      )
    }

    // Actualizar configuración de flota
    const { data: config, error } = await supabaseAdmin
      .from('fleet_config')
      .update(updates)
      .eq('id', existingConfig.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating fleet config:', error)
      return NextResponse.json(
        { error: 'Error al actualizar la configuración de flota' },
        { status: 500 }
      )
    }

    // El detalle que importa: cuántos camiones quedan operativos, porque define los
    // cupos que el cotizador ofrece al público.
    const activos = Array.isArray(config?.vehicles)
      ? config.vehicles.filter((v: any) => v?.status === 'active').length
      : config?.num_vehicles ?? 0
    const enMantenimiento = Array.isArray(config?.vehicles)
      ? config.vehicles.filter((v: any) => v?.status === 'maintenance').length
      : 0

    await logAdminAction({
      actor: getActorFromRequest(request),
      action: 'fleet.updated',
      entityType: 'fleet',
      entityId: config?.id ? String(config.id) : null,
      entityLabel: 'Flota',
      summary: `Actualizó la flota: ${activos} camión(es) activo(s)` +
        (enMantenimiento ? `, ${enMantenimiento} en mantenimiento` : ''),
      changes: { vehicles: { from: null, to: updates.vehicles ?? updates.num_vehicles ?? null } },
      request,
    })

    return NextResponse.json({
      success: true,
      config,
      message: 'Configuración de flota actualizada correctamente'
    })
  } catch (error) {
    console.error('Error in /api/admin/fleet-config PATCH:', error)
    return NextResponse.json(
      { error: 'Error al actualizar la configuración de flota' },
      { status: 500 }
    )
  }
}