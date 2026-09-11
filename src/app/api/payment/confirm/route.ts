import { NextRequest, NextResponse } from 'next/server'
import { applyFlowPaymentByToken } from '@/lib/paymentSync'

// Webhook server-to-server: Flow notifica aquí el resultado del pago.
export async function POST(request: NextRequest) {
    try {
        // Flow envía los parámetros como form data
        const formData = await request.formData()
        const token = formData.get('token') as string

        if (!token) {
            return NextResponse.json(
                { error: 'Token no proporcionado' },
                { status: 400 }
            )
        }

        // IMPORTANTE: Flow NO firma la notificación server-to-server; solo envía `token`.
        // La seguridad NO viene de una firma en este POST — viene de que validamos el pago
        // consultando su estado a Flow con NUESTRAS credenciales (getStatus, dentro de
        // applyFlowPaymentByToken). Un token que no corresponda a un pago real no devolverá
        // estado aprobado. Antes se exigía una firma inexistente aquí: el webhook respondía
        // 401 a TODAS las confirmaciones y Flow reportaba la integración como caída (además,
        // la reserva se quedaba 'pending' hasta que el cliente volviera por el navegador, o
        // la borraba el cron de limpieza a las 24h aunque estuviera pagada).
        await applyFlowPaymentByToken(token)

        // Siempre 200 para confirmar la recepción a Flow.
        return new NextResponse('OK', { status: 200 })
    } catch (error) {
        console.error('Error processing Flow confirmation:', error)
        // Aún en caso de error respondemos 200 para no bloquear, pero registramos para depurar.
        return new NextResponse('OK', { status: 200 })
    }
}
