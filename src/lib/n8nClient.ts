/**
 * Cliente único para el webhook de n8n que envía los correos de cotización.
 * Centraliza la URL (antes duplicada en dos rutas) y agrega:
 *  - timeout con AbortController (antes el fetch podía colgarse indefinidamente),
 *  - logging estructurado del MOTIVO del fallo (timeout / red / HTTP + body + timestamp),
 *  - un resultado tipado para que la ruta devuelva un error claro.
 *
 * NO reintenta automáticamente: el workflow de n8n responde DESPUÉS de enviar el
 * correo, así que un timeout es ambiguo (el correo pudo haberse enviado) y un
 * reintento podría duplicar el envío al cliente. El reenvío manual desde el panel
 * admin cubre el caso de fallo real.
 */

export const N8N_QUOTE_WEBHOOK_URL =
  process.env.N8N_QUOTE_WEBHOOK_URL ||
  'https://core.zensus.cl/webhook/d4594da2-04fb-44b3-baa5-5301e8f49521'

export interface N8nPostResult {
  ok: boolean
  status?: number
  /** Motivo legible del fallo (para logs y para devolver al cliente). */
  error?: string
}

export async function postQuoteWebhook(
  payload: unknown,
  opts: { timeoutMs?: number; label?: string } = {}
): Promise<N8nPostResult> {
  const timeoutMs = opts.timeoutMs ?? 12000
  const label = opts.label ?? 'quote'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const ts = new Date().toISOString()

  try {
    const res = await fetch(N8N_QUOTE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (res.ok) {
      console.info(`[n8n][${ts}][${label}] OK ${res.status}`)
      return { ok: true, status: res.status }
    }

    const body = await res.text().catch(() => '')
    const error = `n8n respondió HTTP ${res.status}: ${body.slice(0, 300)}`
    console.error(`[n8n][${ts}][${label}] ${error}`)
    return { ok: false, status: res.status, error }
  } catch (e: any) {
    clearTimeout(timer)
    const isTimeout = e?.name === 'AbortError'
    const error = isTimeout
      ? `n8n no respondió (timeout tras ${timeoutMs}ms)`
      : `error de red contactando n8n: ${e?.message || String(e)}`
    console.error(`[n8n][${ts}][${label}] ${error}`)
    return { ok: false, error }
  }
}
