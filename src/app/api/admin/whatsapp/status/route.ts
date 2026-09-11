import { NextResponse } from 'next/server'
import { isWhatsAppConfigured } from '@/lib/whatsapp/cloudApi'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    configured: isWhatsAppConfigured(),
    phoneNumberIdConfigured: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
    accessTokenConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
    verifyTokenConfigured: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
    appSecretConfigured: Boolean(process.env.META_APP_SECRET),
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION || 'v26.0',
  })
}
