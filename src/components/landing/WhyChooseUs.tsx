'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView, animate } from 'framer-motion'

type Benefit = {
  stat: string
  countTo?: number
  prefix?: string
  map?: boolean
  label: string
  title: string
  desc: string
}

const BENEF: Benefit[] = [
  {
    stat: '+1000',
    countTo: 1000,
    prefix: '+',
    label: 'clientes',
    title: 'Trayectoria desde 2020',
    desc: 'Operando en la Región Metropolitana y todo Chile, sin tercerizar a ciegas.',
  },
  {
    stat: '2020',
    label: 'desde',
    title: 'Puntualidad, compromiso y calidad yomeencargo',
    desc: 'Cumplimos los horarios acordados y cuidamos cada detalle del traslado, de principio a fin.',
  },
  {
    stat: '100%',
    label: 'carga asegurada',
    title: 'Tus cosas, protegidas',
    desc: 'Embalamos, cubrimos y aseguramos cada traslado durante todo el trayecto.',
  },
  {
    stat: '',
    map: true,
    label: 'cobertura',
    title: 'Cobertura nacional',
    desc: 'Fletes, mudanzas y traslados de carga en la RM y a todo Chile.',
  },
]

function StatNumber({ benefit, delay }: { benefit: Benefit; delay: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (benefit.countTo == null || !inView) return
    const controls = animate(0, benefit.countTo, {
      duration: 1.6,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setCount(Math.round(v)),
    })
    return () => controls.stop()
  }, [inView, benefit.countTo, delay])

  return (
    <motion.span
      ref={ref}
      initial={{ opacity: 0, scale: 0.5 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ type: 'spring', stiffness: 280, damping: 18, delay }}
      className="inline-block font-archivo font-black text-[#111827] tracking-[-0.03em]"
      style={{ fontSize: '46px', lineHeight: '0.95' }}
    >
      {benefit.countTo != null ? `${benefit.prefix ?? ''}${count}` : benefit.stat}
    </motion.span>
  )
}

function CoverageMap({ delay }: { delay: number }) {
  return (
    <motion.svg
      viewBox="0 0 120 150"
      width="104"
      height="130"
      fill="none"
      role="img"
      aria-label="Cobertura en todo Chile"
      initial={{ opacity: 0, scale: 0.85, y: 8 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: 'block', overflow: 'visible', marginTop: '-14px' }}
    >
      {/* Silueta de Sudamérica */}
      <path
        d="M45 15 C55 10 66 10 75 13 C88 17 99 21 106 33 C112 43 111 52 108 61 C105 72 100 81 95 89 C90 98 85 106 80 113 C74 122 69 134 62 145 C60 148 57 147 56 143 C53 132 56 125 53 117 C49 103 44 92 40 78 C37 69 32 65 30 58 C28 50 31 42 35 35 C37 28 39 19 45 15 Z"
        fill="#E6EAED"
        stroke="#CDD4DA"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Costa de Chile resaltada (se dibuja en la animación) */}
      <motion.path
        d="M30 58 C32 65 37 69 40 78 C44 92 49 103 53 117 C56 125 53 132 56 143 C57 147 60 148 62 145"
        fill="none"
        stroke="#6FA52E"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 1, delay: delay + 0.25, ease: 'easeInOut' }}
      />
      {/* Pin pulsante sobre Chile central */}
      <motion.circle
        cx="44"
        cy="92"
        r="6"
        fill="#6FA52E"
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        initial={{ scale: 0, opacity: 0.45 }}
        whileInView={{ scale: [0, 1.9], opacity: [0.45, 0] }}
        viewport={{ once: true }}
        transition={{
          duration: 1.8,
          delay: delay + 0.8,
          repeat: Infinity,
          repeatDelay: 0.5,
          ease: 'easeOut',
        }}
      />
      <circle cx="44" cy="92" r="3.4" fill="#6FA52E" stroke="#F8F8F8" strokeWidth={1.4} />
    </motion.svg>
  )
}

export default function WhyChooseUs() {
  return (
    <section className="py-[120px] bg-[#F8F8F8]" id="beneficios">
      <div className="max-w-[1180px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="max-w-[640px]"
        >
          <p className="text-[13px] font-bold tracking-[0.18em] uppercase text-[#6B7280]">
            Por qué elegirnos
          </p>
          <h2
            className="font-archivo font-extrabold text-[#111827] mt-3.5 leading-[1.05]"
            style={{ fontSize: 'clamp(30px, 4.4vw, 46px)' }}
          >
            Una empresa de transportes, no una app.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 mt-14" style={{ gap: '56px 72px' }}>
          {BENEF.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="flex gap-6 items-start"
            >
              <div className="flex-shrink-0" style={{ minWidth: '128px' }}>
                {b.map ? (
                  <CoverageMap delay={i * 0.1 + 0.15} />
                ) : (
                  <>
                    <StatNumber benefit={b} delay={i * 0.1 + 0.15} />
                    <em
                      className="block not-italic font-bold tracking-[0.04em] mt-1.5"
                      style={{ fontSize: '14px', color: '#6FA52E' }}
                    >
                      {b.label}
                    </em>
                  </>
                )}
              </div>
              <div>
                <h3 className="font-archivo font-extrabold text-[19px] text-[#111827] mb-1.5">
                  {b.title}
                </h3>
                <p className="text-[16px] text-[#374151] leading-[1.55]">{b.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
