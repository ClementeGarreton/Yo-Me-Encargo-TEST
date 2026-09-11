'use client'

import { useRef } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useMotionTemplate,
  type MotionValue,
} from 'framer-motion'

const CursorIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3H5a2 2 0 0 0-2 2v4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4"/>
    <path d="m13 13 6 6M13 13v5M13 13h5"/>
  </svg>
)

const CalendarIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>
  </svg>
)

const TruckIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 17h4V5a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h1"/>
    <path d="M14 9h4l4 4v3a1 1 0 0 1-1 1h-1"/>
    <circle cx="6.5" cy="17.5" r="2.5"/>
    <circle cx="17.5" cy="17.5" r="2.5"/>
  </svg>
)

const STEPS = [
  {
    n: '01',
    Icon: CursorIcon,
    title: 'Cotiza online',
    desc: 'Cuéntanos qué trasladas y a dónde. Recibes un precio fijo en 3 minutos.',
  },
  {
    n: '02',
    Icon: CalendarIcon,
    title: 'Agenda tu fecha',
    desc: 'Eliges día y hora; confirmamos disponibilidad al instante.',
  },
  {
    n: '03',
    Icon: TruckIcon,
    title: 'Nosotros nos encargamos',
    desc: 'Cargamos, trasladamos y entregamos. Tú solo abres la puerta.',
  },
]

const FILL_SPAN = 0.18

function StepNumber({
  n,
  index,
  total,
  progress,
}: {
  n: string
  index: number
  total: number
  progress: MotionValue<number>
}) {
  const start = index / total
  const next = (index + 1) / total
  const isLast = index === total - 1

  // Se llena en su tramo y se vacía mientras se llena el siguiente; el último queda lleno
  const remaining = useTransform(
    progress,
    isLast ? [start, start + FILL_SPAN] : [start, start + FILL_SPAN, next, next + FILL_SPAN],
    isLast ? [100, 0] : [100, 0, 0, 100],
  )
  const clipPath = useMotionTemplate`inset(0 ${remaining}% 0 0)`

  return (
    <div
      className="absolute font-archivo font-black text-[#F3F4F6] select-none pointer-events-none tracking-[-0.04em]"
      style={{ fontSize: '80px', lineHeight: '0.8', top: '-22px', left: '-6px', zIndex: 0 }}
    >
      {n}
      <motion.span aria-hidden className="absolute inset-0 text-[#8CC63F]" style={{ clipPath }}>
        {n}
      </motion.span>
    </div>
  )
}

export default function HowItWorks() {
  const gridRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: gridRef,
    offset: ['start 0.95', 'end 0.05'],
  })

  return (
    <section className="py-[120px] bg-white" id="proceso">
      <div className="max-w-[1180px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-[640px] mb-16"
        >
          <p className="text-[13px] font-bold tracking-[0.18em] uppercase text-[#6B7280]">
            Cómo funciona
          </p>
          <h2
            className="font-archivo font-extrabold text-[#111827] mt-3.5 leading-[1.05]"
            style={{ fontSize: 'clamp(30px, 4.4vw, 46px)' }}
          >
            Tres pasos. Cero complicaciones.
          </h2>
          <p className="mt-4 text-[18px] text-[#374151] leading-[1.55]">
            Diseñamos el proceso para que muevas tu vida o tu empresa sin perder un día coordinando llamados.
          </p>
        </motion.div>

        <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {STEPS.map(({ n, Icon, title, desc }, i) => (
            <motion.div
              key={n}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="relative pt-3.5"
            >
              {/* Decorative number with scroll-driven green fill */}
              <StepNumber n={n} index={i} total={STEPS.length} progress={scrollYProgress} />
              <div className="relative z-10 text-[#111827] mb-[18px]">
                <Icon />
              </div>
              <h3 className="relative z-10 font-archivo font-extrabold text-[21px] text-[#111827] mb-2">
                {title}
              </h3>
              <p className="relative z-10 text-[16px] text-[#374151] leading-[1.55] max-w-[300px]">
                {desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
