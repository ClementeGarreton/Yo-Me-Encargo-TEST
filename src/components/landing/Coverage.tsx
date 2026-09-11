'use client'

import { MapPin, Truck, Package } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Coverage() {
  const regions = [
    'Región Metropolitana',
    'Valparaíso',
    'O\'Higgins',
    'Maule',
    'Biobío',
    'Araucanía',
    'Los Lagos',
    'Coquimbo',
    'Atacama',
    'Antofagasta',
    'Tarapacá',
    'Arica y Parinacota',
    'Los Ríos',
    'Aysén',
    'Magallanes',
  ]

  return (
    <section id="cobertura" className="py-20 md:py-28 bg-gradient-to-br from-brand-blue via-brand-blue to-brand-green-dark text-white relative overflow-hidden isolate">
      {/* Patrón decorativo contenido */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ contain: 'paint' }}>
        <div className="absolute inset-0 w-full h-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='15' cy='15' r='3' fill='%23ffffff' fill-opacity='0.3'/%3E%3Ccircle cx='45' cy='15' r='2' fill='%23ffffff' fill-opacity='0.3'/%3E%3Ccircle cx='30' cy='30' r='2.5' fill='%23ffffff' fill-opacity='0.3'/%3E%3Ccircle cx='15' cy='45' r='2' fill='%23ffffff' fill-opacity='0.3'/%3E%3Ccircle cx='45' cy='45' r='3' fill='%23ffffff' fill-opacity='0.3'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px',
          backgroundRepeat: 'repeat',
        }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Contenido Principal */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              Cobertura en Todo Chile
            </h2>
            <p className="text-lg md:text-xl mb-8 text-white/90">
              Llevamos tus pertenencias a donde las necesites, desde Arica hasta Punta Arenas
            </p>

            <div className="space-y-6">
              <div className="flex items-start space-x-4 bg-white/10 backdrop-blur-sm p-5 rounded-xl">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Región Metropolitana</h3>
                  <p className="text-white/80">
                    Cobertura completa en Santiago y alrededores. Servicio el mismo día disponible.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 bg-white/10 backdrop-blur-sm p-5 rounded-xl">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Truck size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Traslados a Regiones</h3>
                  <p className="text-white/80">
                    Realizamos envíos y mudanzas a todas las regiones de Chile con tracking incluido.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 bg-white/10 backdrop-blur-sm p-5 rounded-xl">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Package size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Envíos Nacionales</h3>
                  <p className="text-white/80">
                    Desde pequeños paquetes hasta cargas completas. Cotiza tu envío en segundos.
                  </p>
                </div>
              </div>
            </div>

            <a
              href="/cotizador"
              className="mt-8 inline-block px-8 py-4 bg-white text-brand-blue rounded-lg hover:bg-gray-100 transition-all duration-300 font-bold shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
            >
              Cotizar mi Traslado
            </a>
          </motion.div>

          {/* Mapa/Regiones */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl"
          >
            <h3 className="text-2xl font-bold mb-6 text-center">
              Todas las Regiones de Chile
            </h3>
            
            {/* Grid de regiones */}
            <div className="grid grid-cols-2 gap-3">
              {regions.map((region, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-2 bg-white/10 p-3 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-brand-green flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-medium">{region}</span>
                </div>
              ))}
            </div>

            {/* Imagen de mapa de cobertura */}
            <div className="mt-6 rounded-xl overflow-hidden">
              <img
                src="/images/cobertura-mapa.jpg"
                alt="Mapa de cobertura - Todas las regiones de Chile"
                className="w-full h-auto rounded-xl shadow-lg"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

