// Número comercial único del proyecto. Ya existía en la web y se mantiene como
// valor del helper para evitar una variable de entorno duplicada.
export const BUSINESS_WHATSAPP_NUMBER = '56954390267'

export function buildBusinessWhatsAppLink(message: string): string {
  const phone = BUSINESS_WHATSAPP_NUMBER.replace(/\D/g, '')
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}
