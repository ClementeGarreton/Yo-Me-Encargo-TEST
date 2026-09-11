/**
 * Utility functions for sending tracking events to Meta Pixel and Google Tag Manager.
 */

export const trackEvent = (eventName: string, data: Record<string, any> = {}) => {
    if (typeof window === 'undefined') return

    // 1. Meta Pixel
    if (window.fbq) {
        if (['ViewContent', 'Search', 'AddToCart', 'AddToWishlist', 'InitiateCheckout', 'AddPaymentInfo', 'Purchase', 'Lead', 'CompleteRegistration'].includes(eventName)) {
            // Standard events
            window.fbq('track', eventName, data)
        } else {
            // Custom events
            window.fbq('trackCustom', eventName, data)
        }
    }

    // 2. Google Tag Manager (DataLayer)
    const win = window as any
    win.dataLayer = win.dataLayer || []
    win.dataLayer.push({
        event: eventName,
        ...data
    })
}

/**
 * Empuja el monto de conversión (CLP, entero) al dataLayer para que GTM lo lea como
 * la variable "DLV - monto" y lo mande a GA4/Google Ads como `value`. GTM ya fija
 * `currency = CLP`, por eso aquí SOLO se empuja la clave `monto`.
 * Llamar ANTES del clic (al renderizar la vista o en onPointerDown del botón).
 */
export const pushDataLayerMonto = (amount: number | null | undefined) => {
    if (typeof window === 'undefined') return
    const n = Number(amount)
    if (amount == null || isNaN(n) || n <= 0) return
    const win = window as any
    win.dataLayer = win.dataLayer || []
    win.dataLayer.push({ monto: Math.round(n) })
}

// Type definitions to add to global scope
declare global {
    interface Window {
        fbq: any
        _fbq: any
    }
}
