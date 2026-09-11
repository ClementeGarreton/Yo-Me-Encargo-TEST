// Sesión de administrador firmada (HMAC-SHA256). Compatible con Edge (middleware)
// y Node (route handlers) porque usa Web Crypto global (globalThis.crypto.subtle).
//
// v2 (jul-2026): el token ahora lleva la IDENTIDAD del usuario, no solo la expiración.
// Antes era `v1.<exp>`: probaba que "alguien válido entró", pero no quién, así que no se
// podía atribuir ninguna acción. Ahora:
//
//   v2.<userId_b64url>.<username_b64url>.<exp>.<firma>
//
// El id y el usuario van DENTRO de lo firmado, así que no se pueden alterar desde el
// navegador. Se codifican en base64url porque el separador es "." y los usuarios son
// emails (que contienen puntos).
//
// Bump v1 → v2: las sesiones abiertas quedan inválidas y hay que volver a entrar una vez.

const TOKEN_VERSION = 'v2'
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24h, alineado con el maxAge de la cookie

export interface AdminActor {
  id: string
  username: string
}

function getSecret(): string {
  // Preferimos un secreto dedicado; si no existe, derivamos del password de admin.
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || ''
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function encodeText(value: string): string {
  return toBase64Url(encoder.encode(value))
}

function decodeText(value: string): string {
  return decoder.decode(fromBase64Url(value))
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

// Comparación en tiempo constante de dos strings (firmas base64url) para evitar
// timing attacks. Devuelve false si difieren en largo o contenido.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

export async function createSessionToken(
  actor: AdminActor,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<string> {
  const secret = getSecret()
  const exp = Date.now() + ttlMs
  const payload = `${TOKEN_VERSION}.${encodeText(actor.id)}.${encodeText(actor.username)}.${exp}`
  const signature = await hmac(payload, secret)
  return `${payload}.${signature}`
}

/**
 * Verifica el token y devuelve el actor, o null si es inválido/expirado.
 * Devolver el actor (en vez de un booleano) es lo que permite el log de auditoría.
 */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<AdminActor | null> {
  if (!token) return null
  const secret = getSecret()
  if (!secret) return null

  const parts = token.split('.')
  if (parts.length !== 5) return null

  const [version, idPart, userPart, expStr, signature] = parts
  if (version !== TOKEN_VERSION) return null

  const exp = Number(expStr)
  if (!Number.isFinite(exp) || Date.now() > exp) return null

  const expected = await hmac(`${version}.${idPart}.${userPart}.${expStr}`, secret)
  if (!safeEqual(signature, expected)) return null

  try {
    return { id: decodeText(idPart), username: decodeText(userPart) }
  } catch {
    return null
  }
}
