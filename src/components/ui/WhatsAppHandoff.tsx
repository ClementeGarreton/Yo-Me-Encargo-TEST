'use client'

import { ArrowDown, CheckCircle2, MessageCircle, ShieldCheck } from 'lucide-react'
import { buildBusinessWhatsAppLink } from '@/lib/whatsapp'
import { trackEvent } from '@/lib/tracking'

interface WhatsAppHandoffProps {
  message: string
  label?: string
  helper?: string
  location: string
  className?: string
  headline?: string
  eyebrow?: string
  strong?: boolean
  size?: 'default' | 'compact'
}

export default function WhatsAppHandoff({
  message,
  label = 'AFINAR DETALLES CON NUESTRO EJECUTIVO',
  helper = 'Así tendremos tu solicitud agendada en el chat y podremos acompañarte personalmente para evitar olvidos, cambios de último minuto y problemas de coordinación.',
  location,
  className = '',
  headline = 'AFINA LOS DETALLES DE TU MUDANZA CON NUESTRO EJECUTIVO',
  eyebrow = 'SIGUIENTE PASO · MENOS DE 10 SEGUNDOS',
  strong = false,
  size = 'default',
}: WhatsAppHandoffProps) {
  const href = buildBusinessWhatsAppLink(message)
  const isCompact = size === 'compact'

  if (!strong) {
    return (
      <div className={`rounded-2xl border-2 border-green-200 bg-green-50 p-4 ${className}`}>
        <p className="text-sm font-bold text-green-950">Seguimiento personalizado por WhatsApp</p>
        <p className="mt-1 text-xs leading-relaxed text-green-800">{helper}</p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent('Contact', { method: 'whatsapp', location })}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-95"
        >
          <MessageCircle className="w-5 h-5" />
          {label}
        </a>
      </div>
    )
  }

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border-4 border-[#25D366] bg-gradient-to-br from-green-50 via-white to-green-50 ${
        isCompact ? 'p-4 md:p-5' : 'p-5 md:p-7'
      } shadow-2xl ${className}`}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#25D366]/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-4 ring-[#25D366]/10 animate-pulse" />

      <div className="relative text-center">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#0B7A35] text-white ${
            isCompact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'
          } font-black uppercase tracking-[0.12em]`}
        >
          <ShieldCheck className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          {eyebrow}
        </span>

        <h3
          className={`mx-auto mt-3 max-w-xl font-black uppercase leading-tight tracking-tight text-gray-950 ${
            isCompact ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'
          }`}
        >
          {headline}
        </h3>
        <p
          className={`mx-auto mt-2 max-w-xl font-semibold leading-relaxed text-gray-700 ${
            isCompact ? 'text-xs md:text-sm' : 'text-sm md:text-base'
          }`}
        >
          {helper}
        </p>

        <div className={`flex items-center justify-center gap-1 text-[#0B7A35] ${isCompact ? 'my-3' : 'my-4'}`} aria-hidden="true">
          <ArrowDown className={`${isCompact ? 'h-5 w-5' : 'h-6 w-6'} animate-bounce`} />
          <ArrowDown className={`${isCompact ? 'h-5 w-5' : 'h-6 w-6'} animate-bounce [animation-delay:120ms]`} />
          <ArrowDown className={`${isCompact ? 'h-5 w-5' : 'h-6 w-6'} animate-bounce [animation-delay:240ms]`} />
        </div>

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent('Contact', { method: 'whatsapp', location })}
          className={`group relative inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#25D366] text-white shadow-xl shadow-green-900/15 transition hover:scale-[1.01] hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-green-300 ${
            isCompact ? 'px-4 py-3 text-sm md:text-base' : 'px-5 py-4 text-base md:text-lg'
          } font-black uppercase tracking-wide`}
        >
          <span className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 transition group-hover:opacity-100" />
          <MessageCircle className={`relative ${isCompact ? 'h-5 w-5' : 'h-6 w-6'}`} />
          <span className="relative">{label}</span>
        </a>

        <div
          className={`mt-3 flex items-start justify-center gap-2 text-left font-semibold leading-relaxed text-gray-600 ${
            isCompact ? 'text-[11px] md:text-xs' : 'text-xs md:text-sm'
          }`}
        >
          <CheckCircle2 className={`mt-0.5 shrink-0 text-[#0B7A35] ${isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
          <span>
            No necesitas escribir nada: el mensaje ya está preparado. Solo abre WhatsApp y toca <strong>Enviar</strong>.
          </span>
        </div>
      </div>
    </div>
  )
}
