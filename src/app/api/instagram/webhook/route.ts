import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/whatsapp/cloudApi'
import { messageContext } from '@/lib/whatsapp/messageTransport'
import { processIncoming, notifyMessageProcessingError } from '@/lib/whatsapp/incomingProcessor'
import { inspectInstagramWebhook } from '@/lib/instagram/webhookPayload'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Meta debe recibir hub.challenge en texto plano al verificar el webhook. */
export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams
  const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN
  if (verifyToken && search.get('hub.mode') === 'subscribe' &&
      search.get('hub.verify_token') === verifyToken) {
    return new NextResponse(search.get('hub.challenge') || '', {
      status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(request: NextRequest) {
  // Verificar la firma sobre el cuerpo original, ANTES de parsear JSON.
  const rawBody = await request.text()
  if (!process.env.META_APP_SECRET ||
      !verifyWebhookSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return new NextResponse('Invalid signature', { status: 401 })
  }
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID
  if (!accountId || !process.env.INSTAGRAM_ACCESS_TOKEN) {
    console.error('[Instagram] Falta configurar cuenta o token de acceso')
    return NextResponse.json({ ok: false, error: 'Instagram sin configurar' }, { status: 503 })
  }
  let payload: unknown
  try { payload = JSON.parse(rawBody) }
  catch { return new NextResponse('Invalid JSON', { status: 400 }) }

  const { messages, diagnostic } = inspectInstagramWebhook(payload, accountId)
  // 200 indica recepción HTTP, no que se haya procesado un DM. Registrar ambas cosas.
  console.info('[Instagram][webhook]', JSON.stringify(diagnostic))
  if (messages.length === 0 && diagnostic.messagingEvents > 0) {
    console.warn('[Instagram][descartado] Eventos recibidos, ningún DM procesable:', JSON.stringify(diagnostic.ignored))
  }
  for (const message of messages) {
    console.info('[Instagram][entrante]', JSON.stringify({ type: message.type, hasText: Boolean(message.text.trim()) }))
    try {
      await messageContext.run({ platform: 'instagram', accountId: message.accountId }, async () => {
        try { await processIncoming(message); console.info('[Instagram][motor] Procesamiento finalizado') }
        catch (error) {
          console.error('[Instagram] Error procesando DM:', error)
          // La misma política de WhatsApp: solo avisar si la cotización
          // estaba autorizada; nunca activar OpenAI por un error.
          await notifyMessageProcessingError(message)
        }
      })
    } catch (error) { console.error('[Instagram] Error de contexto:', error) }
  }
  return NextResponse.json({ ok: true })
}
