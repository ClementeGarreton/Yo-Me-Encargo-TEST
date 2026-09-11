import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cotizador Online de Mudanzas',
  description: 'Cotiza tu mudanza o flete en línea de forma instantánea. Calcula el precio de tu servicio de transporte con nuestro cotizador inteligente.',
  keywords: ['cotizar mudanza', 'cotizador online', 'precio mudanza', 'calcular flete', 'presupuesto mudanza'],
  alternates: {
    canonical: 'https://yomeencargo.cl/cotizador',
  },
  openGraph: {
    title: 'Cotizador Online de Mudanzas - Yo me Encargo',
    description: 'Obtén tu cotización instantánea. Calcula el precio de tu mudanza o flete en segundos.',
    url: 'https://yomeencargo.cl/cotizador',
    images: ['/images/hero-truck.jpg'],
  },
}

export default function CotizadorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
