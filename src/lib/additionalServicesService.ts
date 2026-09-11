/**
 * SERVICIO DE SERVICIOS ADICIONALES
 * 
 * Este servicio proporciona los servicios adicionales disponibles
 * basados en la configuración de precios de la base de datos.
 */

import { getPricingConfig } from '@/lib/pricingService'
import { Wrench, Package } from 'lucide-react'

export interface AdditionalService {
  id: string
  name: string
  description: string
  icon: any
  price: number
  requiresContact?: boolean // Si es true, muestra mensaje de contacto con ejecutivo
  contactMessage?: string // Mensaje personalizado para contacto
}

export async function getAdditionalServices(): Promise<AdditionalService[]> {
  try {
    const pricing = await getPricingConfig()

    return [
      {
        id: 'disassembly',
        name: 'Desarme de Muebles',
        description: 'Desmontaje profesional de camas, roperos, estantes, etc.',
        icon: Wrench,
        price: pricing.additionalServices.disassembly
      },
      {
        id: 'assembly',
        name: 'Armado de Muebles',
        description: 'Montaje de todos tus muebles en el destino',
        icon: Wrench,
        price: pricing.additionalServices.assembly
      },
      {
        id: 'packing',
        name: 'Armado de Cajas',
        description: 'Empaque seguro de objetos frágiles y delicados',
        icon: Package,
        price: 0,
        requiresContact: true,
        contactMessage: 'Para contratar este servicio, habla con un ejecutivo'
      },
      {
        id: 'unpacking',
        name: 'Desembalaje',
        description: 'Desempaque y ubicación de items en destino',
        icon: Package,
        price: 0,
        requiresContact: true,
        contactMessage: 'Para contratar este servicio, habla con un ejecutivo'
      }
    ]
  } catch (error) {
    console.error('Error getting additional services:', error)

    // Devolver servicios por defecto si falla
    return [
      {
        id: 'disassembly',
        name: 'Desarme de Muebles',
        description: 'Desmontaje profesional de camas, roperos, estantes, etc.',
        icon: Wrench,
        price: 15000
      },
      {
        id: 'assembly',
        name: 'Armado de Muebles',
        description: 'Montaje de todos tus muebles en el destino',
        icon: Wrench,
        price: 15000
      },
      {
        id: 'packing',
        name: 'Armado de Cajas',
        description: 'Empaque seguro de objetos frágiles y delicados',
        icon: Package,
        price: 0,
        requiresContact: true,
        contactMessage: 'Para contratar este servicio, habla con un ejecutivo'
      },
      {
        id: 'unpacking',
        name: 'Desembalaje',
        description: 'Desempaque y ubicación de items en destino',
        icon: Package,
        price: 0,
        requiresContact: true,
        contactMessage: 'Para contratar este servicio, habla con un ejecutivo'
      }
    ]
  }
}
