// Hash de contraseñas con PBKDF2-SHA256 sobre Web Crypto.
//
// Se elige PBKDF2 (y no bcrypt/argon2) para no sumar dependencias nativas: Web Crypto ya
// se usa en el proyecto para firmar sesiones y funciona igual en Node y en Edge.
//
// Formato almacenado: pbkdf2$<iteraciones>$<salt_b64url>$<hash_b64url>
// Guardar las iteraciones dentro del string permite subirlas en el futuro sin invalidar
// las contraseñas ya existentes.

const ALGORITHM = 'pbkdf2'
const DEFAULT_ITERATIONS = 210_000 // recomendación OWASP 2023+ para PBKDF2-SHA256
const SALT_BYTES = 16
const KEY_BITS = 256

const encoder = new TextEncoder()

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

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await globalThis.crypto.subtle.deriveBits(
    // cast: TS estrecha Uint8Array a ArrayBuffer y no acepta ArrayBufferLike aquí.
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_BITS
  )
  return new Uint8Array(bits)
}

export async function hashPassword(
  password: string,
  iterations: number = DEFAULT_ITERATIONS
): Promise<string> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(password, salt, iterations)
  return `${ALGORITHM}$${iterations}$${toBase64Url(salt)}$${toBase64Url(hash)}`
}

/** Comparación en tiempo constante para no filtrar información por timing. */
function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i]
  return mismatch === 0
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = (stored || '').split('$')
    if (parts.length !== 4) return false

    const [algorithm, iterationsRaw, saltRaw, hashRaw] = parts
    if (algorithm !== ALGORITHM) return false

    const iterations = Number(iterationsRaw)
    if (!Number.isFinite(iterations) || iterations <= 0) return false

    const salt = fromBase64Url(saltRaw)
    const expected = fromBase64Url(hashRaw)
    const actual = await derive(password, salt, iterations)

    return safeEqual(actual, expected)
  } catch {
    return false
  }
}

/**
 * Reglas mínimas para una contraseña nueva. Deliberadamente simples: largo por sobre
 * complejidad obligatoria, que es lo que hoy recomienda NIST.
 */
export function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres'
  }
  if (password.length > 200) {
    return 'La contraseña es demasiado larga'
  }
  return null
}
