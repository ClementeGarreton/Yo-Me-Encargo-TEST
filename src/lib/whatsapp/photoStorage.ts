import { supabaseAdmin } from '@/lib/supabase'

/** Persistir originales recibidos desde Meta en el bucket que ya utiliza la web. */
export async function saveQuotePhoto(sessionId: string, messageId: string, dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match) throw new Error('La foto no tiene un formato válido')
  const mime = match[1]
  const bytes = Buffer.from(match[2], 'base64')
  if (bytes.length > 5_000_000) throw new Error('Foto demasiado grande')
  const extension = mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp'
  const safeId = messageId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const storagePath = `photos/whatsapp/${sessionId}/${safeId}.${extension}`
  const { error } = await supabaseAdmin.storage.from('bookings').upload(storagePath, bytes, {
    contentType: mime, upsert: true,
  })
  if (error) throw new Error(`No se pudo guardar fotografía: ${error.message}`)
  const { data } = supabaseAdmin.storage.from('bookings').getPublicUrl(storagePath)
  return { storagePath, publicUrl: data.publicUrl, mime }
}

export async function loadQuotePhoto(storagePath: string): Promise<string | null> {
  if (!/^photos\/whatsapp\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(storagePath)) return null
  const { data, error } = await supabaseAdmin.storage.from('bookings').download(storagePath)
  if (error || !data) return null
  const mime = storagePath.endsWith('.png') ? 'image/png' : storagePath.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
  return `data:${mime};base64,${Buffer.from(await data.arrayBuffer()).toString('base64')}`
}

export async function signedQuotePhoto(storagePath: string, seconds = 3600): Promise<string | null> {
  if (!/^photos\/whatsapp\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(storagePath)) return null
  const { data, error } = await supabaseAdmin.storage.from('bookings').createSignedUrl(storagePath, seconds)
  return error ? null : data?.signedUrl || null
}
