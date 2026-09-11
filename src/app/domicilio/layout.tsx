import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cotización a Domicilio',
  description: 'Servicio de cotización a domicilio en Región Metropolitana. Evaluación profesional en terreno, ideal para mudanzas grandes.',
  keywords: ['cotización a domicilio', 'visita domicilio', 'evaluación mudanza', 'cotización personalizada'],
  alternates: {
    canonical: 'https://yomeencargo.cl/domicilio',
  },
  openGraph: {
    title: 'Cotización a Domicilio - Yo me Encargo',
    description: 'Te visitamos en tu hogar para realizar una cotización completa y personalizada. Solo RM.',
    url: 'https://yomeencargo.cl/domicilio',
    images: ['/images/hero-truck.jpg'],
  },
}

export default function DomicilioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
