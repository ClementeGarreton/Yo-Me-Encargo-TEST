import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getActorFromRequest, logAdminAction } from '@/lib/activityLog'

export async function GET() {
  try {
    // Obtener configuración de horarios desde la base de datos (el más reciente)
    const { data: config, error } = await supabaseAdmin
      .from('schedule_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error('Error fetching schedule config:', error)
      return NextResponse.json(
        { error: 'Error obteniendo configuración de horarios' },
        { status: 500 }
      )
    }

    // Si no existe configuración, devolver valores por defecto
    if (!config) {
      const defaultConfig = {
        daysOfWeek: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          sunday: false
        },
        timeSlots: [
          { time: '08:00', label: '08:00 hrs', recommended: true },
          { time: '09:00', label: '09:00 hrs', recommended: true },
          { time: '10:00', label: '10:00 hrs', recommended: true },
          { time: '11:00', label: '11:00 hrs', recommended: false },
          { time: '14:00', label: '14:00 hrs', recommended: true },
          { time: '15:00', label: '15:00 hrs', recommended: false }
        ]
      }

      return NextResponse.json(defaultConfig)
    }

    // Transformar los datos de la BD al formato esperado por el frontend
    const transformedConfig = {
      daysOfWeek: config.days_of_week,
      timeSlots: config.time_slots
    }

    return NextResponse.json(transformedConfig)
  } catch (error) {
    console.error('Error in /api/admin/schedule-config:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar que todos los campos requeridos estén presentes
    const requiredFields = ['daysOfWeek', 'timeSlots']

    for (const field of requiredFields) {
      if (!(field in body)) {
        return NextResponse.json(
          { error: `Campo requerido faltante: ${field}` },
          { status: 400 }
        )
      }
    }

    // Validar estructura de timeSlots
    if (!Array.isArray(body.timeSlots)) {
      return NextResponse.json(
        { error: 'timeSlots debe ser un array' },
        { status: 400 }
      )
    }

    // Validar cada timeSlot
    for (const slot of body.timeSlots) {
      if (!slot.time || !slot.label) {
        return NextResponse.json(
          { error: 'Cada timeSlot debe tener time y label' },
          { status: 400 }
        )
      }

      // Validar formato de hora
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
      if (!timeRegex.test(slot.time)) {
        return NextResponse.json(
          { error: `Formato de hora inválido: ${slot.time}` },
          { status: 400 }
        )
      }
    }

    // Transformar los datos del frontend al formato de la BD
    const dbData = {
      days_of_week: body.daysOfWeek,
      time_slots: body.timeSlots,
      updated_at: new Date().toISOString()
    }

    // UPSERT: Insertar o actualizar según exista configuración
    // Primero intentamos obtener la configuración existente
    const { data: existingConfig } = await supabaseAdmin
      .from('schedule_config')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let result
    
    if (existingConfig?.id) {
      // Actualizar la configuración existente
      result = await supabaseAdmin
        .from('schedule_config')
        .update(dbData)
        .eq('id', existingConfig.id)
        .select()
        .single()
    } else {
      // No hay configuración, eliminar duplicados antiguos y crear una nueva
      await supabaseAdmin
        .from('schedule_config')
        .delete()
        .lt('created_at', new Date().toISOString()) // Eliminar todos los anteriores
      
      result = await supabaseAdmin
        .from('schedule_config')
        .insert({
          ...dbData,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
    }

    if (result.error) {
      console.error('Error saving schedule config:', result.error)
      return NextResponse.json(
        { error: 'Error guardando configuración de horarios' },
        { status: 500 }
      )
    }

    await logAdminAction({
      actor: getActorFromRequest(request),
      action: 'schedule.updated',
      entityType: 'schedule',
      entityLabel: 'Configuración de horarios',
      summary: `Actualizó la agenda (${body.timeSlots?.length || 0} franjas horarias)`,
      changes: { schedule: { from: null, to: dbData } },
      request,
    })

    return NextResponse.json({
      success: true,
      message: 'Configuración de horarios guardada exitosamente',
      data: result.data
    })
  } catch (error) {
    console.error('Error in /api/admin/schedule-config PUT:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
