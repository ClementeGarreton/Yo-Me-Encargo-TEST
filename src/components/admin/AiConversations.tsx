'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bot, RefreshCw, Search, ShieldCheck, Image as ImageIcon, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import Card from '@/components/ui/Card'
import {
  COMMERCIAL_LABELS, COMMERCIAL_STATUSES, type CommercialStatus,
} from '@/lib/admin/conversationCRM'

type Conversation = {
  id: string
  channel: string
  external_user_id: string | null
  customer_name: string | null
  quote_id: string | null
  status: string
  converted: boolean
  model: string | null
  is_router: boolean
  commercial_status: CommercialStatus
  bot_enabled: boolean
  input_tokens: number
  output_tokens: number
  estimated_ai_cost_usd: number
  started_at: string
  last_message_at: string
}
type Action = {
  id: string
  action: string
  structured_payload: Record<string, any>
  success: boolean
  error: string | null
  created_at: string
}
type Detail = {
  conversation: Conversation
  commercialStatus: CommercialStatus
  botEnabled: boolean
  messages: Array<{
    id: string; conversation_id: string; role: string; direction: string
    content: string; message_type: string; created_at: string
  }>
  actions: Action[]
  quoteSession: any
  booking: { id: string; payment_status?: string; status?: string; payment_type?: string; total_price?: number } | null
  photos: Array<{ messageId: string; recognized: string[]; url: string | null }>
}
function channelLabel(row: Conversation) {
  if (row.external_user_id?.startsWith('ig:')) return 'Instagram'
  return row.channel === 'whatsapp' ? 'WhatsApp' : 'Web'
}
function localeDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—'
}
function statusClass(status: CommercialStatus) {
  if (status === 'RECLAMO') return 'bg-red-100 text-red-800'
  if (status === 'VENDIDO') return 'bg-green-100 text-green-800'
  if (status === 'CERRADO') return 'bg-gray-100 text-gray-700'
  if (status === 'REVISAR') return 'bg-amber-100 text-amber-800'
  if (status === 'RESERVADO') return 'bg-blue-100 text-blue-800'
  return 'bg-indigo-100 text-indigo-700'
}
export default function AiConversations() {
  const [rows, setRows] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [channel, setChannel] = useState('all')
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [draftStatus, setDraftStatus] = useState<CommercialStatus>('REVISAR')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyBot, setBusyBot] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (channel !== 'all') params.set('channel', channel)
      if (status !== 'all') params.set('status', status)
      if (q.trim()) params.set('q', q.trim())
      const response = await fetch(`/api/admin/ai-conversations?${params}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo cargar la bandeja')
      setRows(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally { setLoading(false) }
  }, [channel, status, q])

  const loadDetail = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/admin/ai-conversations/${id}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error leyendo conversación')
      setDetail(data)
      setDraftStatus(data.commercialStatus || 'REVISAR')
    } catch (err) {
      setDetail(null)
      toast.error(err instanceof Error ? err.message : 'Error de lectura')
    }
  }, [])

  useEffect(() => { load() }, [channel, status]) // Buscar se ejecuta con el botón/Enter.
  useEffect(() => { if (selectedId) loadDetail(selectedId); else setDetail(null) }, [selectedId, loadDetail])
  const counts = useMemo(() => Object.fromEntries(COMMERCIAL_STATUSES.map(key => [key, rows.filter(row => row.commercial_status === key).length])) as Record<CommercialStatus, number>, [rows])
  const activeQuotes = rows.filter(row => !row.is_router && row.status === 'active').length

  async function saveCommercial() {
    if (!selectedId || !detail) return
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/ai-conversations/${selectedId}/commercial`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: draftStatus, note }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se guardó el estado')
      toast.success(`Estado: ${COMMERCIAL_LABELS[draftStatus]}`)
      setNote('')
      await Promise.all([load(), loadDetail(selectedId)])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error de escritura')
    } finally { setSaving(false) }
  }

  async function changeBot(enabled: boolean) {
    if (!selectedId) return
    setBusyBot(true)
    try {
      const response = await fetch(`/api/admin/ai-conversations/${selectedId}/bot-control`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, note: enabled ? 'Nueva solicitud de flete; cotización solo bajo comando COTIZAR' : 'Atención manual desde panel administrativo' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo cambiar el bot')
      toast.success(enabled ? 'Bot disponible solo si el cliente escribe COTIZAR' : 'IA bloqueada para este contacto')
      await Promise.all([load(), loadDetail(selectedId)])
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error de control') }
    finally { setBusyBot(false) }
  }

  const current = detail?.conversation
  return <div className="space-y-5">
    <div>
      <h2 className="text-xl font-extrabold text-gray-900">Bandeja comercial y auditoría</h2>
      <p className="mt-1 text-sm text-gray-500">Estado comercial asignado por Tommy, independiente de la IA. Las conversaciones y fotografías se consultan en la base de datos.</p>
    </div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Card className="p-4"><p className="text-xs text-gray-500">Por revisar</p><p className="text-3xl font-black text-amber-700">{counts.REVISAR}</p></Card>
      <Card className="p-4"><p className="text-xs text-gray-500">Cotizaciones activas</p><p className="text-3xl font-black">{activeQuotes}</p></Card>
      <Card className="p-4"><p className="text-xs text-gray-500">Vendidas</p><p className="text-3xl font-black text-green-700">{counts.VENDIDO}</p></Card>
      <Card className="p-4"><p className="text-xs text-gray-500">Reclamos</p><p className="text-3xl font-black text-red-700">{counts.RECLAMO}</p></Card>
    </div>
    <p className="text-xs text-gray-500">Resumen sobre las últimas 250 conversaciones disponibles. «Vendido» es clasificación manual; un pago solo se considera confirmado cuando lo registra Flow.</p>
    <Card className="p-4"><div className="flex flex-wrap gap-3">
      <div className="relative min-w-[180px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"/><input className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} placeholder="Nombre, teléfono o ID de cotización" aria-label="Buscar conversaciones"/></div>
      <select className="rounded-lg border px-2 py-2 text-sm" value={channel} onChange={e => setChannel(e.target.value)} aria-label="Filtrar canal"><option value="all">Todos los canales</option><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="web">Web</option></select>
      <select className="rounded-lg border px-2 py-2 text-sm" value={status} onChange={e => setStatus(e.target.value)} aria-label="Filtrar estado comercial"><option value="all">Todos los estados</option>{COMMERCIAL_STATUSES.map(key => <option key={key} value={key}>{COMMERCIAL_LABELS[key]}</option>)}</select>
      <button onClick={load} className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4"/>{loading ? 'Cargando…' : 'Actualizar'}</button>
    </div></Card>
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="grid gap-5 xl:grid-cols-[345px_1fr]">
      <Card className="max-h-[820px] overflow-y-auto p-0">
        {rows.length === 0 && <p className="p-6 text-sm text-gray-500">No aparecen conversaciones para este filtro.</p>}
        {rows.map(row => <button key={row.id} onClick={() => { setSelectedId(row.id); setNote('') }} className={`w-full border-b p-4 text-left hover:bg-gray-50 ${row.id === selectedId ? 'bg-blue-50' : ''}`}>
          <div className="flex items-start justify-between gap-2"><p className="min-w-0 truncate font-semibold text-gray-900">{row.customer_name || row.external_user_id || 'Visitante'}</p><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${statusClass(row.commercial_status)}`}>{COMMERCIAL_LABELS[row.commercial_status]}</span></div>
          <p className="mt-1 text-xs text-gray-500">{channelLabel(row)} · {row.is_router ? 'Recepción / mensajes previos' : `IA: ${row.status}`}</p>
          <div className="mt-2 flex justify-between gap-2 text-xs text-gray-500"><span className="truncate">{row.quote_id || 'Sin cotización'}</span><time>{localeDate(row.last_message_at)}</time></div>
        </button>)}
      </Card>
      <Card className="min-h-[520px] p-5">
        {!detail ? <div className="flex min-h-[400px] items-center justify-center text-center text-gray-400"><div><Bot className="mx-auto mb-3 h-9 w-9"/><p>Selecciona una conversación para ver su expediente.</p></div></div> : <div className="space-y-5">
          <div className="border-b pb-4"><h3 className="text-xl font-bold">{current?.customer_name || current?.external_user_id || 'Visitante'}</h3><p className="mt-1 text-xs text-gray-500">{current && channelLabel(current)} · Estado técnico: {current?.status} · {current?.is_router ? 'Recepción' : 'Cotización'} · Última actividad: {localeDate(current?.last_message_at)}</p></div>
          <section className="rounded-xl border border-blue-200 bg-blue-50 p-4"><h4 className="mb-3 font-bold text-blue-900">Clasificación comercial</h4>
            <div className="flex flex-wrap gap-2"><select className="min-w-[190px] flex-1 rounded-lg border border-gray-300 bg-white p-2 text-sm" aria-label="Nuevo estado comercial" value={draftStatus} onChange={e => setDraftStatus(e.target.value as CommercialStatus)}>{COMMERCIAL_STATUSES.map(key => <option key={key} value={key}>{COMMERCIAL_LABELS[key]}</option>)}</select>
              <button disabled={saving || draftStatus === detail.commercialStatus} onClick={saveCommercial} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{saving ? 'Guardando…' : 'Guardar estado'}</button></div>
            <input className="mt-2 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm" value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="Observación de Tommy (opcional)" aria-label="Motivo del cambio de estado" />
            <p className="mt-2 text-xs text-blue-800">Cada cambio registra el usuario y la fecha. Cambiar el estado comercial no inicia ni cancela una cotización automáticamente.</p></section>
          {current?.channel === 'whatsapp' && <section className="rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-bold">Atención automática de este contacto</p><p className="text-xs text-gray-500">{detail.botEnabled ? 'Disponible para COTIZAR' : 'Bloqueada: atención humana'}</p></div><button disabled={busyBot} onClick={() => changeBot(!detail.botEnabled)} className={`rounded-lg px-3 py-2 text-sm font-bold ${detail.botEnabled ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{busyBot ? 'Guardando…' : detail.botEnabled ? 'Desactivar IA' : 'Permitir nueva cotización'}</button></div><p className="mt-2 text-xs text-gray-500">Reactivar no envía mensajes espontáneos ni llama a OpenAI. El cliente deberá escribir COTIZAR.</p></section>}
          {detail.quoteSession && <section className="rounded-xl bg-gray-50 p-3 text-sm"><h4 className="font-bold">Cotización</h4><p>Sección {detail.quoteSession.current_section}/7 · {detail.quoteSession.status} · {detail.quoteSession.estimated_price ? `$${Number(detail.quoteSession.estimated_price).toLocaleString('es-CL')}` : 'Sin precio final'}</p><p className="mt-1 text-xs text-gray-500">{current?.quote_id || detail.quoteSession.quote_id || 'Sin identificador final'}</p></section>}
          {detail.booking && <section className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm"><h4 className="font-bold text-green-900">Reserva / Pago registrado en Flow</h4><p className="mt-1">Reserva: {detail.booking.status || '—'} · Pago: <strong>{detail.booking.payment_status || 'pendiente'}</strong></p><p className="text-xs">{detail.booking.payment_type || ''} · {detail.booking.total_price ? `$${Number(detail.booking.total_price).toLocaleString('es-CL')}` : 'Sin monto'}</p></section>}
          <section className="rounded-xl border p-3"><h4 className="mb-3 flex items-center gap-2 font-bold"><ImageIcon className="h-4 w-4"/> Fotografías archivadas ({detail.photos.length})</h4>
            {detail.photos.length === 0 ? <p className="text-xs text-gray-500">No hay fotografías persistidas para esta conversación.</p> : <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{detail.photos.map(photo => <div key={photo.messageId} className="text-xs">{photo.url ? <a target="_blank" rel="noopener noreferrer" href={photo.url} title="Abrir original archivado"><img className="h-28 w-full rounded-lg border object-cover" src={photo.url} alt="Fotografía del inventario"/><span className="mt-1 inline-flex items-center gap-1 text-blue-700"><ExternalLink className="h-3 w-3"/>Abrir original</span></a> : <span className="text-red-600">Original no disponible</span>}<p className="mt-1 text-gray-500">{photo.recognized.join(', ') || 'Fotografía recibida'}</p></div>)}</div>}
          </section>
          <section><h4 className="mb-3 font-bold">Mensajes ({detail.messages.length})</h4><div className="max-h-[560px] space-y-3 overflow-y-auto rounded-xl border bg-gray-50 p-3">
            {detail.messages.length === 0 && <p className="text-sm text-gray-500">Todavía no hay mensajes registrados.</p>}
            {detail.messages.map(m => <div key={m.id} className={`flex ${m.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}><div className={`max-w-[90%] rounded-xl p-3 text-sm ${m.direction === 'inbound' ? 'bg-white text-gray-800' : 'bg-green-100 text-gray-900'}`}><p className="mb-1 text-[10px] text-gray-500">{m.direction === 'inbound' ? 'Cliente' : 'Empresa'} · {m.message_type} · {localeDate(m.created_at)}</p><p className="whitespace-pre-wrap break-words">{m.content || '[Adjunto]'}</p></div></div>)}
          </div></section>
          <details className="rounded-xl border p-3" open><summary className="cursor-pointer font-semibold"><span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4"/> Auditoría de acciones ({detail.actions.length})</span></summary><div className="mt-3 max-h-[350px] space-y-2 overflow-y-auto">{detail.actions.map(action => <div key={action.id} className="rounded-lg bg-gray-50 p-3 text-xs"><p className="font-semibold">{action.action} · {localeDate(action.created_at)}</p>{action.action === 'crm_status_changed' ? <p className="mt-1">{action.structured_payload?.from} → {action.structured_payload?.to} · Por: {action.structured_payload?.actor || '—'}</p> : <p className="mt-1 text-gray-500">{action.success ? 'Correcto' : `Error: ${action.error || 'desconocido'}`}</p>}{action.structured_payload?.note && <p className="mt-1 italic">{action.structured_payload.note}</p>}</div>)}</div></details>
        </div>}
      </Card>
    </div>
  </div>
}
