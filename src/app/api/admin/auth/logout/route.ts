import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/adminSession'
import { logAdminAction } from '@/lib/activityLog'

export async function POST(request: NextRequest) {
  try {
    // Esta ruta es pública en el middleware, así que la identidad se resuelve acá
    // leyendo la cookie firmada antes de borrarla.
    const actor = await verifySessionToken(
      request.cookies.get('admin_authenticated')?.value
    )
    if (actor) {
      await logAdminAction({
        actor: { username: actor.username, id: actor.id },
        action: 'auth.logout',
        entityType: 'auth',
        summary: 'Cerró sesión',
        request,
      })
    }

    // Crear respuesta de logout
    const response = NextResponse.json({
      success: true,
      message: 'Sesión cerrada correctamente'
    })

    // Eliminar cookies de autenticación
    response.cookies.set('admin_authenticated', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0 // Expirar inmediatamente
    })

    response.cookies.set('admin_login_time', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0 // Expirar inmediatamente
    })

    return response
  } catch (error) {
    console.error('Error in logout:', error)
    return NextResponse.json(
      { error: 'Error al cerrar sesión' },
      { status: 500 }
    )
  }
}
