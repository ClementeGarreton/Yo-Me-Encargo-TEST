import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Yo me Encargo - Mudanzas y Fletes en Chile',
    short_name: 'Yo me Encargo',
    description: 'Servicio profesional de mudanzas, fletes y transporte en Santiago y todo Chile',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1e40af',
    icons: [
      {
        src: '/icon.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  }
}
