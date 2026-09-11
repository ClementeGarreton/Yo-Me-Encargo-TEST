import type { Metadata } from 'next'
import { Archivo, Hanken_Grotesk } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { GoogleTagManager } from '@next/third-parties/google'
import { MetaPixel } from '@/components/tracking/MetaPixel'
import AttributionCapture from '@/components/tracking/AttributionCapture'
import WhatsAppFloatingButton from '@/components/ui/WhatsAppFloatingButton'

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-archivo',
  display: 'swap',
})

const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-hanken',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://yomeencargo.cl'),
  title: {
    default: 'Yo me Encargo - Fletes, Mudanzas y Traslados de Carga en Chile',
    template: '%s | Yo me Encargo'
  },
  description: 'Servicio profesional de mudanzas, fletes y transporte en la Región Metropolitana y todo Chile. Cotización online instantánea, precios transparentes y atención personalizada. ¡Contáctanos!',
  keywords: ['mudanzas Santiago', 'fletes Chile', 'transporte región metropolitana', 'mudanzas oficina', 'mudanzas hogar', 'traslado regiones', 'cotizador mudanzas', 'fletes Santiago', 'transporte carga Chile', 'mudanzas profesionales', 'mudanzas económicas', 'servicio de mudanzas'],
  authors: [{ name: 'Yo me Encargo', url: 'https://yomeencargo.cl' }],
  creator: 'Yo me Encargo',
  publisher: 'Yo me Encargo',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://yomeencargo.cl',
  },
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    url: 'https://yomeencargo.cl',
    title: 'Yo me Encargo - Fletes, Mudanzas y Traslados de Carga en Chile',
    description: 'Fletes, mudanzas y traslados de carga en Santiago y todo Chile. Cotiza online al instante. Servicio puntual, seguro y con los mejores precios.',
    siteName: 'Yo me Encargo',
    images: [
      {
        url: '/images/hero-truck.jpg',
        width: 1200,
        height: 630,
        alt: 'Yo me Encargo - Mudanzas y Fletes en Chile',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yo me Encargo - Fletes, Mudanzas y Traslados de Carga en Chile',
    description: 'Fletes, mudanzas y traslados de carga en Santiago y todo Chile. Cotiza online al instante.',
    images: ['/images/hero-truck.jpg'],
  },
  verification: {
    google: '44L3bcsIFU2zQOJ7aqffCqSkWNfWiE-KlxCrL2xNdeo',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Schema.org JSON-LD para LocalBusiness
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MovingCompany',
    name: 'Yo me Encargo',
    description: 'Servicio profesional de mudanzas, fletes y transporte en Santiago y todo Chile',
    url: 'https://yomeencargo.cl',
    logo: 'https://yomeencargo.cl/images/logo.png',
    image: 'https://yomeencargo.cl/images/hero-truck.jpg',
    telephone: '+56954390267',
    priceRange: '$$',
    areaServed: {
      '@type': 'Country',
      name: 'Chile'
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Santiago',
      addressRegion: 'Región Metropolitana',
      addressCountry: 'CL'
    },
    serviceType: [
      'Mudanzas',
      'Fletes',
      'Transporte de carga',
      'Mudanzas de hogar',
      'Mudanzas de oficina',
      'Traslado a regiones'
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '150'
    }
  }

  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e40af" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Yo me Encargo" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Meta Pixel */}
        <MetaPixel pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID || ''} />
      </head>
      <body className={`${archivo.variable} ${hankenGrotesk.variable}`}>
        <AttributionCapture />
        {children}
        <Toaster position="top-right" />
        <WhatsAppFloatingButton />
      </body>

      {/* Google Tag Manager */}
      {process.env.NEXT_PUBLIC_GTM_ID && (
        <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID} />
      )}
    </html>
  )
}

