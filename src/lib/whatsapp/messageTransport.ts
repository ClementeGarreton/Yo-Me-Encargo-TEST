import { AsyncLocalStorage } from 'node:async_hooks'
import { splitInstagramText } from '@/lib/instagram/splitText'
import { sendWhatsAppText, sendWhatsAppDocument, downloadWhatsAppMediaAsDataUrl } from '@/lib/whatsapp/cloudApi'

export type IncomingChannel = { platform: 'whatsapp'; businessPhoneId: string } | { platform: 'instagram'; accountId: string }
export const messageContext = new AsyncLocalStorage<IncomingChannel>()

export function conversationKey(recipient: string): string {
  const context = messageContext.getStore()
  if (context?.platform === 'instagram') return `ig:${context.accountId}:${recipient}`
  const digits = recipient.replace(/\D/g, '')
  if (context?.platform === 'whatsapp' && context.businessPhoneId !== process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return `+${digits}#${context.businessPhoneId}`
  }
  return `+${digits}`
}

export function customerPhone(recipient: string): string {
  return messageContext.getStore()?.platform === 'instagram' ? '' : `+${recipient.replace(/\D/g, '')}`
}

async function instagramSend(to: string, message: Record<string, unknown>) {
  const context = messageContext.getStore()
  if (!context || context.platform !== 'instagram') throw new Error('No hay sesión de Instagram')
  if (!process.env.INSTAGRAM_ACCESS_TOKEN) throw new Error('Falta INSTAGRAM_ACCESS_TOKEN')
  const version = process.env.INSTAGRAM_GRAPH_VERSION || 'v26.0'
  const res = await fetch(`https://graph.instagram.com/${version}/${context.accountId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: to }, message }),
  })
  const response: any = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('[Instagram][envio] Error Graph API', JSON.stringify({ status: res.status, code: response?.error?.code, subcode: response?.error?.error_subcode }))
    throw new Error(response?.error?.message || `Instagram Send API ${res.status}`)
  }
  console.info('[Instagram][envio] Respuesta aceptada por Graph API', JSON.stringify({ status: res.status }))
  return { messages: [{ id: response.message_id || null }] }
}

export async function sendChannelText(to: string, body: string) {
  const context = messageContext.getStore()
  if (context?.platform === 'instagram') {
    // Instagram admite mensajes más cortos que WhatsApp. El inventario/PDF puede
    // incluir listas largas: dividirlas sin perder contenido.
    const sent: Array<{ id: string | null }> = []
    for (const chunk of splitInstagramText(body)) {
      const response = await instagramSend(to, { text: chunk })
      sent.push(...response.messages)
    }
    return { messages: sent }
  }
  return sendWhatsAppText(to, body, context?.platform === 'whatsapp' ? context.businessPhoneId : undefined)
}

export async function sendChannelDocument(to: string, url: string, filename: string, caption?: string) {
  const context = messageContext.getStore()
  // Instagram DM no soporta PDFs como adjunto de WhatsApp; entregar enlace web.
  if (context?.platform === 'instagram') return instagramSend(to, { text: `${caption || filename}: ${url}` })
  return sendWhatsAppDocument(to, url, filename, caption, context?.platform === 'whatsapp' ? context.businessPhoneId : undefined)
}

export async function downloadChannelImage(mediaId: string): Promise<string> {
  const context = messageContext.getStore()
  if (context?.platform !== 'instagram') return downloadWhatsAppMediaAsDataUrl(mediaId)
  const url = new URL(mediaId)
  // Evitar SSRF si Meta envía enlaces no confiables.
  if (url.protocol !== 'https:' || !/(^|\.)(fbcdn\.net|cdninstagram\.com)$/.test(url.hostname)) {
    throw new Error('Imagen de Instagram con origen no permitido; pedir descripción textual')
  }
  const res = await fetch(url.toString(), { redirect: 'error' })
  if (!res.ok) throw new Error(`Instagram CDN ${res.status}`)
  const type = res.headers.get('content-type') || ''
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('Formato de imagen no admitido')
  const len = Number(res.headers.get('content-length') || 0)
  if (len > 5_000_000) throw new Error('Imagen excede 5 MB')
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length > 5_000_000) throw new Error('Imagen excede 5 MB')
  return `data:${type};base64,${buffer.toString('base64')}`
}
