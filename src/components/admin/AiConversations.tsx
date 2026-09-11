'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bot, MessageCircle, Search, UserRound, Zap } from 'lucide-react'
import Card from '@/components/ui/Card'

interface Conversation {
  id: string
  channel: 'web' | 'whatsapp'
  external_user_id: string | null
  customer_name: string | null
  quote_id: string | null
  status: string
  converted: boolean
  input_tokens: number
  output_tokens: number
  estimated_ai_cost_usd: number
  model: string | null
  last_message_at: string
}

interface Detail {
  conversation: Conversation
  messages: Array<{ id: string; role: string; direction: string; content: string; message_type: string; created_at: string }>
  actions: Array<{ id: string; action: string; structured_payload: any; success: boolean; error: string | null; created_at: string }>
  quoteSession: any
}

export default function AiConversations() {
  const [rows, setRows] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [channel, setChannel] = useState('all')
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [waStatus, setWaStatus] = useState<{ configured: boolean; graphVersion: string } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (channel !== 'all') params.set('channel', channel)
      if (status !== 'all') params.set('status', status)
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/admin/ai-conversations?${params}`)
      const data = await res.json()
      if (res.ok) setRows(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [channel, status])

  useEffect(() => {
    fetch('/api/admin/whatsapp/status')
      .then((r) => r.json())
      .then((data) => setWaStatus(data))
      .catch(() => setWaStatus(null))
  }, [])

  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    fetch(`/api/admin/ai-conversations/${selectedId}`)
      .then((r) => r.json())
      .then((data) => setDetail(data))
      .catch(() => setDetail(null))
  }, [selectedId])

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.cost += Number(row.estimated_ai_cost_usd || 0)
    acc.converted += row.converted ? 1 : 0
    return acc
  }, { cost: 0, converted: 0 }), [rows])

  return (
    <div className="space-y-5">
      {waStatus && (
        <div className={`rounded-2xl border p-4 text-sm ${waStatus.configured ? 'border-green-200 bg-green-50 text-green-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          <p className="font-black">WhatsApp Cloud API: {waStatus.configured ? 'lista para recibir mensajes' : 'pendiente de credenciales de Meta'}</p>
          <p className="mt-1 text-xs">Graph API {waStatus.graphVersion}. El webhook de producción debe apuntar a <code>/api/whatsapp/webhook</code>.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5"><p className="text-xs uppercase text-gray-500">Conversaciones</p><p className="mt-1 text-3xl font-black">{rows.length}</p></Card>
        <Card className="p-5"><p className="text-xs uppercase text-gray-500">Con cotización</p><p className="mt-1 text-3xl font-black text-green-700">{totals.converted}</p></Card>
        <Card className="p-5"><p className="text-xs uppercase text-gray-500">Costo IA visible</p><p className="mt-1 text-3xl font-black">US${totals.cost.toFixed(4)}</p></Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Nombre, teléfono o cotización" className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm" />
          </div>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="all">Todos los canales</option><option value="whatsapp">WhatsApp</option><option value="web">Web</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="all">Todos los estados</option><option value="active">Activa</option><option value="quoted">Cotizó</option><option value="handoff">Ejecutivo</option><option value="closed">Cerrada</option><option value="error">Error</option>
          </select>
          <button onClick={load} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white">{loading ? 'Cargando…' : 'Buscar'}</button>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <Card className="max-h-[760px] overflow-y-auto p-0">
          {rows.length === 0 ? <p className="p-6 text-sm text-gray-500">Todavía no hay conversaciones registradas.</p> : rows.map((row) => (
            <button key={row.id} onClick={() => setSelectedId(row.id)} className={`w-full border-b p-4 text-left hover:bg-gray-50 ${selectedId === row.id ? 'bg-primary-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-gray-900">{row.customer_name || row.external_user_id || 'Visitante web'}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{row.channel === 'whatsapp' ? 'WhatsApp' : 'Web'} · {row.status}</p>
                </div>
                {row.converted && <span className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-bold text-green-800">COTIZÓ</span>}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-gray-500"><span>{row.quote_id || 'Sin cotización'}</span><span>US${Number(row.estimated_ai_cost_usd || 0).toFixed(4)}</span></div>
            </button>
          ))}
        </Card>

        <Card className="min-h-[500px] p-5">
          {!detail ? (
            <div className="flex min-h-[440px] items-center justify-center text-center text-gray-400"><div><Bot className="mx-auto mb-3 h-10 w-10"/><p>Selecciona una conversación para auditarla.</p></div></div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                <div><h3 className="text-xl font-black">{detail.conversation.customer_name || detail.conversation.external_user_id || 'Visitante'}</h3><p className="text-sm text-gray-500">{detail.conversation.channel} · {detail.conversation.model || 'modelo sin registrar'}</p></div>
                <div className="text-right text-xs text-gray-500"><p>{detail.conversation.input_tokens} in / {detail.conversation.output_tokens} out</p><p className="font-bold text-gray-800">US${Number(detail.conversation.estimated_ai_cost_usd || 0).toFixed(5)}</p></div>
              </div>

              {detail.quoteSession && <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm"><p className="font-bold text-green-900">Sesión de cotización</p><p className="mt-1 text-green-800">Sección {detail.quoteSession.current_section}/7 · {detail.quoteSession.status}{detail.quoteSession.estimated_price ? ` · $${Number(detail.quoteSession.estimated_price).toLocaleString('es-CL')}` : ''}</p></div>}

              <div className="space-y-3">
                {detail.messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${message.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                      <div className="mb-1 flex items-center gap-1 text-[10px] opacity-70">{message.role === 'user' ? <UserRound className="h-3 w-3"/> : <MessageCircle className="h-3 w-3"/>}{message.message_type}</div>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              {detail.actions.length > 0 && <details className="rounded-xl border border-gray-200 bg-gray-50 p-3"><summary className="cursor-pointer text-sm font-bold"><span className="inline-flex items-center gap-2"><Zap className="h-4 w-4"/>Acciones estructuradas ({detail.actions.length})</span></summary><div className="mt-3 space-y-2">{detail.actions.map((action) => <div key={action.id} className="rounded-lg bg-white p-3 text-xs"><p className="font-bold">{action.success ? '✓' : '✕'} {action.action}</p><pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap text-[10px] text-gray-600">{JSON.stringify(action.structured_payload, null, 2)}</pre></div>)}</div></details>}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
