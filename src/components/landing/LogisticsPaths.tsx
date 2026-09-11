'use client'

import { motion } from 'framer-motion'

/**
 * Fondo animado estilo Tron clásico para el hero:
 * rutas verdes con giros a 90° (como calles) y UN camión logístico en escena
 * a la vez. Cuando el camión está por salir del encuadre, entra el siguiente
 * por otra ruta. Todo sobre blanco puro.
 *
 * Sincronía sin JS: cada <animateMotion> recorre su ruta visible y después un
 * tramo oculto fuera del encuadre, dimensionado para que a velocidad constante
 * el camión pase el resto del ciclo "manejando" fuera de cámara hasta su turno.
 * La estela usa el mismo timeline (keyTimes sobre el ciclo total), así nunca
 * se desfasa del camión.
 */

// Largo de la estela como fracción del recorrido (pathLength normalizado a 1)
const TRAIL = 0.16
// Segundos antes de que un camión salga del cuadro en que aparece el siguiente
const LEAD = 1.5

// Rutas ortogonales (solo tramos H/V). `len` = largo visible en unidades del viewBox
const ROUTES = [
  { id: 'lp-r1', base: 'M -60 120 H 400 V 240 H 880 V 160', endX: 1500, len: 1760, dur: 15 },
  { id: 'lp-r2', base: 'M -60 440 H 240 V 320 H 640 V 520 H 1080 V 400', endX: 1500, len: 2000, dur: 19 },
  { id: 'lp-r3', base: 'M -60 640 H 480 V 560 H 960 V 680', endX: 1500, len: 1760, dur: 17 },
]

// Ciclo total: los camiones corren en secuencia, solapados solo LEAD segundos
const TOTAL = ROUTES.reduce((sum, r) => sum + r.dur, 0) - ROUTES.length * LEAD

let acc = 0
const TIMED = ROUTES.map((r) => {
  const start = acc
  acc += r.dur - LEAD
  return {
    ...r,
    d: `${r.base} H ${r.endX}`,
    // tramo oculto: recta off-canvas que consume el resto del ciclo
    motionD: `${r.base} H ${Math.round(r.endX + (r.len * (TOTAL - r.dur)) / r.dur)}`,
    // begin negativo: todas las rutas arrancan ya en régimen, sin destellos
    begin: `${start - TOTAL}s`,
    // la estela tarda dur*(1+TRAIL): el recorrido + el drenado de la cola
    dashKeyTimes: `0;${((r.dur * (1 + TRAIL)) / TOTAL).toFixed(4)};1`,
  }
})

function Truck() {
  return (
    <>
      {/* halo del camión */}
      <circle r={12} fill="url(#lp-truck-glow)" />
      {/* caja del camión (vista desde arriba) */}
      <rect x={-13} y={-3.6} width={15} height={7.2} rx={1.8} fill="#FFFFFF" stroke="#6FA52E" strokeWidth={1.4} />
      {/* cabina */}
      <rect x={3.4} y={-3} width={6} height={6} rx={1.5} fill="#6FA52E" />
    </>
  )
}

export default function LogisticsPaths() {
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.6, ease: 'easeOut' }}
      className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
      style={{ transform: 'translateZ(0)' }}
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 1440 760"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* halo radial verde para el camión */}
          <radialGradient id="lp-truck-glow">
            <stop offset="0%" stopColor="#8CC63F" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#8CC63F" stopOpacity={0} />
          </radialGradient>
        </defs>

        {TIMED.map((r) => (
          <g key={r.id}>
            {/* geometría de referencia para el camión, con tramo oculto (no pinta) */}
            <path id={r.id} d={r.motionD} stroke="none" />

            {/* resplandor de la estela */}
            <path
              d={r.d}
              pathLength={1}
              stroke="#8CC63F"
              strokeOpacity={0.16}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={`${TRAIL} ${2 - TRAIL}`}
              strokeDashoffset={TRAIL}
            >
              <animate
                attributeName="stroke-dashoffset"
                values={`${TRAIL};-1;-1`}
                keyTimes={r.dashKeyTimes}
                dur={`${TOTAL}s`}
                begin={r.begin}
                repeatCount="indefinite"
              />
            </path>

            {/* núcleo brillante de la estela */}
            <path
              d={r.d}
              pathLength={1}
              stroke="#6FA52E"
              strokeOpacity={0.9}
              strokeWidth={1.2}
              strokeLinecap="round"
              strokeDasharray={`${TRAIL} ${2 - TRAIL}`}
              strokeDashoffset={TRAIL}
            >
              <animate
                attributeName="stroke-dashoffset"
                values={`${TRAIL};-1;-1`}
                keyTimes={r.dashKeyTimes}
                dur={`${TOTAL}s`}
                begin={r.begin}
                repeatCount="indefinite"
              />
            </path>

            {/* camión al frente de la estela */}
            <g>
              <animateMotion
                dur={`${TOTAL}s`}
                begin={r.begin}
                repeatCount="indefinite"
                rotate="auto"
              >
                <mpath href={`#${r.id}`} xlinkHref={`#${r.id}`} />
              </animateMotion>
              <Truck />
            </g>
          </g>
        ))}
      </svg>
    </motion.div>
  )
}
