'use client'

import { useEffect, useState, useRef } from 'react'
import { useQuoteStore } from '@/store/quoteStore'
import Button from '../ui/Button'
import Card from '../ui/Card'
import {
  Calendar,
  MapPin,
  Package,
  DollarSign,
  Send,
  CheckCircle,
  CreditCard,
  Mail,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import { formatCurrency, formatDate, formatTime, formatDistanceKm } from '@/lib/utils'
import { generateQuotePDF } from '@/lib/pdfGenerator'
import { getPricingConfig } from '@/lib/pricingService'
import { trackEvent, pushDataLayerMonto } from '@/lib/tracking'
import { attributionForSubmit } from '@/lib/attribution'
import toast from 'react-hot-toast'
import WhatsAppHandoff from '../ui/WhatsAppHandoff'
import { format } from 'date-fns'

// Configuración de precios por defecto para evitar errores
const DEFAULT_PRICING = {
  services: {
    disassembly: 15000,
    assembly: 15000,
    packing: 0, // No se muestra precio, requiere contacto con ejecutivo
    unpacking: 0 // No se muestra precio, requiere contacto con ejecutivo
  }
}

interface SummaryStepProps {
  onPrevious: () => void
  onReset: () => void
  currentStep: number
}

export default function SummaryStep({ onPrevious, onReset }: SummaryStepProps) {
  const {
    personalInfo,
    dateTime,
    isFlexible,
    origin,
    destination,
    items,
    additionalServices,
    totalVolume,
    totalWeight,
    totalDistance,
    estimatedPrice,
    recommendedVehicle,
    isConfirmed,
    calculateTotals,
    setConfirmed,
  } = useQuoteStore()

  const [freeKilometers, setFreeKilometers] = useState(50) // Valor por defecto
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING) // Configuración dinámica

  // Cargar configuración de precios dinámicamente desde el panel de admin
  useEffect(() => {
    const loadPricingConfig = async () => {
      try {
        const pricing = await getPricingConfig()
        setFreeKilometers(pricing.freeKilometers)

        // Actualizar la configuración de precios con los valores del admin
        setPricingConfig({
          services: {
            disassembly: pricing.additionalServices.disassembly,
            assembly: pricing.additionalServices.assembly,
            packing: 0, // No se muestra precio, requiere contacto con ejecutivo
            unpacking: 0 // No se muestra precio, requiere contacto con ejecutivo
          }
        })
      } catch (error) {
        console.error('Error loading pricing config:', error)
        // Mantener los valores por defecto si falla
      }
    }
    loadPricingConfig()
  }, [])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingQuote, setIsSendingQuote] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const prospectSavedRef = useRef(false)

  useEffect(() => {
    calculateTotals()
  }, [calculateTotals])

  // CRO: vista del checkout (una sola vez)
  useEffect(() => {
    trackEvent('view_checkout_summary', { value: estimatedPrice, currency: 'CLP' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const prospectIdRef = useRef<string | null>(null)
  const pdfUrlRef = useRef<string | null>(null)

  // ID único y ESTABLE de esta cotización (un solo booking por cotización).
  // Lo comparten el envío por correo y los botones de pago en página => sin duplicados.
  // Se persiste en sessionStorage para que sobreviva una recarga (F5): así no se generan
  // múltiples pre-reservas provisionales "fantasma" para el mismo cliente.
  const quoteIdRef = useRef<string | null>(null)
  const getQuoteId = () => {
    if (!quoteIdRef.current) {
      const stored =
        typeof window !== 'undefined' ? sessionStorage.getItem('yme_quote_id') : null
      quoteIdRef.current = stored || `Q-${Date.now()}`
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('yme_quote_id', quoteIdRef.current)
      }
    }
    return quoteIdRef.current
  }

  // Payload común (cliente + agenda + direcciones + precio) para checkout y correo
  const buildQuotePayload = () => ({
    client: {
      name: personalInfo?.name,
      email: personalInfo?.email,
      phone: personalInfo?.phone,
      isCompany: personalInfo?.isCompany || false,
      companyName: personalInfo?.companyName,
      companyRut: personalInfo?.companyRut,
    },
    schedule: {
      date: dateTime ? format(new Date(dateTime), 'yyyy-MM-dd') : null,
      time: dateTime ? format(new Date(dateTime), 'HH:mm') : null,
    },
    addresses: {
      origin: buildAddress(origin),
      destination: buildAddress(destination),
    },
    // Piso, ascensor y distancia estacionamiento->puerta de origen/destino: se capturan
    // en el cotizador pero antes se perdían al guardar — nunca llegaban a la reserva ni a
    // la Orden de Trabajo que reciben los trabajadores.
    propertyDetails: {
      origin: origin.details
        ? {
            floor: origin.details.floor,
            hasElevator: origin.details.hasElevator,
            parkingDistance: origin.details.parkingDistance,
          }
        : null,
      destination: destination.details
        ? {
            floor: destination.details.floor,
            hasElevator: destination.details.hasElevator,
            parkingDistance: destination.details.parkingDistance,
          }
        : null,
    },
    estimatedPrice,
    photoUrls: additionalServices?.photos || [],
    // gclid/UTMs capturados de la URL: para el pago en pagina y el envio por correo.
    attribution: attributionForSubmit(),
  })

  const saveProspect = async (source: string): Promise<string | null> => {
    try {
      const originFull = buildAddress(origin)
      const destinationFull = buildAddress(destination)

      const itemsSummary = items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        volume: parseFloat((item.volume * item.quantity).toFixed(2)),
        packaging: item.packaging && item.packaging.type !== 'none' ? item.packaging : undefined,
      }))

      const res = await fetch('/api/prospects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          quote_id: getQuoteId(),
          name: personalInfo?.name,
          email: personalInfo?.email,
          phone: personalInfo?.phone,
          is_company: personalInfo?.isCompany || false,
          company_name: personalInfo?.companyName,
          company_rut: personalInfo?.companyRut,
          origin_address: originFull,
          destination_address: destinationFull,
          origin_floor: origin.details?.floor ?? null,
          origin_has_elevator: origin.details?.hasElevator ?? null,
          origin_parking_distance: origin.details?.parkingDistance ?? null,
          destination_floor: destination.details?.floor ?? null,
          destination_has_elevator: destination.details?.hasElevator ?? null,
          destination_parking_distance: destination.details?.parkingDistance ?? null,
          scheduled_date: dateTime ? format(new Date(dateTime), 'yyyy-MM-dd') : null,
          scheduled_time: dateTime ? format(new Date(dateTime), 'HH:mm') : null,
          total_price: estimatedPrice,
          original_price: isFlexible ? Math.round(estimatedPrice / 0.9) : estimatedPrice,
          is_flexible: isFlexible,
          recommended_vehicle: recommendedVehicle,
          total_volume: totalVolume,
          total_weight: totalWeight,
          total_distance: totalDistance,
          items_summary: itemsSummary,
          additional_services: {
            disassembly: additionalServices.disassembly,
            assembly: additionalServices.assembly,
            packing: additionalServices.packing,
            unpacking: additionalServices.unpacking,
            observations: additionalServices.observations,
          },
          // gclid/UTMs capturados de la URL (Google Ads).
          attribution: attributionForSubmit(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.prospectId) {
        console.error('Error saving prospect:', !res.ok ? data?.error || res.status : 'sin prospectId')
        return null
      }
      prospectSavedRef.current = true
      prospectIdRef.current = data.prospectId
      return data.prospectId
    } catch (error) {
      console.error('Error saving prospect:', error)
      return null
    }
  }

  const uploadProspectPdf = async (blob: Blob, fileName: string): Promise<boolean> => {
    const pid = prospectIdRef.current
    const email = personalInfo?.email
    if (!pid && !email) return false
    try {
      const formData = new FormData()
      formData.append('pdf', blob, fileName)
      if (pid) formData.append('prospectId', pid)
      if (email) formData.append('prospectEmail', email)
      const res = await fetch('/api/prospects/upload-pdf', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({}))
      if (data?.pdfUrl) pdfUrlRef.current = data.pdfUrl
      if (!res.ok) {
        console.error('Error uploading prospect PDF:', data?.error || res.status)
        return false
      }
      if (data.warning) {
        console.warn('PDF subido pero no vinculado al prospecto')
        return false
      }
      return true
    } catch (err) {
      console.error('Error uploading prospect PDF:', err)
      return false
    }
  }

  // Envío REAL de la cotización por correo: genera el link de pago (abono 50%)
  // y dispara el webhook de n8n con el PDF + link. El cliente paga desde el correo.
  const handleSendQuote = async () => {
    if (!acceptedTerms) {
      toast.error('Debes aceptar los Términos y Condiciones y la Política de Privacidad.')
      return
    }
    setIsSendingQuote(true)
    trackEvent('click_enviar_cotizacion_email', { value: estimatedPrice, currency: 'CLP' })
    try {
      let prospectId = prospectIdRef.current
      if (!prospectSavedRef.current) {
        prospectId = await saveProspect('email_quote')
      }

      // Garantizar el PDF ANTES de enviar el correo: si la subida automática del
      // resumen no alcanzó a terminar (o falló), lo generamos y subimos ahora,
      // así el correo siempre incluye un PDF descargable.
      if (!pdfUrlRef.current) {
        try {
          const result = await generateQuotePDF({ download: false })
          if (result?.blob) {
            await uploadProspectPdf(result.blob, result.fileName)
          }
        } catch (e) {
          console.error('[SummaryStep] No se pudo generar/subir el PDF antes del envío:', e)
        }
      }

      const res = await fetch('/api/prospects/send-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: getQuoteId(),
          prospectId: prospectId || prospectIdRef.current,
          pdfUrl: pdfUrlRef.current,
          details: {
            distanceKm: totalDistance,
            volumeM3: totalVolume,
            vehicle: recommendedVehicle,
            isFlexible,
          },
          ...buildQuotePayload(),
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo enviar la cotización')
      }

      // Tracking: Lead (ahora sí, cuando el correo se envía de verdad)
      trackEvent('Lead', {
        method: 'email_quote',
        value: estimatedPrice,
        currency: 'CLP',
      })

      toast.success('¡Te enviamos tu cotización y link de pago al correo!')
    } catch (error) {
      console.error('Error sending quote:', error)
      toast.error(error instanceof Error ? error.message : 'No se pudo enviar la cotización')
    } finally {
      setIsSendingQuote(false)
    }
  }

  // Función helper para construir dirección completa
  const buildAddress = (addr: any) => {
    if (!addr.address) return ''

    const parts = [
      addr.address.street,
      addr.address.number,
      addr.address.commune,
      addr.address.region
    ].filter(Boolean)

    if (addr.address.additionalInfo) {
      parts.push(addr.address.additionalInfo)
    }

    return parts.join(', ')
  }

  const summaryDataReadyForPdf =
    Boolean(
      personalInfo?.name?.trim() &&
        personalInfo?.email?.trim() &&
        personalInfo?.phone?.trim() &&
        origin?.address &&
        destination?.address &&
        items?.length > 0
    )

  const summaryAutoPdfLockRef = useRef(false)

  useEffect(() => {
    if (isConfirmed || !summaryDataReadyForPdf) return
    if (summaryAutoPdfLockRef.current) return
    summaryAutoPdfLockRef.current = true

    let cancelled = false

    const run = async () => {
      let success = false
      try {
        if (!prospectSavedRef.current) {
          const id = await saveProspect('web')
          if (cancelled || !id) return
        }
        const result = await generateQuotePDF({ download: false })
        if (cancelled || !result?.blob) return
        const ok = await uploadProspectPdf(result.blob, result.fileName)
        if (!cancelled && ok) success = true
      } catch (e) {
        if (!cancelled) console.error('[SummaryStep] Auto-guardado PDF prospecto:', e)
      } finally {
        if (!success) summaryAutoPdfLockRef.current = false
      }
    }

    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una pasada al cumplir datos; idempotencia en API
  }, [isConfirmed, summaryDataReadyForPdf])

  // Empuja el monto al dataLayer al renderizar el resumen para que GTM nunca lea
  // undefined (criterio: "DLV - monto" definido al cargar la pantalla de abono).
  // Baseline = abono (la opción destacada). Los botones Pagar / Descargar Cotización
  // ajustan el monto al TOTAL en su onPointerDown, justo antes del clic.
  useEffect(() => {
    if (estimatedPrice > 0) pushDataLayerMonto(Math.round(estimatedPrice * 0.5))
  }, [estimatedPrice])

  // Pago EN LA PÁGINA. Reutiliza el mismo quoteId (un solo booking) y delega en
  // /api/quote/checkout, que crea/reutiliza la pre-reserva y genera la orden Flow.
  const handleConfirmReservation = async (paymentType: 'completo' | 'mitad') => {
    setIsSubmitting(true)
    trackEvent(paymentType === 'completo' ? 'click_pagar_100' : 'click_abonar_50', {
      value: paymentType === 'completo'
        ? Math.round(estimatedPrice * 0.95)
        : Math.round(estimatedPrice * 0.5),
      currency: 'CLP',
    })

    try {
      // Guardar como prospecto antes de procesar el pago
      if (!prospectSavedRef.current) {
        await saveProspect('checkout_initiated')
      }

      const quoteId = getQuoteId()
      const finalPrice = paymentType === 'completo'
        ? Math.round(estimatedPrice * 0.95) // 100% con 5% de descuento
        : Math.round(estimatedPrice * 0.5)  // abono 50%

      const response = await fetch('/api/quote/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId,
          paymentType,
          ...buildQuotePayload(),
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.paymentUrl) {
        throw new Error(data?.error || 'Error al crear la orden de pago')
      }

      // Redirigir al usuario a Flow para completar el pago
      toast.success('Redirigiendo a la pasarela de pago segura...')

      // Tracking: InitiateCheckout
      trackEvent('InitiateCheckout', {
        value: finalPrice,
        currency: 'CLP',
        content_ids: [quoteId],
      })

      // Esperar un momento para que el usuario vea el mensaje
      setTimeout(() => {
        window.location.href = data.paymentUrl
      }, 1000)

    } catch (error) {
      console.error('Error confirming reservation:', error)
      toast.error(error instanceof Error ? error.message : 'Error al confirmar la reserva')
      setIsSubmitting(false)
      return
    }
  }

  if (isConfirmed) {
    return (
      <div className="max-w-2xl mx-auto text-center animate-slide-up">
        <Card variant="elevated" className="py-12">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">¡Reserva Confirmada!</h2>
          <p className="text-lg text-gray-600 mb-8">
            Tu solicitud de cotización ha sido enviada exitosamente.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 text-left">
            <h3 className="font-semibold mb-3">📧 ¿Qué sigue?</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✅ Recibirás un correo con la cotización detallada</li>
              <li>✅ Afina los detalles con nuestro ejecutivo por WhatsApp</li>
              <li>✅ Un ejecutivo te llamará en las próximas 24 horas</li>
              <li>✅ Podrás realizar el pago y confirmar tu reserva</li>
            </ul>
          </div>

          <WhatsAppHandoff
            message={[
              'Hola, mi reserva/cotización quedó confirmada en Yo Me Encargo y quiero afinar los detalles con un EJECUTIVO y continuar la coordinación.',
              `Cotización: ${getQuoteId()}`,
              personalInfo?.name ? `Nombre: ${personalInfo.name}` : '',
              `Valor estimado: ${formatCurrency(estimatedPrice)}`,
            ].filter(Boolean).join('\n')}
            label="AFINAR DETALLES CON NUESTRO EJECUTIVO"
            location="quote_confirmed_handoff"
            headline="AFINA LOS DETALLES DE TU MUDANZA CON NUESTRO EJECUTIVO"
            helper="Así tendremos tu cotización agendada en el chat desde hoy y podremos acompañarte para evitar olvidos, cambios de último minuto y problemas de coordinación el día del traslado."
            strong
            className="mb-4"
          />

          <div className="space-y-3">
            <Button onClick={handleSendQuote} isLoading={isSendingQuote} variant="secondary" className="w-full" size="lg">
              <Send className="w-5 h-5 mr-2" />
              Enviarme la cotización por correo
            </Button>
            <Button onClick={onReset} variant="ghost" className="w-full" size="lg">
              Nueva Cotización
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const abono50 = Math.round(estimatedPrice * 0.5)
  const pago100 = Math.round(estimatedPrice * 0.95)
  const descuento100 = Math.round(estimatedPrice * 0.05)

  const whatsappQuoteMessage = [
    'Hola, acabo de cotizar una mudanza en Yo Me Encargo y quiero afinar los detalles con un EJECUTIVO y continuar la coordinación.',
    `Cotización: ${getQuoteId()}`,
    personalInfo?.name ? `Nombre: ${personalInfo.name}` : '',
    origin.address?.commune ? `Origen: ${origin.address.commune}` : '',
    destination.address?.commune ? `Destino: ${destination.address.commune}` : '',
    dateTime ? `Fecha estimada: ${formatDate(new Date(dateTime))}` : '',
    `Valor estimado: ${formatCurrency(estimatedPrice)}`,
  ].filter(Boolean).join('\n')

  // Bloque de precio reutilizado (desglose flexible + facturación empresa)
  const PriceBlock = (
    <Card variant="elevated" className="rounded-2xl border border-gray-200 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
        <DollarSign className="w-4 h-4 text-primary-600" />
        Precio estimado
      </p>
      {isFlexible ? (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Precio base:</span>
            <span className="text-base font-semibold text-gray-500 line-through">
              {formatCurrency(Math.round(estimatedPrice / 0.9))}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-green-600">Descuento por flexibilidad:</span>
            <span className="text-base font-semibold text-green-600">-10%</span>
          </div>
          <div className="border-t border-gray-200 pt-3 flex justify-between items-end">
            <span className="text-sm text-gray-600">Total:</span>
            <span className="text-3xl font-extrabold text-gray-900">{formatCurrency(estimatedPrice)}</span>
          </div>
          <p className="text-xs text-green-600 font-semibold text-right">
            ¡Ahorraste {formatCurrency(Math.round(estimatedPrice / 0.9) - estimatedPrice)}!
          </p>
        </div>
      ) : (
        <div className="flex items-end justify-between">
          <span className="text-sm text-gray-600">Total:</span>
          <span className="text-3xl font-extrabold text-gray-900">{formatCurrency(estimatedPrice)}</span>
        </div>
      )}
      {personalInfo?.isCompany && (
        <p className="text-xs text-gray-500 mt-1 text-right">IVA incluido</p>
      )}
      <p className="text-[11px] text-gray-400 mt-3 text-center">
        Precio final estimado según los datos ingresados.
      </p>

      {personalInfo?.isCompany && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
            <p className="font-bold text-blue-900 mb-1">📄 Con factura</p>
            <p className="font-semibold">Razón Social:</p>
            <p className="mb-1">{personalInfo.companyName}</p>
            <p className="font-semibold">RUT:</p>
            <p>{personalInfo.companyRut}</p>
          </div>
        </div>
      )}
    </Card>
  )

  return (
    <div className="max-w-5xl mx-auto animate-slide-up">
      {/* Header de cierre */}
      <div className="mb-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Reserva tu mudanza ahora</h2>
        <p className="text-gray-600">
          Tu precio está confirmado. Completa tu reserva en menos de 1 minuto.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-800 text-sm font-medium rounded-full px-4 py-1.5">
          <Clock className="w-4 h-4 shrink-0" />
          Tu fecha aún puede ocuparse. Abona ahora para asegurar tu cupo.
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
        {/* COLUMNA DE CONVERSIÓN — primera en mobile, derecha en desktop */}
        <div className="order-1 lg:order-2 lg:col-span-1">
          <div className="lg:sticky lg:top-24 space-y-4">
            {/* 1. Precio */}
            {PriceBlock}

            {/* 2. Abonar 50% — CTA dominante */}
            <Card variant="elevated" className="rounded-2xl border-2 border-[#8CC63F] bg-[#F2FBE9] shadow-lg">
              <div className="text-center">
                <span className="inline-block bg-[#8CC63F] text-[#0E1A05] text-[11px] font-bold uppercase tracking-wide px-3 py-1 rounded-full mb-3">
                  ⭐ Opción más elegida
                </span>
                <h3 className="text-xl font-bold text-gray-900">Reserva con el 50%</h3>
                <p className="text-sm text-gray-600 mt-1 mb-4">
                  Asegura tu fecha abonando solo la mitad ahora. El resto lo pagas al finalizar el traslado.
                </p>
                <p className="text-4xl font-extrabold text-[#3F6212] leading-none">
                  {formatCurrency(abono50)}
                </p>
                <p className="text-xs text-gray-500 mt-1 mb-4">
                  + {formatCurrency(abono50)} al finalizar el traslado
                </p>
                <Button
                  onPointerDown={() => pushDataLayerMonto(abono50)}
                  onClick={() => handleConfirmReservation('mitad')}
                  isLoading={isSubmitting}
                  size="lg"
                  className="w-full bg-[#8CC63F] hover:bg-[#6FA52E] text-[#0E1A05] font-bold shadow-md"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Abonar 50% y asegurar mi cupo
                </Button>
                <p className="text-xs text-gray-500 mt-2">Confirmación inmediata por correo.</p>
                <p className="text-xs text-gray-700 mt-3 bg-white/70 border border-[#cfe6a8] rounded-lg px-3 py-2">
                  Tu fecha y horario se confirman solo al realizar el abono.
                </p>
              </div>
            </Card>

            <WhatsAppHandoff
              message={whatsappQuoteMessage}
              label="AFINAR DETALLES CON NUESTRO EJECUTIVO"
              location="quote_summary_handoff"
              headline="TU COTIZACIÓN YA ESTÁ LISTA: AFINA LOS DETALLES CON NUESTRO EJECUTIVO"
              helper="Así podremos identificar tu cotización en el chat y continuar contigo sin que tengas que explicar todo de nuevo, evitando descoordinaciones antes del día de la mudanza."
              strong
              size="compact"
            />

            {/* 3. Enviar cotización por correo (visible sin bajar tanto) */}
            <Card className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white"> 
              <p className="text-sm font-semibold text-gray-800 text-center mb-1">
                ¿Prefieres decidir con calma?
              </p>
              <p className="text-xs text-gray-500 text-center mb-3">
                Te enviamos la cotización detallada y el enlace de pago para revisarlo cuando quieras.
              </p>

              {/* Aceptación de términos antes de enviar */}
              <label className="flex items-start gap-2.5 mb-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                />
                <span className="text-xs text-gray-600 leading-relaxed">
                  Acepto los{' '}
                  <a
                    href="/terminos-y-condiciones"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary-600 underline hover:text-primary-700"
                  >
                    Términos y Condiciones
                  </a>{' '}
                  y la{' '}
                  <a
                    href="/politica-de-privacidad"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary-600 underline hover:text-primary-700"
                  >
                    Política de Privacidad
                  </a>
                  .
                </span>
              </label>

              <Button
                onPointerDown={() => pushDataLayerMonto(estimatedPrice)}
                onClick={handleSendQuote}
                isLoading={isSendingQuote}
                disabled={!acceptedTerms}
                variant="outline"
                className="w-full border-2 border-blue-500 text-blue-700 hover:bg-blue-50"
                size="lg"
              >
                <Send className="w-5 h-5 mr-2" />
                Enviarme la cotización por correo
              </Button>
            </Card>

            {/* 4. Pagar 100% — opción secundaria */}
            <Card className="rounded-2xl border border-gray-200"> 
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700">¿Prefieres pagar todo ahora?</p>
                <p className="text-xs text-green-700 font-medium mt-0.5 mb-2">
                  Obtén 5% de descuento pagando el total.
                </p>
                <p className="text-2xl font-bold text-gray-900 leading-none">{formatCurrency(pago100)}</p>
                <p className="text-[11px] text-gray-500 mb-3">Ahorras {formatCurrency(descuento100)}</p>
                <Button
                  onPointerDown={() => pushDataLayerMonto(pago100)}
                  onClick={() => handleConfirmReservation('completo')}
                  isLoading={isSubmitting}
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  Pagar 100% con descuento
                </Button>
                <p className="text-xs text-gray-500 mt-2">Pago seguro procesado por Webpay.</p>
              </div>
            </Card>

            {/* 5. Mensaje de cuotas */}
            <div className="flex items-start gap-2 text-xs text-gray-600 px-1">
              <CreditCard className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <span>Puedes pagar con débito, crédito o en cuotas según tu medio de pago.</span>
            </div>

            {/* 6. Garantía / confianza */}
            <Card className="rounded-2xl border border-gray-200">
              <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#6FA52E]" />
                Compra protegida
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                {[
                  'Comprobante de reserva inmediato',
                  'Precio fijo sin sorpresas',
                  'Carga protegida durante el traslado',
                  'Devolución disponible sujeta a políticas de garantía',
                ].map((g) => (
                  <li key={g} className="flex gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* 7. Qué ocurre después del pago */}
            <Card className="rounded-2xl border border-gray-200 bg-blue-50/40">
              <h3 className="text-base font-bold text-gray-900 mb-3">¿Qué pasa después de pagar?</h3>
              <ol className="space-y-2.5">
                {[
                  'Confirmamos tu reserva',
                  'Recibes comprobante por correo',
                  'Coordinamos detalles por WhatsApp',
                  'Realizamos tu mudanza en la fecha agendada',
                ].map((step, i) => (
                  <li key={step} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-700">{step}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>

        {/* COLUMNA DE RESUMEN — segunda en mobile, izquierda en desktop (menor peso visual) */}
        <div className="order-2 lg:order-1 lg:col-span-2 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Resumen de tu cotización
          </p>

          {/* Datos Personales */}
          <Card>
            <h3 className="font-semibold text-base mb-4 flex items-center gap-2 text-gray-700">
              <Mail className="w-5 h-5 text-primary-600" />
              Datos de Contacto
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Nombre:</span>
                <p className="font-semibold">{personalInfo?.name}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Email:</span>
                <p className="font-semibold">{personalInfo?.email}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Teléfono:</span>
                <p className="font-semibold">{personalInfo?.phone}</p>
              </div>
              {personalInfo?.isCompany && (
                <>
                  <div>
                    <span className="text-sm text-gray-500">Razón Social:</span>
                    <p className="font-semibold">{personalInfo?.companyName}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">RUT:</span>
                    <p className="font-semibold">{personalInfo?.companyRut}</p>
                    <span className="text-xs text-green-600">✓ Con factura</span>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Fecha y Hora */}
          <Card>
            <h3 className="font-semibold text-base mb-4 flex items-center gap-2 text-gray-700">
              <Calendar className="w-5 h-5 text-primary-600" />
              Fecha y Hora
            </h3>
            <p className="text-gray-700">
              📅 {dateTime && formatDate(new Date(dateTime))}
            </p>
            <p className="text-gray-700">
              🕐 {dateTime && formatTime(new Date(dateTime))}
            </p>
            {isFlexible && (
              <p className="text-green-600 mt-2 text-sm font-semibold">
                ✅ Con descuento por flexibilidad (-10%)
              </p>
            )}
          </Card>

          {/* Direcciones */}
          <Card>
            <h3 className="font-semibold text-base mb-4 flex items-center gap-2 text-gray-700">
              <MapPin className="w-5 h-5 text-primary-600" />
              Direcciones
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500 block mb-1">🔵 Origen:</span>
                <p className="font-semibold">
                  {origin.address?.street} {origin.address?.number}
                </p>
                <p className="text-sm text-gray-600">{origin.address?.commune}</p>
                <p className="text-sm text-gray-600">
                  {origin.details?.propertyType} - Piso {origin.details?.floor}
                  {origin.details?.hasElevator ? ' (con ascensor)' : ' (sin ascensor)'}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500 block mb-1">🟢 Destino:</span>
                <p className="font-semibold">
                  {destination.address?.street} {destination.address?.number}
                </p>
                <p className="text-sm text-gray-600">{destination.address?.commune}</p>
                <p className="text-sm text-gray-600">
                  {destination.details?.propertyType} - Piso {destination.details?.floor}
                  {destination.details?.hasElevator ? ' (con ascensor)' : ' (sin ascensor)'}
                </p>
              </div>
            </div>

            {/* Distancia calculada */}
            {totalDistance > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">📏 Distancia estimada:</span>
                  <span className="font-semibold text-primary-600">{formatDistanceKm(totalDistance)}</span>
                </div>
                {totalDistance > freeKilometers && (
                  <p className="text-xs text-gray-500 mt-1">
                    Primeros {freeKilometers} km incluidos.
                    Se cobran {totalDistance - freeKilometers} km adicionales.
                  </p>
                )}
                {totalDistance <= freeKilometers && (
                  <p className="text-xs text-green-600 mt-1">
                    ✅ Distancia incluida en el precio base (hasta {freeKilometers} km gratis)
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Items */}
          <Card>
            <h3 className="font-semibold text-base mb-4 flex items-center gap-2 text-gray-700">
              <Package className="w-5 h-5 text-primary-600" />
              Items a Transportar ({items.reduce((sum, item) => sum + item.quantity, 0)} items)
            </h3>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {items.map((item) => {
                const hasPackaging = item.packaging && item.packaging.type !== 'none'

                return (
                  <div
                    key={item.id}
                    className="p-2 bg-gray-50 rounded"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        {item.name} <span className="text-gray-500">x{item.quantity}</span>
                      </span>
                      <span className="text-xs text-gray-500">
                        {parseFloat((item.volume * item.quantity).toFixed(2))} m³
                      </span>
                    </div>
                    {hasPackaging && (
                      <div className="mt-1 text-xs text-green-700">
                        📦 Con embalaje especial
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-500">Volumen Total</p>
                <p className="font-bold text-lg">{parseFloat(totalVolume.toFixed(2))} m³</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Peso Total</p>
                <p className="font-bold text-lg">{totalWeight} kg</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Vehículo</p>
                <p className="font-bold text-lg">🚚</p>
                <p className="text-xs text-gray-600">{recommendedVehicle}</p>
              </div>
            </div>
          </Card>

          {/* Embalaje Especial */}
          {items.some(item => item.packaging && item.packaging.type !== 'none') && (() => {
            // Calcular costo total: volumen de items con embalaje × precio por m³
            const packagingCost = items
              .filter(item => item.packaging && item.packaging.type !== 'none')
              .reduce((sum, item) => {
                const itemVolume = item.volume * item.quantity
                const itemPackagingCost = item.packaging?.pricePerUnit || 0
                return sum + (itemPackagingCost * itemVolume)
              }, 0)

            // Calcular volumen total con embalaje
            const volumeWithPackaging = items
              .filter(item => item.packaging && item.packaging.type !== 'none')
              .reduce((sum, item) => sum + (item.volume * item.quantity), 0)

            return (
              <Card>
                <h3 className="font-semibold text-base mb-4 text-gray-700">📦 Embalaje Especial</h3>

                {/* Info importante */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-blue-800">
                    <strong>💡 Nota:</strong> El embalaje especial se cobra multiplicando el precio por el volumen de los items que tienen embalaje seleccionado ({parseFloat(volumeWithPackaging.toFixed(1))} m³).
                  </p>
                </div>

                {/* Items con embalaje */}
                <div className="space-y-3 mb-4">
                  {items
                    .filter(item => item.packaging && item.packaging.type !== 'none')
                    .map((item) => {
                      const itemVolume = item.volume * item.quantity
                      const itemPackagingCost = item.packaging?.pricePerUnit || 0
                      const itemTotal = itemPackagingCost * itemVolume

                      return (
                        <div key={`packaging-${item.id}`} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                          <div>
                            <span className="font-medium">{item.name}</span>
                            <span className="text-gray-500"> ×{item.quantity}</span>
                            <div className="text-xs text-gray-500">
                              {parseFloat(itemVolume.toFixed(2))} m³ × ${itemPackagingCost.toLocaleString()}/m³
                            </div>
                          </div>
                          <span className="font-semibold">
                            ${itemTotal.toLocaleString()}
                          </span>
                        </div>
                      )
                    })}
                </div>

                {/* Total */}
                <div className="mt-4 pt-4 border-t flex justify-between font-bold text-green-700">
                  <span>Total Embalaje Especial:</span>
                  <span>${packagingCost.toLocaleString()}</span>
                </div>
              </Card>
            )
          })()}

          {/* Servicios Adicionales */}
          {(additionalServices.disassembly ||
            additionalServices.assembly ||
            additionalServices.packing ||
            additionalServices.unpacking ||
            additionalServices.observations) && (
              <Card>
                <h3 className="font-semibold text-base mb-4 text-gray-700">Servicios Adicionales</h3>
                <div className="space-y-2">
                  {additionalServices.disassembly && (
                    <div className="flex justify-between text-sm">
                      <span>✓ Desarme de muebles</span>
                      <span className="font-semibold">${pricingConfig.services.disassembly.toLocaleString()}</span>
                    </div>
                  )}
                  {additionalServices.assembly && (
                    <div className="flex justify-between text-sm">
                      <span>✓ Armado de muebles</span>
                      <span className="font-semibold">${pricingConfig.services.assembly.toLocaleString()}</span>
                    </div>
                  )}
                  {additionalServices.packing && (
                    <div className="flex justify-between items-center text-sm">
                      <div>
                        <span>✓ Armado de Cajas</span>
                        <p className="text-xs text-blue-600 mt-0.5">💬 Para contratar este servicio, habla con un ejecutivo</p>
                      </div>
                    </div>
                  )}
                  {additionalServices.unpacking && (
                    <div className="flex justify-between items-center text-sm">
                      <div>
                        <span>✓ Desembalaje</span>
                        <p className="text-xs text-blue-600 mt-0.5">💬 Para contratar este servicio, habla con un ejecutivo</p>
                      </div>
                    </div>
                  )}
                </div>
                {additionalServices.observations && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-500 mb-1">Observaciones:</p>
                    <p className="text-sm text-gray-700">{additionalServices.observations}</p>
                  </div>
                )}
              </Card>
            )}
        </div>
      </div>

      {/* Editar cotización — link discreto al final */}
      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={() => {
            trackEvent('click_editar_cotizacion')
            onPrevious()
          }}
          disabled={isSubmitting}
          className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 disabled:opacity-50"
        >
          ¿Necesitas cambiar algún dato? Editar cotización
        </button>
      </div>
    </div>
  )
}
