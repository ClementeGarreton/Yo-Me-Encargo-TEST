'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Button from './Button'
import { buildBusinessWhatsAppLink } from '@/lib/whatsapp'
import Card from './Card'

interface ChatMessage {
  text: string
  isUser: boolean
  ctaPath?: string | null
}

const quickQuestions = ['¿Cómo funciona la cotización?', 'Necesito una mudanza grande']

export default function ChatBot() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      text: '¡Hola! Soy el asistente de Yo Me Encargo. Cuéntame qué necesitas mover y te oriento para cotizarlo.',
      isUser: false,
    },
  ])
  const [input, setInput] = useState('')

  const handleSend = async (preset?: string) => {
    const text = (preset ?? input).trim()
    if (!text || isLoading) return

    const userMessage: ChatMessage = { text, isUser: true }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/ai/sales-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          messages: nextMessages.slice(-10).map((message) => ({
            role: message.isUser ? 'user' : 'assistant',
            content: message.text,
          })),
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'No pude responder en este momento')
      if (data.conversationId) rememberConversation(data.conversationId)

      setMessages((prev) => [
        ...prev,
        {
          text: data.answer,
          isUser: false,
          ctaPath: data.recommendQuote ? data.ctaPath : null,
        },
      ])
    } catch (error) {
      console.error('[ChatBot]', error)
      setMessages((prev) => [
        ...prev,
        {
          text: 'No pude conectarme al asistente ahora. Puedes continuar directamente al cotizador y completar tu solicitud.',
          isUser: false,
          ctaPath: '/cotizador?start=online',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {!isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:max-w-sm">
          <button
            onClick={() => setIsOpen(true)}
            className="group hidden w-full max-w-sm overflow-hidden rounded-2xl border-2 border-primary-200 bg-white p-4 text-left shadow-2xl transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-primary-200/40 sm:block"
            aria-label="Abrir asistente de Yo Me Encargo"
          >
            <div className="pointer-events-none absolute" />
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-primary-700">
                <Sparkles className="h-3.5 w-3.5" />
                Asistente IA
              </span>
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_0_6px_rgba(34,197,94,0.18)] animate-pulse" />
            </div>

            <h3 className="text-lg font-extrabold leading-tight text-gray-950">
              ¿Quieres cotizar más rápido y con ayuda guiada?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Haz tus preguntas aquí y te llevamos directo al tipo de cotización que más te conviene.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-primary-700">
              Probar nuestra mejor herramienta
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>

          <button
            onClick={() => setIsOpen(true)}
            className="group relative inline-flex items-center gap-3 rounded-full bg-primary-600 px-5 py-4 text-white shadow-2xl transition-all hover:scale-[1.02] hover:bg-primary-700"
            aria-label="Abrir asistente de Yo Me Encargo"
          >
            <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-green-400 ring-4 ring-green-200 animate-pulse" />
            <MessageCircle className="h-6 w-6 shrink-0" />
            <span className="text-sm font-black uppercase tracking-wide sm:text-base">Abrir asistente</span>
          </button>
        </div>
      )}

      {isOpen && (
        <Card className="fixed bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-96 h-[560px] flex flex-col z-50 shadow-2xl border-2 border-primary-200">
          <div className="flex items-center justify-between mb-4 pb-4 border-b">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold">Asistente Yo Me Encargo</h3>
                <p className="text-xs text-gray-500">Orientación y cotización</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Cerrar chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-3 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900">
            <p className="font-semibold">Haz una pregunta y te diré cómo cotizar mejor.</p>
            <p className="mt-1 text-xs text-primary-800">Puedes partir por una duda general o contarme directamente qué necesitas mover.</p>
          </div>

          <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-1">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-4 py-2 rounded-lg ${
                    message.isUser ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                  {!message.isUser && message.ctaPath && (
                    <button
                      onClick={() => router.push(message.ctaPath!)}
                      className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
                    >
                      Ir al cotizador
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Pensando…
                </div>
              </div>
            )}
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {quickQuestions.map((question) => (
              <button
                key={question}
                onClick={() => handleSend(question)}
                disabled={isLoading}
                className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>

          <a
            href={buildBusinessWhatsAppLink('Hola, quiero cotizar mi mudanza por WhatsApp con el asistente.')}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#25D366] bg-green-50 px-3 py-2 text-sm font-black text-green-800 transition hover:bg-green-100"
          >
            <MessageCircle className="h-4 w-4" />
            Cotizar mi mudanza por WhatsApp
          </a>

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Cuéntame qué necesitas..."
              disabled={isLoading}
              className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
            />
            <Button onClick={() => handleSend()} size="sm" className="px-3" disabled={isLoading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}
    </>
  )
}
