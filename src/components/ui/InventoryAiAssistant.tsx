'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import {
  Camera,
  Check,
  ChevronRight,
  HelpCircle,
  ImagePlus,
  Loader2,
  Search,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import Button from './Button'
import Card from './Card'
import toast from 'react-hot-toast'

interface CatalogItem {
  id: string
  name: string
  category: string
  volume: number
  weight: number
  isFragile: boolean
  isHeavy: boolean
  isGlass: boolean
  image: string
}

interface ParsedInventoryItem {
  catalogItemId: string
  quantity: number
  confidence: number
  evidence: string
}

interface PendingResolution {
  sourceLabel: string
  quantity: number
  reason: 'ambiguous' | 'not_found'
  question: string
  suggestions: Array<{
    catalogItemId: string
    confidence: number
    reason: string
  }>
}

interface InventoryAiAssistantProps {
  catalog: CatalogItem[]
  onApply: (items: ParsedInventoryItem[]) => void
  onFindManually?: (query: string) => void
}

interface PreviewImage {
  name: string
  dataUrl: string
}

async function compressImage(file: File): Promise<string> {
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = original
  })

  const maxDimension = 1024
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))

  const render = (quality: number) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return original
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  }

  let result = render(0.7)
  // Mantener 5 fotos bajo un payload razonable para funciones serverless.
  for (let attempt = 0; result.length > 700_000 && attempt < 3; attempt += 1) {
    canvas.width = Math.max(1, Math.round(canvas.width * 0.78))
    canvas.height = Math.max(1, Math.round(canvas.height * 0.78))
    result = render(Math.max(0.48, 0.62 - attempt * 0.06))
  }
  return result
}

export default function InventoryAiAssistant({
  catalog,
  onApply,
  onFindManually,
}: InventoryAiAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [text, setText] = useState('')
  const [images, setImages] = useState<PreviewImage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)

  useEffect(() => {
    try {
      setConversationId(sessionStorage.getItem('yme_ai_conversation_id'))
    } catch {}
  }, [])

  const rememberConversation = (id: string) => {
    setConversationId(id)
    try { sessionStorage.setItem('yme_ai_conversation_id', id) } catch {}
  }
  const [lastSummary, setLastSummary] = useState<string | null>(null)
  const [clarification, setClarification] = useState<string | null>(null)
  const [unresolved, setUnresolved] = useState<string[]>([])
  const [pendingResolutions, setPendingResolutions] = useState<PendingResolution[]>([])

  const canSubmit = useMemo(
    () => !isLoading && (text.trim().length > 0 || images.length > 0),
    [images.length, isLoading, text]
  )

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files || []).slice(0, Math.max(0, 5 - images.length))
    if (!picked.length) return

    try {
      const converted = await Promise.all(
        picked.map(async (file) => ({ name: file.name, dataUrl: await compressImage(file) }))
      )
      setImages((prev) => [...prev, ...converted].slice(0, 5))
    } catch (error) {
      console.error('[Inventory AI] image compression', error)
      toast.error('No pude preparar una de las fotos')
    } finally {
      event.target.value = ''
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) return

    const pendingContext = pendingResolutions.map((pending) => pending.sourceLabel).join(', ')
    const requestText = clarification && text.trim()
      ? `Contexto pendiente: ${pendingContext || unresolved.join(', ')}. Pregunta anterior: ${clarification}. Respuesta del usuario: ${text.trim()}`
      : text.trim()

    setIsLoading(true)
    setLastSummary(null)

    try {
      const response = await fetch('/api/ai/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          text: requestText,
          images: images.map((image) => image.dataUrl),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'No pude interpretar el inventario')
      if (data.conversationId) rememberConversation(data.conversationId)

      const recognized: ParsedInventoryItem[] = Array.isArray(data.items) ? data.items : []
      if (recognized.length > 0) {
        onApply(recognized)
        const total = recognized.reduce((sum, item) => sum + item.quantity, 0)
        toast.success(`IA: agregué ${total} unidad${total === 1 ? '' : 'es'} al inventario`)
      } else if (!Array.isArray(data.pendingResolutions) || data.pendingResolutions.length === 0) {
        toast('No encontré items seguros para agregar')
      }

      setLastSummary(data.summary || null)
      setClarification(data.clarificationQuestion || null)
      setUnresolved(Array.isArray(data.unresolved) ? data.unresolved : [])
      setPendingResolutions(Array.isArray(data.pendingResolutions) ? data.pendingResolutions : [])
      setText('')
      setImages([])
    } catch (error) {
      console.error('[Inventory AI]', error)
      toast.error(error instanceof Error ? error.message : 'Error usando el asistente')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResolve = (index: number, suggestion: PendingResolution['suggestions'][number]) => {
    const pending = pendingResolutions[index]
    const catalogItem = catalog.find((item) => item.id === suggestion.catalogItemId)
    if (!pending || !catalogItem) return

    onApply([{
      catalogItemId: catalogItem.id,
      quantity: pending.quantity,
      confidence: suggestion.confidence,
      evidence: `Confirmado por el usuario para: ${pending.sourceLabel}`,
    }])

    setPendingResolutions((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
    setUnresolved((prev) => prev.filter((item) => item !== pending.sourceLabel))
    toast.success(`${catalogItem.name}${pending.quantity > 1 ? ` x${pending.quantity}` : ''} agregado`)
  }

  const handleIgnore = (index: number) => {
    const pending = pendingResolutions[index]
    if (!pending) return
    setPendingResolutions((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
    setUnresolved((prev) => prev.filter((item) => item !== pending.sourceLabel))
  }

  const handleFindManually = (index: number) => {
    const pending = pendingResolutions[index]
    if (!pending) return
    onFindManually?.(pending.sourceLabel)
    setIsOpen(false)
    toast(`Buscando “${pending.sourceLabel}” en el catálogo`)
  }

  return (
    <>
      {/* Launcher visible: se ubica en la esquina superior derecha del bloque de inventario. */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group relative w-full overflow-hidden rounded-2xl border-2 border-primary-300 bg-gradient-to-br from-primary-50 via-white to-lime-50 p-4 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-primary-500 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-primary-100"
        aria-label="Abrir asistente de inventario con IA"
      >
        <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary-300/30 blur-2xl" />
        <span className="pointer-events-none absolute right-5 top-5 h-3 w-3 rounded-full bg-primary-500 animate-ping" />

        <div className="relative flex items-start gap-3">
          <div className="relative shrink-0 rounded-2xl bg-primary-600 p-3 text-white shadow-md">
            <span className="absolute inset-0 rounded-2xl bg-primary-400/40 animate-pulse" />
            <Sparkles className="relative h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                Asistente IA
              </span>
              <span className="text-[11px] font-bold text-primary-700">Texto + fotos</span>
            </div>
            <p className="text-base font-black leading-tight text-gray-950">
              ¿Quieres terminar el inventario mucho más rápido?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              Cuéntanos qué moverás o sube fotos. Te proponemos los objetos y tú confirmas lo dudoso con un clic.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-black text-primary-700 group-hover:gap-2 transition-all">
              PROBAR NUESTRA MEJOR HERRAMIENTA <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </button>

      {isOpen && (
        <Card className="fixed inset-x-4 bottom-4 top-24 z-[60] overflow-y-auto border-2 border-primary-200 shadow-2xl lg:inset-x-auto lg:bottom-auto lg:right-6 lg:top-[205px] lg:w-[470px] lg:max-h-[calc(100vh-225px)]">
          <div className="mb-4 flex items-start justify-between gap-3 border-b pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-primary-100 p-2">
                  <Sparkles className="h-5 w-5 text-primary-700" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary-600">Hazlo en segundos</p>
                  <h3 className="font-black text-gray-950">Inventario rápido con IA</h3>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                Describe lo que moverás o agrega hasta 5 fotos. Solo agregamos objetos existentes en tu catálogo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Cerrar asistente"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Ej: un refri, lavadora, cama king, dos veladores, sofá de 3 cuerpos y unas 15 cajas…"
            rows={4}
            className="w-full resize-none rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <ImagePlus className="h-4 w-4" />
              Agregar fotos
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFiles}
                disabled={images.length >= 5}
              />
            </label>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Camera className="h-3.5 w-3.5" />
              {images.length}/5 fotos
            </span>
          </div>

          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {images.map((image, index) => (
                <div key={`${image.name}-${index}`} className="relative aspect-square overflow-hidden rounded-lg border bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.dataUrl} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                    aria-label={`Quitar foto ${index + 1}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button onClick={handleSubmit} disabled={!canSubmit} className="mt-4 w-full" size="lg">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Analizando…
              </>
            ) : (
              <>
                <Send className="mr-2 h-5 w-5" />
                Analizar y agregar al inventario
              </>
            )}
          </Button>

          {lastSummary && (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{lastSummary}</span>
              </div>
            </div>
          )}

          {pendingResolutions.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-black text-gray-900">Necesito tu confirmación</p>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  {pendingResolutions.length} pendiente{pendingResolutions.length === 1 ? '' : 's'}
                </span>
              </div>

              {pendingResolutions.map((pending, index) => (
                <div key={`${pending.sourceLabel}-${index}`} className="rounded-xl border-2 border-amber-200 bg-amber-50/70 p-3">
                  <p className="text-sm font-black text-amber-950">
                    “{pending.sourceLabel}”{pending.quantity > 1 ? ` · x${pending.quantity}` : ''}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900">{pending.question}</p>

                  {pending.suggestions.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {pending.suggestions.map((suggestion) => {
                        const item = catalog.find((catalogItem) => catalogItem.id === suggestion.catalogItemId)
                        if (!item) return null
                        return (
                          <button
                            key={suggestion.catalogItemId}
                            type="button"
                            onClick={() => handleResolve(index, suggestion)}
                            className="flex w-full items-center justify-between gap-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-left transition hover:border-primary-500 hover:bg-primary-50"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-900">{item.name}</p>
                              <p className="text-[11px] text-gray-500">{item.volume} m³ · {item.weight} kg</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-primary-100 px-2 py-1 text-[10px] font-black text-primary-800">
                              Elegir
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 rounded-lg bg-white/70 p-2 text-xs text-amber-900">
                      No encontré una equivalencia suficientemente cercana en el catálogo.
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {onFindManually && (
                      <button
                        type="button"
                        onClick={() => handleFindManually(index)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                      >
                        <Search className="h-3.5 w-3.5" />
                        Buscar en catálogo
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleIgnore(index)}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-white/60 hover:text-gray-700"
                    >
                      Omitir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {clarification && pendingResolutions.length === 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">{clarification}</p>
              <p className="mt-1 text-xs">Respóndeme arriba y volveré a intentar solo con lo pendiente.</p>
            </div>
          )}

          {unresolved.length > 0 && pendingResolutions.length === 0 && !clarification && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Por revisar: {unresolved.join(', ')}
            </div>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
            La detección visual y el volumen son estimativos. Revisa las cantidades antes de continuar.
          </p>
        </Card>
      )}
    </>
  )
}
