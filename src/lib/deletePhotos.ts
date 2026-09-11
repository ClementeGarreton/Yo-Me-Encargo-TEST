import { supabaseAdmin } from './supabase'

/**
 * Elimina las fotos de una reserva de Supabase Storage
 * @param photoUrls Array de URLs públicas de las fotos a eliminar
 * @returns Objeto con resultado de la operación
 */
export async function deleteBookingPhotos(photoUrls: string[] | string): Promise<{
  success: boolean
  deletedCount: number
  errors: string[]
}> {
  console.log('[deletePhotos] Iniciando eliminación de fotos...')
  
  // Parsear URLs si viene como string JSON
  let urls: string[] = []
  try {
    if (typeof photoUrls === 'string') {
      urls = JSON.parse(photoUrls)
    } else if (Array.isArray(photoUrls)) {
      urls = photoUrls
    }
  } catch (e) {
    console.error('[deletePhotos] Error parseando photo_urls:', e)
    return { success: false, deletedCount: 0, errors: ['Error parsing photo URLs'] }
  }

  if (!urls || urls.length === 0) {
    console.log('[deletePhotos] No hay fotos para eliminar')
    return { success: true, deletedCount: 0, errors: [] }
  }

  console.log(`[deletePhotos] Intentando eliminar ${urls.length} foto(s)...`)

  const errors: string[] = []
  let deletedCount = 0

  // Extraer las rutas de las URLs públicas
  // URL formato: https://xxxxx.supabase.co/storage/v1/object/public/bookings/photos/filename.jpg
  const filePaths = urls.map(url => {
    try {
      // Extraer solo la ruta después de "bookings/"
      const match = url.match(/\/bookings\/(.+)$/)
      return match ? match[1] : null
    } catch (e) {
      console.error('[deletePhotos] Error extrayendo ruta de URL:', url, e)
      return null
    }
  }).filter((path): path is string => path !== null)

  console.log('[deletePhotos] Rutas a eliminar:', filePaths)

  // Eliminar cada archivo
  for (const filePath of filePaths) {
    try {
      const { error } = await supabaseAdmin
        .storage
        .from('bookings')
        .remove([filePath])

      if (error) {
        console.error(`[deletePhotos] Error eliminando ${filePath}:`, error)
        errors.push(`Error eliminando ${filePath}: ${error.message}`)
      } else {
        console.log(`[deletePhotos] ✓ Eliminado: ${filePath}`)
        deletedCount++
      }
    } catch (e) {
      console.error(`[deletePhotos] Excepción eliminando ${filePath}:`, e)
      errors.push(`Excepción eliminando ${filePath}`)
    }
  }

  const success = errors.length === 0
  console.log(`[deletePhotos] Resultado: ${deletedCount}/${filePaths.length} eliminadas, ${errors.length} errores`)

  return { success, deletedCount, errors }
}
