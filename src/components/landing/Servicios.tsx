'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

const SERV = [
  {
    n: '01',
    title: 'Fletes',
    price: 'Desde $23.000',
    desc: 'Transporta lo que necesites de forma súper fácil y rápida: pocas cosas, una compra grande o un envío puntual. Pides, agendas y listo.',
  },
  {
    n: '02',
    title: 'Mudanzas',
    price: '',
    desc: 'Casas, departamentos y oficinas. Embalaje, carga, traslado y montaje incluidos. En la Región Metropolitana o a regiones de todo Chile.',
  },
  {
    n: '03',
    title: 'Traslados de carga',
    price: '',
    desc: 'Muebles, electrodomésticos, mercadería o equipos: movemos tu carga punto a punto, con cuidado y seguro de transporte incluido.',
  },
  {
    n: '04',
    title: 'Eventos',
    price: '',
    desc: 'Transporte, armado y desarmado para tus eventos: llevamos, montamos y desmontamos mobiliario, estructuras y equipamiento. Tú te enfocas en el evento, del resto nos encargamos.',
  },
]

export default function Servicios() {
  return (
    <section className="py-[120px] bg-white" id="servicios">
      <div className="max-w-[1180px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-[640px] mb-14"
        >
          <p className="text-[13px] font-bold tracking-[0.18em] uppercase text-[#6B7280]">
            Servicios
          </p>
          <h2
            className="font-archivo font-extrabold text-[#111827] mt-3.5 leading-[1.05]"
            style={{ fontSize: 'clamp(30px, 4.4vw, 46px)' }}
          >
            Lo que movemos por ti.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-t border-l border-[#E5E7EB] rounded-xl overflow-hidden">
          {SERV.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <Link
                href="/cotizador?start=online"
                className="block h-full p-10 border-b border-r border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors group relative"
              >
                <div className="font-archivo font-black text-[18px] text-[#6B7280] tracking-[0.02em]">
                  {s.n}
                </div>
                {s.price && (
                  <span className="absolute top-10 right-10 inline-flex items-center px-3 py-1 rounded-full text-[13px] font-bold bg-[#F0F8E8] text-[#4B6B1E] border border-[#D7EBBE]">
                    {s.price}
                  </span>
                )}
                <h3 className="font-archivo font-extrabold text-[24px] text-[#111827] mb-3 mt-[60px]">
                  {s.title}
                </h3>
                <p className="text-[16px] text-[#374151] leading-[1.6] mb-6">{s.desc}</p>
                <span className="inline-flex items-center gap-2 font-bold text-[15px] text-[#111827]">
                  Cotizar este servicio
                  <ArrowRight
                    size={16}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
