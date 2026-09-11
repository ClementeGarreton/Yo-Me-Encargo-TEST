import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getActorFromRequest, logAdminAction } from '@/lib/activityLog'

export async function GET() {
  try {
    // Obtener configuración de precios desde la base de datos (el más reciente)
    const { data: configs, error } = await supabaseAdmin
      .from('pricing_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Error fetching pricing config:', error)
      return NextResponse.json(
        { error: 'Error obteniendo configuración de precios' },
        { status: 500 }
      )
    }

    const config = configs?.[0]

    // Si no existe configuración, devolver valores por defecto
    if (!config) {
      const defaultConfig = {
        basePrice: 50000,
        pricePerCubicMeter: 15000,
        pricePerKilometer: 800,
        freeKilometers: 50,
        floorSurcharge: 5000,
        homeQuotePrice: 80000,
        additionalServices: {
          packing: 25000,
          unpacking: 20000,
          disassembly: 15000,
          assembly: 15000
        },
        specialPackaging: {
          fragile: 10000,
          electronics: 15000,
          artwork: 25000
        },
        timeSurcharges: {
          saturday: 20,
          sunday: 50,
          holiday: 100
        },
        discounts: {
          flexibility: 10,
          advanceBooking: 5,
          repeatCustomer: 15
        }
      }

      return NextResponse.json(defaultConfig)
    }

    // Transformar los datos de la BD al formato esperado por el frontend
    const transformedConfig = {
      basePrice: config.base_price,
      pricePerCubicMeter: config.price_per_cubic_meter,
      pricePerKilometer: config.price_per_kilometer,
      freeKilometers: config.free_kilometers || 50,
      floorSurcharge: config.floor_surcharge,
      homeQuotePrice: Number(config.additional_services?.homeQuotePrice ?? 80000),
      additionalServices: config.additional_services,
      specialPackaging: config.special_packaging,
      timeSurcharges: config.time_surcharges,
      discounts: config.discounts
    }

    return NextResponse.json(transformedConfig)
  } catch (error) {
    console.error('Error in /api/admin/pricing-config:', error)
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
    const requiredFields = [
      'basePrice', 'pricePerCubicMeter', 'pricePerKilometer', 'floorSurcharge', 'homeQuotePrice',
      'additionalServices', 'specialPackaging', 'timeSurcharges', 'discounts'
    ]

    for (const field of requiredFields) {
      if (!(field in body)) {
        return NextResponse.json(
          { error: `Campo requerido faltante: ${field}` },
          { status: 400 }
        )
      }
    }

    // Transformar los datos del frontend al formato de la BD
    const dbData = {
      base_price: body.basePrice,
      price_per_cubic_meter: body.pricePerCubicMeter,
      price_per_kilometer: body.pricePerKilometer,
      free_kilometers: body.freeKilometers || 50,
      floor_surcharge: body.floorSurcharge,
      additional_services: { ...body.additionalServices, homeQuotePrice: body.homeQuotePrice },
      special_packaging: body.specialPackaging,
      time_surcharges: body.timeSurcharges,
      discounts: body.discounts,
      updated_at: new Date().toISOString()
    }

    // Verificar si ya existe configuración
    const { data: existingConfig } = await supabaseAdmin
      .from('pricing_config')
      .select('id')
      .single()

    let result
    if (existingConfig) {
      // Actualizar configuración existente
      result = await supabaseAdmin
        .from('pricing_config')
        .update(dbData)
        .eq('id', existingConfig.id)
        .select()
        .single()
    } else {
      // Crear nueva configuración
      result = await supabaseAdmin
        .from('pricing_config')
        .insert({
          ...dbData,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
    }

    if (result.error) {
      console.error('Error saving pricing config:', result.error)
      return NextResponse.json(
        { error: 'Error guardando configuración de precios' },
        { status: 500 }
      )
    }

    await logAdminAction({
      actor: getActorFromRequest(request),
      action: 'pricing.updated',
      entityType: 'pricing',
      entityId: result.data?.id ? String(result.data.id) : null,
      entityLabel: 'Configuración de precios',
      summary: `Actualizó los precios (base $${Number(body.basePrice || 0).toLocaleString('es-CL')}, m³ $${Number(body.pricePerCubicMeter || 0).toLocaleString('es-CL')}, km $${Number(body.pricePerKilometer || 0).toLocaleString('es-CL')})`,
      // Se guarda la configuración completa: es el cambio que más impacta la facturación.
      changes: { pricing: { from: existingConfig ? 'anterior' : null, to: dbData } },
      request,
    })

    return NextResponse.json({
      success: true,
      message: 'Configuración de precios guardada exitosamente',
      data: result.data
    })
  } catch (error) {
    console.error('Error in /api/admin/pricing-config PUT:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
