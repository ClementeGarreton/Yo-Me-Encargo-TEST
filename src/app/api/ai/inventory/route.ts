import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { createStructuredResponseWithUsage } from '@/lib/ai/openai'
import { addUsage, createConversation, logAction, logMessage } from '@/lib/ai/conversationStore'
import { buildInventoryAssistantPrompt } from '@/lib/ai/prompts'

const requestSchema = z.object({
  conversationId: z.string().uuid().optional().nullable(),
  text: z.string().max(3000).optional().default(''),
  images: z.array(z.string().startsWith('data:image/').max(750_000)).max(5).optional().default([]),
}).refine((value: { text: string; images: string[] }) => value.text.trim().length > 0 || value.images.length > 0, {
  message: 'Escribe tu inventario o adjunta al menos una foto',
})

const outputSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          catalogItemId: { type: 'string' },
          quantity: { type: 'integer', minimum: 1, maximum: 100 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          evidence: { type: 'string' },
        },
        required: ['catalogItemId', 'quantity', 'confidence', 'evidence'],
        additionalProperties: false,
      },
    },
    unresolved: { type: 'array', items: { type: 'string' } },
    pendingResolutions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sourceLabel: { type: 'string' },
          quantity: { type: 'integer', minimum: 1, maximum: 100 },
          reason: { type: 'string', enum: ['ambiguous', 'not_found'] },
          question: { type: 'string' },
          suggestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                catalogItemId: { type: 'string' },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                reason: { type: 'string' },
              },
              required: ['catalogItemId', 'confidence', 'reason'],
              additionalProperties: false,
            },
          },
        },
        required: ['sourceLabel', 'quantity', 'reason', 'question', 'suggestions'],
        additionalProperties: false,
      },
    },
    clarificationQuestion: { type: ['string', 'null'] },
  },
  required: ['summary', 'items', 'unresolved', 'pendingResolutions', 'clarificationQuestion'],
  additionalProperties: false,
}

interface InventoryResult {
  summary: string
  items: Array<{
    catalogItemId: string
    quantity: number
    confidence: number
    evidence: string
  }>
  unresolved: string[]
  pendingResolutions: Array<{
    sourceLabel: string
    quantity: number
    reason: 'ambiguous' | 'not_found'
    question: string
    suggestions: Array<{
      catalogItemId: string
      confidence: number
      reason: string
    }>
  }>
  clarificationQuestion: string | null
}

interface CatalogEntry {
  id: string
  name: string
  category: string
  volume: number
  weight: number
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()
}

function fallbackSuggestions(sourceLabel: string, catalog: CatalogEntry[]) {
  const sourceTokens = new Set(normalize(sourceLabel).split(/\s+/).filter((token) => token.length > 2))

  return catalog
    .map((item) => {
      const itemTokens = new Set(normalize(`${item.name} ${item.category}`).split(/\s+/).filter((token) => token.length > 2))
      const overlap = Array.from(sourceTokens).filter((token) => itemTokens.has(token)).length
      const partial = Array.from(sourceTokens).filter((token) =>
        Array.from(itemTokens).some((candidate) => candidate.includes(token) || token.includes(candidate))
      ).length
      return { item, score: overlap * 3 + partial }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ item, score }) => ({
      catalogItemId: item.id,
      confidence: Math.min(0.72, 0.35 + score * 0.08),
      reason: 'Coincidencia aproximada por nombre o categoría',
    }))
}

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json())

    const { data: catalogRows, error } = await supabaseAdmin
      .from('catalog_items')
      .select('id,name,category,volume,weight,is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw new Error('No se pudo cargar el catálogo')

    const catalog: CatalogEntry[] = (catalogRows || []).map((item: any) => ({
      id: String(item.id),
      name: String(item.name),
      category: String(item.category),
      volume: Number(item.volume),
      weight: Number(item.weight),
    }))

    const inputContent: any[] = [
      {
        type: 'input_text',
        text: body.text.trim() || 'Analiza las fotografías y crea un inventario estimado.',
      },
      ...body.images.map((image: string) => ({
        type: 'input_image',
        image_url: image,
        detail: 'auto',
      })),
    ]

    let conversationId = body.conversationId || null
    if (!conversationId) {
      try {
        const conversation = await createConversation({ channel: 'web' })
        conversationId = conversation.id
      } catch (auditError) {
        console.warn('[AI inventory] No se pudo iniciar auditoría:', auditError)
      }
    }

    if (conversationId) {
      try {
        await logMessage({
          conversationId,
          direction: 'inbound',
          role: 'user',
          content: body.text.trim() || `[${body.images.length} foto(s) de inventario]`,
          messageType: body.images.length ? 'image' : 'text',
          metadata: { imageCount: body.images.length },
        })
      } catch {}
    }

    const { data: result, usage } = await createStructuredResponseWithUsage<InventoryResult>({
      instructions: buildInventoryAssistantPrompt(catalog),
      input: [{ role: 'user', content: inputContent }],
      schemaName: 'inventory_parser_result',
      schema: outputSchema,
      reasoningEffort: 'low',
      maxOutputTokens: 1800,
    })

    const allowedIds = new Set(catalog.map((item) => item.id))
    const merged = new Map<string, InventoryResult['items'][number]>()

    for (const item of result.items) {
      if (!allowedIds.has(item.catalogItemId)) continue
      const normalized = {
        ...item,
        quantity: Math.max(1, Math.min(100, Math.round(item.quantity))),
        confidence: Math.max(0, Math.min(1, item.confidence)),
      }
      const previous = merged.get(item.catalogItemId)
      if (previous) {
        merged.set(item.catalogItemId, {
          ...normalized,
          quantity: Math.min(100, previous.quantity + normalized.quantity),
          confidence: Math.min(previous.confidence, normalized.confidence),
          evidence: `${previous.evidence}; ${normalized.evidence}`,
        })
      } else {
        merged.set(item.catalogItemId, normalized)
      }
    }

    const pendingResolutions = (result.pendingResolutions || [])
      .map((pending) => {
        const seen = new Set<string>()
        let suggestions = (pending.suggestions || [])
          .filter((suggestion) => allowedIds.has(suggestion.catalogItemId))
          .filter((suggestion) => {
            if (seen.has(suggestion.catalogItemId)) return false
            seen.add(suggestion.catalogItemId)
            return true
          })
          .slice(0, 5)

        // Si el modelo detectó el problema pero no pudo proponer IDs válidos,
        // intentamos rescatar candidatos por similitud de texto. Nunca inventamos items.
        if (suggestions.length === 0) {
          suggestions = fallbackSuggestions(pending.sourceLabel, catalog)
        }

        return {
          ...pending,
          quantity: Math.max(1, Math.min(100, Math.round(pending.quantity || 1))),
          suggestions,
        }
      })
      .filter((pending) => pending.sourceLabel.trim().length > 0)

    const responsePayload = {
      ...result,
      items: Array.from(merged.values()),
      pendingResolutions,
      conversationId,
    }

    if (conversationId) {
      try {
        await Promise.all([
          logMessage({
            conversationId,
            direction: 'outbound',
            role: 'assistant',
            content: result.summary,
            metadata: { pendingResolutions: pendingResolutions.length, recognizedItems: merged.size },
          }),
          logAction({
            conversationId,
            action: 'web_inventory_parsed',
            payload: { items: responsePayload.items, pendingResolutions },
          }),
          addUsage(conversationId, usage),
        ])
      } catch (auditError) {
        console.warn('[AI inventory] No se pudo guardar auditoría:', auditError)
      }
    }

    return NextResponse.json(responsePayload)
  } catch (error) {
    console.error('[AI inventory]', error)
    const message = error instanceof Error ? error.message : 'Error procesando el inventario'
    const status = message.includes('OPENAI_API_KEY') ? 503 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
