import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/whatsapp/cloudApi'
import { messageContext } from '@/lib/whatsapp/messageTransport'
import { extractMessages, processIncoming, notifyMessageProcessingError } from '@/lib/whatsapp/incomingProcessor'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge || '', { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  if (!verifyWebhookSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return new NextResponse('Invalid signature', { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: true })
  }

  const messages = extractMessages(payload)
  for (const message of messages) {
    try {
      await messageContext.run({ platform: 'whatsapp', businessPhoneId: message.businessPhoneId! }, async () => {
        try { await processIncoming(message) }
        catch (error) { console.error('[WhatsApp webhook] Error procesando mensaje:', error); await notifyMessageProcessingError(message) }
      })
    } catch (error) { console.error('[WhatsApp webhook] Error de contexto:', error) }
  }

  return NextResponse.json({ ok: true })
}
