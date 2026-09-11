import { NextRequest, NextResponse } from 'next/server'
import { getDriverAccessToken } from '@/lib/driverJobs'
import {
  DRIVER_SESSION_COOKIE,
  createDriverSessionToken,
  isValidDriverPin,
} from '@/lib/driverSession'

export const dynamic = 'force-dynamic'

/**
 * Valida el PIN del panel de choferes y entrega una cookie de sesión firmada.
 * Exige además el token del link: sin link válido, el PIN por sí solo no sirve.
 * El rate limit anti fuerza bruta está en el middleware (ver RATE_LIMIT_RULES).
 */
export async function POST(request: NextRequest) {
  try {
    const { pin, token } = await request.json()

    const validToken = await getDriverAccessToken()
    if (!validToken || token !== validToken) {
      return NextResponse.json({ error: 'Enlace no válido' }, { status: 403 })
    }

    if (!isValidDriverPin(String(pin || ''))) {
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
    }

    const sessionToken = await createDriverSessionToken()
    const response = NextResponse.json({ success: true })

    response.cookies.set(DRIVER_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: request.url.startsWith('https://'),
      sameSite: 'lax',
      maxAge: 12 * 60 * 60,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Error verificando PIN de choferes:', error)
    return NextResponse.json({ error: 'Error al verificar el PIN' }, { status: 500 })
  }
}
