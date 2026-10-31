/**
 * Instagram Messenger webhook: valida el destinatario y clasifica descartes.
 * El diagnóstico NUNCA registra cuerpos de mensajes, IDs completos ni tokens.
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

export interface InstagramWebhookDiagnostic {
  envelope: 'instagram' | 'other'
  entries: number
  messagingEvents: number
  accepted: number
  ignored: {
    accountMismatch: number
    missingIds: number
    ownOrEcho: number
    duplicate: number
    unsupported: number
  }
  // Solo booleanos: confirmar coincidencia sin registrar identificadores personales.
  matchingEntry: boolean
  matchingRecipient: boolean
}

export function inspectInstagramWebhook(payload: any, expectedAccountId: string): {
  messages: InstagramIncomingMessage[]
  diagnostic: InstagramWebhookDiagnostic
} {
  const entries = Array.isArray(payload?.entry) ? payload.entry : []
  const diagnostic: InstagramWebhookDiagnostic = {
    envelope: payload?.object === 'instagram' ? 'instagram' : 'other',
    entries: entries.length,
    messagingEvents: 0,
    accepted: 0,
    ignored: { accountMismatch: 0, missingIds: 0, ownOrEcho: 0, duplicate: 0, unsupported: 0 },
    matchingEntry: false,
    matchingRecipient: false,
  }
  const messages: InstagramIncomingMessage[] = []
  if (!expectedAccountId || diagnostic.envelope !== 'instagram') return { messages, diagnostic }
  const seen = new Set<string>()

  for (const entry of entries) {
    const entryId = String(entry?.id || '')
    if (entryId === expectedAccountId) diagnostic.matchingEntry = true
    if (!Array.isArray(entry?.messaging)) continue
    for (const event of entry.messaging) {
      diagnostic.messagingEvents++
      const senderId = String(event?.sender?.id || '')
      const recipientId = String(event?.recipient?.id || '')
      if (recipientId === expectedAccountId) diagnostic.matchingRecipient = true
      // Meta puede emitir variantes de entry.id entre tipos de autenticación.
      // Aceptar SOLO DMs al destinatario configurado, nunca mensajes de otras cuentas.
      if (recipientId !== expectedAccountId) {
        diagnostic.ignored.accountMismatch++
        continue
      }
      const message = event?.message
      const mid = String(message?.mid || '')
      if (!senderId || !mid) {
        diagnostic.ignored.missingIds++
        continue
      }
      if (senderId === expectedAccountId || message?.is_echo === true ||
          message?.is_self === true || message?.is_deleted === true) {
        diagnostic.ignored.ownOrEcho++
        continue
      }
      if (seen.has(mid)) {
        diagnostic.ignored.duplicate++
        continue
      }
      const attachment = Array.isArray(message?.attachments)
        ? message.attachments.find((item: any) => item?.type === 'image' && typeof item?.payload?.url === 'string')
        : null
      const text = typeof message.text === 'string' ? message.text : ''
      const type: InstagramIncomingMessage['type'] = attachment ? 'image' : text.trim() ? 'text' : 'other'
      if (type === 'other') {
        diagnostic.ignored.unsupported++
        continue
      }
      messages.push({
        id: `ig:${mid}`, from: senderId, type, text,
        ...(type === 'image' ? { imageId: String(attachment.payload.url) } : {}),
        accountId: expectedAccountId,
      })
      seen.add(mid)
    }
  }
  diagnostic.accepted = messages.length
  return { messages, diagnostic }
}

export function extractInstagramMessages(payload: any, expectedAccountId: string): InstagramIncomingMessage[] {
  return inspectInstagramWebhook(payload, expectedAccountId).messages
}
