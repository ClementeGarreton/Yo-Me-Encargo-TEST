/**
 * CONFIGURACIÓN DE PRECIOS
 * 
 * Este archivo centraliza TODOS los precios del sistema.
 * Edita estos valores para cambiar los precios en toda la aplicación.
 * 
 * ⚠️ IMPORTANTE: Puedes usar 0 para desactivar cualquier cargo.
 */

export const PRICING = {
  // PRECIO BASE
  basePrice: 30000, // Precio mínimo del servicio

  // CÁLCULO POR VOLUMEN
  pricePerCubicMeter: 2000, // Precio por cada m³

  // CÁLCULO POR DISTANCIA
  freeKilometers: 50, // Primeros kilómetros incluidos en el precio base
  pricePerKilometer: 500, // Precio por cada kilómetro ADICIONAL (después de los km gratis)

  // PISOS SIN ASCENSOR
  pricePerFloorNoElevator: 5000, // Precio por cada piso sin ascensor

  // SERVICIOS ADICIONALES
  services: {
    disassembly: 15000, // Desarme de muebles
    assembly: 15000, // Armado de muebles
    packing: 20000, // Embalaje profesional (general)
    unpacking: 10000, // Desembalaje
  },

  // EMBALAJE ESPECIAL POR ITEM
  packaging: {
    none: 0, // Sin embalaje
    film: 5000, // Film plástico
    cardboard: 8000, // Cartón corrugado
    box: 12000, // Caja de cartón
    boxPremium: 18000, // Caja + embalaje interior
  },

  // CARGOS ESPECIALES
  fragileItemSurcharge: 3000, // Cargo adicional por cada item frágil/vidrio
  saturdaySurcharge: 5000, // Cargo adicional por mudanza en sábado

  // DESCUENTOS
  flexibilityDiscount: 0.10, // 10% de descuento por flexibilidad de fecha (0.10 = 10%)
}

// Exportar tipos para TypeScript
export type PricingConfig = typeof PRICING

