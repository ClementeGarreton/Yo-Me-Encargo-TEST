// Rate limiting por IP, sin dependencias externas.
//
// CONTEXTO: el 26-jul-2026 el sitio se cayó (Vercel DEPLOYMENT_DISABLED) tras un pico
// de ~22GB de "Fast Origin Transfer" en un día, sin correlato en las sesiones reales de
// GA4 → tráfico automatizado golpeando rutas de API, no visitantes.
//
// ALCANCE Y LÍMITES DE ESTA CAPA (importante, no sobreestimar):
// Este limitador corre DENTRO de Vercel (middleware), así que la petición ya llegó al
// cómputo cuando la rechazamos. Sirve para:
//   - Cortar el abuso antes de tocar Supabase / Geoapify (costos externos reales).
//   - Frenar fuerza bruta contra el login de admin.
//   - Limitar el daño de un flood desde pocas IPs.
// NO reemplaza a una capa delante del origen (Cloudflare proxy / Vercel WAF), que es la
// única que evita que el tráfico se facture. Ver docs/SEGURIDAD.md.
//
// ESTADO EN MEMORIA: el contador vive en memoria del isolate, no en un store
// compartido. Con Fluid Compute las instancias se reutilizan, así que un flood sostenido
// desde una IP sí pega repetidamente en la misma instancia y se corta. Pero el estado no
// se comparte entre instancias/regiones y se pierde en cold start: un ataque distribuido
// lo diluye. Para garantía dura hace falta un store (Upstash Redis / Vercel KV).

export interface RateLimitRule {
  /** Máximo de peticiones permitidas dentro de la ventana. */
  limit: number
  /** Tamaño de la ventana en milisegundos. */
  windowMs: number
  /** Nombre del bucket, para que rutas distintas no compartan contador. */
  bucket: string
}

export interface RateLimitResult {
  ok: boolean
  limit: number
  remaining: number
  /** Segundos que el cliente debe esperar (solo relevante si ok === false). */
  retryAfterSec: number
}

interface Counter {
  count: number
  resetAt: number
}

const counters = new Map<string, Counter>()

// Techo de entradas para que el Map no crezca sin control con IPs rotativas.
const MAX_ENTRIES = 10_000

function purgeExpired(now: number): void {
  for (const [key, counter] of counters) {
    if (counter.resetAt <= now) counters.delete(key)
  }
  // Si tras purgar sigue enorme (muchas IPs activas), vaciamos: preferimos perder
  // precisión antes que acumular memoria sin límite en el isolate.
  if (counters.size > MAX_ENTRIES) counters.clear()
}

/**
 * Ventana fija por (bucket, identificador). Devuelve si la petición se permite.
 */
export function checkRateLimit(identifier: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now()
  const key = `${rule.bucket}:${identifier}`

  // Limpieza oportunista: solo cuando hay volumen, para no pagarla en cada request.
  if (counters.size > 500) purgeExpired(now)

  const existing = counters.get(key)

  if (!existing || existing.resetAt <= now) {
    counters.set(key, { count: 1, resetAt: now + rule.windowMs })
    return { ok: true, limit: rule.limit, remaining: rule.limit - 1, retryAfterSec: 0 }
  }

  existing.count += 1

  if (existing.count > rule.limit) {
    return {
      ok: false,
      limit: rule.limit,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  return {
    ok: true,
    limit: rule.limit,
    remaining: rule.limit - existing.count,
    retryAfterSec: 0,
  }
}

/**
 * IP real del cliente. El orden importa: si algún día ponemos Cloudflare como proxy
 * delante de Vercel, `cf-connecting-ip` trae la IP del visitante mientras que
 * `x-forwarded-for` pasa a incluir también las de Cloudflare.
 */
export function getClientIp(headers: Headers, fallback?: string): string {
  const cfIp = headers.get('cf-connecting-ip')
  if (cfIp) return cfIp.trim()

  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }

  return fallback || 'unknown'
}

const MIN = 60_000
const HOUR = 60 * MIN

/**
 * Rutas EXENTAS de rate limit. Cada una tiene un motivo concreto:
 * romperlas cuesta plata o rompe operación.
 */
export const RATE_LIMIT_EXEMPT: readonly string[] = [
  // Webhooks de Flow (pasarela de pago): llegan siempre desde las mismas IPs de Flow.
  // Limitarlas por IP haría perder confirmaciones de pago reales.
  '/api/payment',
  '/api/payment/confirm',
  '/api/payment/result',
  // Webhook firmado de Meta/WhatsApp: varias conversaciones comparten IPs de Meta.
  '/api/whatsapp/webhook',
  // Cron de Vercel (vercel.json): corre desde infraestructura de Vercel.
  '/api/admin/cleanup-bookings',
]

/**
 * Reglas por prefijo de ruta, de más específica a más general. La primera que
 * coincide gana, así que el orden de este array es significativo.
 */
export const RATE_LIMIT_RULES: readonly { prefix: string; rule: RateLimitRule }[] = [
  // Login de admin: anti fuerza bruta.
  {
    prefix: '/api/admin/auth/login',
    rule: { bucket: 'admin-login', limit: 10, windowMs: 15 * MIN },
  },

  // PIN del panel de choferes: son 4 dígitos, así que sin un límite estricto se
  // adivina por fuerza bruta en minutos.
  {
    prefix: '/api/trabajos/verify-pin',
    rule: { bucket: 'driver-pin', limit: 10, windowMs: 15 * MIN },
  },

  // Cambio de contraseña: exige la contraseña actual, así que también es un objetivo
  // de fuerza bruta (con una sesión robada).
  {
    prefix: '/api/admin/auth/change-password',
    rule: { bucket: 'change-password', limit: 10, windowMs: 15 * MIN },
  },

  // Subidas de archivos: es el vector que tumbó el sitio. Muy estricto.
  {
    prefix: '/api/photos/upload',
    rule: { bucket: 'upload', limit: 20, windowMs: HOUR },
  },
  {
    prefix: '/api/prospects/upload-pdf',
    rule: { bucket: 'upload', limit: 20, windowMs: HOUR },
  },
  {
    prefix: '/api/bookings/upload-pdf',
    rule: { bucket: 'upload', limit: 20, windowMs: HOUR },
  },

  // IA pública: cada llamada consume cuota de modelo. Se limita con más fuerza que
  // el resto de lecturas para evitar abuso o bots que generen costo artificial.
  {
    prefix: '/api/ai/',
    rule: { bucket: 'ai-public', limit: 30, windowMs: 10 * MIN },
  },

  // Proxies de Geoapify: cada llamada cuesta cuota de la API externa. Generoso porque
  // el autocompletado dispara varias mientras el usuario escribe la dirección.
  {
    prefix: '/api/maps/',
    rule: { bucket: 'maps', limit: 100, windowMs: 5 * MIN },
  },

  // Escrituras públicas: crean registros, mandan correos, generan PDFs.
  {
    prefix: '/api/prospects/send-quote',
    rule: { bucket: 'public-write', limit: 15, windowMs: HOUR },
  },
  {
    prefix: '/api/prospects/create',
    rule: { bucket: 'public-write', limit: 30, windowMs: HOUR },
  },
  {
    prefix: '/api/quote/checkout',
    rule: { bucket: 'public-write', limit: 30, windowMs: HOUR },
  },
  {
    prefix: '/api/bookings/create',
    rule: { bucket: 'public-write', limit: 30, windowMs: HOUR },
  },
  {
    prefix: '/api/home-quote/create',
    rule: { bucket: 'public-write', limit: 30, windowMs: HOUR },
  },
  {
    prefix: '/api/pdf',
    rule: { bucket: 'public-write', limit: 40, windowMs: HOUR },
  },
  {
    prefix: '/api/quotes',
    rule: { bucket: 'public-write', limit: 40, windowMs: HOUR },
  },

  // Red de contención para cualquier otra API (lecturas incluidas).
  {
    prefix: '/api/',
    rule: { bucket: 'api-general', limit: 300, windowMs: MIN },
  },
]

export function isRateLimitExempt(pathname: string): boolean {
  return RATE_LIMIT_EXEMPT.includes(pathname)
}

export function findRateLimitRule(pathname: string): RateLimitRule | null {
  for (const entry of RATE_LIMIT_RULES) {
    if (pathname.startsWith(entry.prefix)) return entry.rule
  }
  return null
}
