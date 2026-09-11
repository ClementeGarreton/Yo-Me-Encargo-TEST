'use client'

import Image from 'next/image'

const LOGOS = [
  { src: '/images/empresas/alaluf-propiedades.png', name: 'Alaluf Propiedades' },
  { src: '/images/empresas/fundacion-tarucas.png',  name: 'Fundación Tarucas' },
  { src: '/images/empresas/logo_applefix_hd.png',   name: 'AppleFix' },
  { src: '/images/empresas/luisiana-pacific.png',   name: 'Louisiana Pacific' },
  { src: '/images/empresas/monfiza.png',            name: 'Monfiza' },
  { src: '/images/empresas/motor-doo.png',          name: 'Motor Doo' },
  { src: '/images/empresas/spark-talents.png',      name: 'Spark Talents' },
]

function LogoItem({ src, name }: { src: string; name: string }) {
  return (
    <div
      className="relative flex-shrink-0 h-[56px] w-[140px] grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300 select-none"
      title={name}
    >
      <Image
        src={src}
        alt={name}
        fill
        sizes="140px"
        className="object-contain"
      />
    </div>
  )
}

export default function ClientLogos() {
  // 4 copias: la animación corre -50% (2 sets), así el loop no abre huecos
  // en pantallas más anchas que un set de logos
  const doubled = [...LOGOS, ...LOGOS, ...LOGOS, ...LOGOS]

  return (
    <section className="bg-[#F3F4F6] py-14">
      <div className="max-w-[1180px] mx-auto px-6 mb-8">
        <p className="text-center text-[13px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF]">
          Empresas que confían en nosotros
        </p>
      </div>
      <div
        className="relative overflow-hidden marquee-wrapper"
        style={{
          WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)',
          maskImage: 'linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)',
        }}
      >
        <div className="marquee-track flex gap-16 w-max items-center">
          {doubled.map((logo, i) => (
            <LogoItem key={i} src={logo.src} name={logo.name} />
          ))}
        </div>
      </div>
    </section>
  )
}
