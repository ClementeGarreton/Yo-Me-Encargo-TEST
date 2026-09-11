'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Home, Check } from 'lucide-react'
import { trackEvent } from '@/lib/tracking'
import LogisticsPaths from './LogisticsPaths'

const benefits = [
  'Puntualidad garantizada',
  'Carga asegurada',
  '+1000 clientes',
]

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-white">
      {/* Rutas logísticas animadas estilo Tron */}
      <LogisticsPaths />

      <div className="relative max-w-[1180px] mx-auto px-6 pt-28 pb-20 lg:pt-36 lg:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-12 lg:gap-16 items-center">

          {/* ── Left column: message ── */}
          <div className="min-w-0 max-w-[600px]">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F0F8E8] border border-[#D7EBBE] px-3.5 py-1.5 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#8CC63F] opacity-60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#6FA52E]" />
              </span>
              <span className="text-[13px] font-bold tracking-wide text-[#4B6B1E]">
                Cotización online en minutos
              </span>
            </div>

            <h1
              className="font-archivo font-black text-[#101828] text-balance tracking-[-0.03em] leading-[1.02]"
              style={{ fontSize: 'clamp(40px, 5.6vw, 60px)' }}
            >
              Tu traslado resuelto.{' '}
              <span className="text-[#6FA52E]">Sin vueltas.</span>
            </h1>

            <p
              className="mt-6 font-medium text-[#475467] leading-[1.55] max-w-[540px]"
              style={{ fontSize: 'clamp(17px, 2vw, 20px)' }}
            >
              <strong className="text-[#101828]">Fletes, mudanzas y traslados de carga</strong> con
              precio fijo y sin sorpresas. Cotiza en minutos; nos encargamos de todo, de
              principio a fin.
            </p>

            {/* CTAs */}
            <div className="mt-9 flex flex-col sm:flex-row sm:items-center gap-3.5">
              <Link
                href="/cotizador?start=online"
                onClick={() => trackEvent('Click', { element: 'hero_cta', location: 'hero' })}
                className="inline-flex items-center justify-center gap-2.5 px-7 bg-[#8CC63F] hover:bg-[#6FA52E] text-[#0E1A05] font-bold rounded-xl shadow-[0_8px_24px_-8px_rgba(140,198,63,0.7)] transition-all group"
                style={{ height: '58px', fontSize: '18px' }}
              >
                Cotizar mi traslado online
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>

              {/* Va directo a /domicilio (no a la página base del cotizador): así cada CTA
                  lleva a su modalidad en un solo clic. El único CTA que abre la página base
                  del cotizador (con el selector Online/Domicilio) es el del Navbar. */}
              <Link
                href="/domicilio"
                onClick={() => trackEvent('Click', { element: 'hero_cta_domicilio', location: 'hero' })}
                className="inline-flex items-center justify-center gap-2.5 px-6 bg-white hover:bg-[#F9FAFB] text-[#101828] font-bold rounded-xl border border-[#D0D5DD] hover:border-[#98A2B3] transition-colors"
                style={{ height: '58px', fontSize: '17px' }}
              >
                <Home size={20} style={{ color: '#2C5282' }} />
                Cotizar a domicilio
              </Link>
            </div>

            {/* Benefits — compact row */}
            <ul className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2.5">
              {benefits.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check size={16} strokeWidth={3} className="text-[#6FA52E] flex-shrink-0" />
                  <span className="font-semibold text-[13.5px] text-[#374151]">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Right column: team photo ── */}
          <div className="relative">
            {/* accent glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-4 rounded-[28px] bg-[#8CC63F]/10 blur-2xl"
            />

            {/* Premium image card with a left-to-right loading reveal */}
            <div className="hero-img-reveal group relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-[#EEF2F6] shadow-[0_30px_60px_-18px_rgba(16,24,40,0.38)] ring-1 ring-black/5">
              <Image
                src="/images/hero-team.jpg"
                alt="Equipo de Yo me Encargo frente al camión corporativo"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover object-[50%_42%] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
