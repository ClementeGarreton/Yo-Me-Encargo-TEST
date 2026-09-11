/**
 * CONFIGURACIÓN DE GEOAPIFY API
 * 
 * Para obtener tu API Key:
 * 1. Ve a: https://www.geoapify.com/
 * 2. Crea una cuenta gratuita
 * 3. Crea un nuevo proyecto
 * 4. Copia la API key y pégala en .env.local:
 *    NEXT_PUBLIC_GEOAPIFY_API_KEY=tu_key_aquí
 * 
 * VENTAJAS DE GEOAPIFY:
 * - 90,000 requests/mes GRATIS (vs 10,000 de Google)
 * - Sin restricciones de almacenamiento de datos
 * - Precios más estables y predecibles
 * - APIs no marcadas como "legacy"
 * - Mejor soporte técnico
 * 
 * IMPORTANTE:
 * - En producción, restringe la key a tu dominio
 * - Plan gratuito: 90,000 requests/mes
 * - Plan Starter: $9/mes para 300,000 requests/mes
 */

export const MAPS_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || '',
  
  // URLs de Geoapify API
  geocodingUrl: 'https://api.geoapify.com/v1/geocode/search',
  autocompleteUrl: 'https://api.geoapify.com/v1/geocode/autocomplete',
  distanceMatrixUrl: 'https://api.geoapify.com/v1/routing',
  
  // Configuración de fallback
  defaultDistance: 10, // km por defecto si falla la API
  
  // Opciones de la API
  language: 'es',
  country: 'cl', // Chile
  format: 'json',
}

/**
 * Verifica si la API Key está configurada
 */
export const isGeoapifyConfigured = (): boolean => {
  return MAPS_CONFIG.apiKey !== '' && MAPS_CONFIG.apiKey !== undefined
}

