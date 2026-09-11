import crypto from 'crypto'

// Tipos para Flow
export interface FlowPaymentData {
    commerceOrder: string
    subject: string
    currency: string
    amount: number
    email: string
    paymentMethod?: number
    urlConfirmation: string
    urlReturn: string
    optional?: string
}

export interface FlowPaymentResponse {
    url: string
    token: string
    flowOrder?: number
}

export interface FlowPaymentStatus {
    flowOrder: number
    commerceOrder: string
    requestDate: string
    status: number
    subject: string
    currency: string
    amount: number
    payer: string
    // getStatus (por token) lo entrega como string JSON; getStatusByCommerceId como objeto.
    optional?: string | Record<string, any>
    pending_info?: {
        media: string
        date: string
    }
    paymentData?: {
        date: string
        media: string
        conversionDate: string
        conversionRate: number
        amount: number
        currency: string
        fee: number
        balance: number
        transferDate: string
    }
}

class FlowService {
    private apiKey: string
    private secretKey: string
    private apiUrl: string

    constructor() {
        this.apiKey = process.env.FLOW_API_KEY || ''
        this.secretKey = process.env.FLOW_SECRET_KEY || ''
        this.apiUrl = process.env.FLOW_API_URL || 'https://sandbox.flow.cl/api'

        if (!this.apiKey || !this.secretKey) {
            console.warn('Flow credentials not configured. Payment functionality will not work.')
        }
    }

    /**
     * Genera la firma HMAC-SHA256 requerida por Flow
     */
    private generateSignature(params: Record<string, any>): string {
        // Ordenar parámetros alfabéticamente
        const sortedKeys = Object.keys(params).sort()

        // Crear string con formato key=value&key=value
        const paramsString = sortedKeys
            .map(key => `${key}=${params[key]}`)
            .join('&')

        // Generar firma HMAC-SHA256
        const signature = crypto
            .createHmac('sha256', this.secretKey)
            .update(paramsString)
            .digest('hex')

        return signature
    }

    /**
     * Crea una orden de pago en Flow
     */
    async createPayment(data: FlowPaymentData): Promise<FlowPaymentResponse> {
        try {
            // Preparar parámetros
            const params: Record<string, any> = {
                apiKey: this.apiKey,
                commerceOrder: data.commerceOrder,
                subject: data.subject,
                currency: data.currency,
                amount: data.amount,
                email: data.email,
                urlConfirmation: data.urlConfirmation,
                urlReturn: data.urlReturn,
            }

            // Agregar parámetros opcionales
            if (data.paymentMethod) {
                params.paymentMethod = data.paymentMethod
            }
            if (data.optional) {
                params.optional = data.optional
            }

            // Generar firma
            const signature = this.generateSignature(params)
            params.s = signature

            // Crear URL con parámetros
            const urlParams = new URLSearchParams()
            Object.keys(params).forEach(key => {
                urlParams.append(key, params[key].toString())
            })

            // Hacer request a Flow
            const response = await fetch(`${this.apiUrl}/payment/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: urlParams.toString(),
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`Flow API error: ${response.status} - ${errorText}`)
            }

            const result = await response.json()

            return {
                url: result.url + '?token=' + result.token,
                token: result.token,
                flowOrder: result.flowOrder,
            }
        } catch (error) {
            console.error('Error creating Flow payment:', error)
            throw error
        }
    }

    /**
     * Obtiene el estado de un pago
     */
    async getPaymentStatus(token: string): Promise<FlowPaymentStatus> {
        try {
            const params = {
                apiKey: this.apiKey,
                token: token,
            }

            const signature = this.generateSignature(params)
            const urlParams = new URLSearchParams({
                ...params,
                s: signature,
            })

            const response = await fetch(
                `${this.apiUrl}/payment/getStatus?${urlParams.toString()}`,
                {
                    method: 'GET',
                }
            )

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`Flow API error: ${response.status} - ${errorText}`)
            }

            const result = await response.json()
            return result
        } catch (error) {
            console.error('Error getting Flow payment status:', error)
            throw error
        }
    }

    /**
     * Obtiene el estado de un pago por su commerceOrder (sin token). Devuelve el mismo
     * objeto que `getPaymentStatus`. Lo usa el rescate del cron.
     */
    async getStatusByCommerceId(commerceId: string): Promise<FlowPaymentStatus> {
        const params = {
            apiKey: this.apiKey,
            commerceId,
        }
        const signature = this.generateSignature(params)
        const urlParams = new URLSearchParams({ ...params, s: signature })

        const response = await fetch(
            `${this.apiUrl}/payment/getStatusByCommerceId?${urlParams.toString()}`,
            { method: 'GET' }
        )

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Flow API error (getStatusByCommerceId): ${response.status} - ${errorText}`)
        }

        return await response.json()
    }

    /**
     * Lista los pagos de un día (formato 'YYYY-MM-DD'), siguiendo la paginación de Flow.
     * Se usa como red de seguridad del cron de limpieza: antes de borrar una pre-reserva
     * provisional "abandonada", comprobamos en Flow si en realidad tiene un pago aprobado.
     */
    async getPaymentsByDate(date: string): Promise<any[]> {
        const all: any[] = []
        let start = 0
        // Tope defensivo para no iterar de más si Flow devolviera algo inesperado.
        for (let page = 0; page < 50; page++) {
            const params: Record<string, any> = {
                apiKey: this.apiKey,
                date,
                start,
                limit: 100,
            }
            params.s = this.generateSignature(params)
            const qs = new URLSearchParams(
                Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
            )
            const response = await fetch(`${this.apiUrl}/payment/getPayments?${qs.toString()}`, {
                method: 'GET',
            })
            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`Flow API error (getPayments): ${response.status} - ${errorText}`)
            }
            const result = await response.json()
            const data: any[] = Array.isArray(result?.data) ? result.data : []
            all.push(...data)
            if (!result?.hasMore || data.length === 0) break
            start += data.length
        }
        return all
    }

    /**
     * Verifica la firma de una notificación de Flow
     */
    verifySignature(params: Record<string, any>, receivedSignature: string): boolean {
        // Crear copia sin la firma
        const paramsWithoutSignature = { ...params }
        delete paramsWithoutSignature.s

        // Generar firma esperada
        const expectedSignature = this.generateSignature(paramsWithoutSignature)

        return expectedSignature === receivedSignature
    }

    /**
     * Verifica si Flow está configurado correctamente
     */
    isConfigured(): boolean {
        return !!(this.apiKey && this.secretKey)
    }
}

// Exportar instancia singleton
export const flowService = new FlowService()
