// Sesión del panel público de choferes (/trabajos/[token]), protegida por PIN.
//
// Es una capa aparte de la sesión de admin (`adminSession.ts`) A PROPÓSITO: el payload
// firmado lleva la versión "d1" en vez de "v1", así el HMAC resultante es distinto y un
// token de chofer NUNCA valida como sesión de administrador aunque alguien lo copie a la
// cookie `admin_authenticated`.

const TOKEN_VERSION = 'd1'
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000 // 12h: cubre una jornada, no más.

export const DRIVER_SESSION_COOKIE = 'driver_access'

function getSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || ''
}

/** PIN para entrar al panel de choferes. Configurable por env. */
export function getDriverPin(): string {
  return process.env.DRIVER_PIN || '2026'
}

const encoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(data: string, secret: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return toBase64Url(new Uint8Array(signature))
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

/** Compara el PIN en tiempo constante para no filtrar dígitos por timing. */
export function isValidDriverPin(candidate: string): boolean {
  const expected = getDriverPin()
  const a = String(candidate || '').trim()
  if (a.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ expected.charCodeAt(i)
  return mismatch === 0
}

export async function createDriverSessionToken(ttlMs: number = DEFAULT_TTL_MS): Promise<string> {
  const exp = Date.now() + ttlMs
  const payload = `${TOKEN_VERSION}.${exp}`
  const signature = await hmac(payload, getSecret())
  return `${payload}.${signature}`
}

export async function verifyDriverSessionToken(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false
  const secret = getSecret()
  if (!secret) return false

  const parts = token.split('.')
  if (parts.length !== 3) return false

  const [version, expStr, signature] = parts
  if (version !== TOKEN_VERSION) return false

  const exp = Number(expStr)
  if (!Number.isFinite(exp) || Date.now() > exp) return false

  const expected = await hmac(`${version}.${expStr}`, secret)
  return safeEqual(signature, expected)
}
