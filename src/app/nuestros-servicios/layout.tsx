import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nuestros Servicios de Mudanzas y Fletes',
  description: 'Conoce todos nuestros servicios: mudanzas de hogar, oficina, fletes en Santiago, traslado a regiones, servicios corporativos y más.',
  keywords: ['servicios mudanzas', 'tipos de fletes', 'mudanza oficina', 'mudanza hogar', 'fletes Santiago', 'traslado regiones'],
  alternates: {
    canonical: 'https://yomeencargo.cl/nuestros-servicios',
  },
  openGraph: {
    title: 'Nuestros Servicios - Yo me Encargo',
    description: 'Soluciones de transporte y logística adaptadas a tus necesidades en todo Chile.',
    url: 'https://yomeencargo.cl/nuestros-servicios',
    images: ['/images/hero-truck.jpg'],
  },
}

export default function ServiciosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
