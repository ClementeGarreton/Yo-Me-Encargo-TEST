/**
 * Aísla el formato de los DMs de Instagram del de WhatsApp.
 * Solo devuelve mensajes directos entrantes de la cuenta profesional configurada.
 * No transforma reacciones, confirmaciones de lectura ni ecos en conversaciones.
 */
export interface InstagramIncomingMessage {
  id: string
  from: string
  type: 'text' | 'image' | 'other'
  text: string
  imageId?: string
  profileName?: string
  accountId: string
}

export function extractInstagramMessages(payload: any, expectedAccountId: string): InstagramIncomingMessage[] {
  if (!expectedAccountId || payload?.object !== 'instagram' || !Array.isArray(payload?.entry)) return []
  const incoming: InstagramIncomingMessage[] = []
  const seen = new Set<string>()

  for (const entry of payload.entry) {
    const entryAccountId = String(entry?.id || '')
    if (entryAccountId !== expectedAccountId || !Array.isArray(entry?.messaging)) continue
    for (const event of entry.messaging) {
      const senderId = String(event?.sender?.id || '')
      const recipientId = String(event?.recipient?.id || '')
      const message = event?.message
      const mid = String(message?.mid || '')
      // Nunca contestar mensajes propios o eventos que carecen de texto/imagen.
      if (!senderId || senderId === expectedAccountId || recipientId !== expectedAccountId ||
          !mid || message?.is_echo === true || message?.is_self === true || message?.is_deleted === true || seen.has(mid)) continue
      const attachment = Array.isArray(message?.attachments)
        ? message.attachments.find((item: any) => item?.type === 'image' && typeof item?.payload?.url === 'string')
        : null
      const text = typeof message.text === 'string' ? message.text : ''
      const type: InstagramIncomingMessage['type'] = attachment ? 'image' : text.trim() ? 'text' : 'other'
      if (type === 'other') continue
      incoming.push({
        id: `ig:${mid}`, from: senderId, type, text,
        ...(type === 'image' ? { imageId: String(attachment.payload.url) } : {}),
        accountId: expectedAccountId,
      })
      seen.add(mid)
    }
  }
  return incoming
}
