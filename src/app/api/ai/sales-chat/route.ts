import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createStructuredResponseWithUsage } from '@/lib/ai/openai'
import { SALES_ASSISTANT_PROMPT } from '@/lib/ai/prompts'
import { addUsage, createConversation, logMessage } from '@/lib/ai/conversationStore'

const requestSchema = z.object({
  conversationId: z.string().uuid().optional().nullable(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(1500),
  })).min(1).max(12),
})

const responseSchema = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    recommendQuote: { type: 'boolean' },
    ctaPath: { type: ['string', 'null'], enum: ['/cotizador?start=online', '/domicilio', null] },
  },
  required: ['answer', 'recommendQuote', 'ctaPath'],
  additionalProperties: false,
}

interface SalesResult {
  answer: string
  recommendQuote: boolean
  ctaPath: '/cotizador?start=online' | '/domicilio' | null
}

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json())
    const messages = body.messages.slice(-10).map((m: { role: 'user' | 'assistant'; content: string }) => ({ role: m.role, content: m.content }))

    let conversationId = body.conversationId || null
    if (!conversationId) {
      try {
        const conversation = await createConversation({ channel: 'web' })
        conversationId = conversation.id
      } catch (logError) {
        // La IA sigue funcionando aunque la migración 1.3 aún no se haya aplicado.
        console.warn('[AI sales-chat] No se pudo iniciar auditoría:', logError)
      }
    }

    const latestUser = [...body.messages].reverse().find((m: { role: 'user' | 'assistant'; content: string }) => m.role === 'user')
    if (conversationId && latestUser) {
      try {
        await logMessage({
          conversationId,
          direction: 'inbound',
          role: 'user',
          content: latestUser.content,
        })
      } catch (logError) {
        console.warn('[AI sales-chat] No se pudo guardar mensaje entrante:', logError)
      }
    }

    const { data: result, usage } = await createStructuredResponseWithUsage<SalesResult>({
      instructions: SALES_ASSISTANT_PROMPT,
      input: messages,
      schemaName: 'sales_assistant_reply',
      schema: responseSchema,
      reasoningEffort: 'low',
      maxOutputTokens: 500,
    })

    if (conversationId) {
      try {
        await Promise.all([
          logMessage({
            conversationId,
            direction: 'outbound',
            role: 'assistant',
            content: result.answer,
            metadata: { recommendQuote: result.recommendQuote, ctaPath: result.ctaPath },
          }),
          addUsage(conversationId, usage),
        ])
      } catch (logError) {
        console.warn('[AI sales-chat] No se pudo completar auditoría:', logError)
      }
    }

    return NextResponse.json({ ...result, conversationId })
  } catch (error) {
    console.error('[AI sales-chat]', error)
    const message = error instanceof Error ? error.message : 'Error procesando la consulta'
    const status = message.includes('OPENAI_API_KEY') ? 503 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
