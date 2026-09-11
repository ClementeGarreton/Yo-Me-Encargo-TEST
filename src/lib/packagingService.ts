/**
 * SERVICIO DE OPCIONES DE EMBALAJE
 * 
 * Este servicio proporciona las opciones de embalaje disponibles
 * basadas en la configuración de precios de la base de datos.
 */

import { getPricingConfig } from '@/lib/pricingService'

export interface PackagingOption {
  id: string
  name: string
  price: number
  description: string
  icon: string
}

export async function getPackagingOptions(): Promise<PackagingOption[]> {
  try {
    const pricing = await getPricingConfig()
    
    return [
      {
        id: 'none',
        name: 'Sin Embalaje',
        price: 0,
        description: 'El cliente se encarga del embalaje',
        icon: '📦'
      },
      {
        id: 'basic',
        name: 'Embalaje Básico',
        price: pricing.specialPackaging.fragile,
        description: 'Film plástico (precio por m³)',
        icon: '📦'
      },
      {
        id: 'standard',
        name: 'Embalaje Estándar',
        price: pricing.specialPackaging.electronics,
        description: 'Cartón corrugado (precio por m³)',
        icon: '📦'
      },
      {
        id: 'premium',
        name: 'Embalaje Premium',
        price: pricing.specialPackaging.artwork,
        description: 'Cartón corrugado y Film plástico (precio por m³)',
        icon: '📦'
      }
    ]
  } catch (error) {
    console.error('Error getting packaging options:', error)
    
    // Devolver opciones por defecto si falla
    return [
      {
        id: 'none',
        name: 'Sin Embalaje',
        price: 0,
        description: 'El cliente se encarga del embalaje',
        icon: '📦'
      },
      {
        id: 'basic',
        name: 'Embalaje Básico',
        price: 10000,
        description: 'Film plástico',
        icon: '📦'
      },
      {
        id: 'standard',
        name: 'Embalaje Estándar',
        price: 15000,
        description: 'Cartón corrugado',
        icon: '📦'
      },
      {
        id: 'premium',
        name: 'Embalaje Premium',
        price: 25000,
        description: 'Cartón corrugado y Film plástico',
        icon: '📦'
      }
    ]
  }
}
