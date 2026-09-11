'use client'

import { useState } from 'react'
import { useQuoteStore } from '@/store/quoteStore'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Card from '../ui/Card'
import AddressAutocomplete from '../ui/AddressAutocomplete'
import { MapPin, Navigation, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

interface AddressStepProps {
  onNext: () => void
  onPrevious: () => void
}

const comunasPorRegion: Record<string, string[]> = {
  arica: [
    'Arica', 'Camarones', 'General Lagos', 'Putre'
  ].sort(),
  tarapaca: [
    'Alto Hospicio', 'Camiña', 'Colchane', 'Huara', 'Iquique', 'Pica', 'Pozo Almonte'
  ].sort(),
  antofagasta: [
    'Antofagasta', 'Calama', 'María Elena', 'Mejillones', 'Ollagüe', 'San Pedro de Atacama', 
    'Sierra Gorda', 'Taltal', 'Tocopilla'
  ].sort(),
  atacama: [
    'Alto del Carmen', 'Caldera', 'Chañaral', 'Copiapó', 'Diego de Almagro', 'Freirina', 
    'Huasco', 'Tierra Amarilla', 'Vallenar'
  ].sort(),
  coquimbo: [
    'Andacollo', 'Canela', 'Combarbalá', 'Coquimbo', 'Illapel', 'La Higuera', 'La Serena', 
    'Los Vilos', 'Monte Patria', 'Ovalle', 'Paiguano', 'Punitaqui', 'Río Hurtado', 'Salamanca', 
    'Vicuña'
  ].sort(),
  valparaiso: [
    'Algarrobo', 'Cabildo', 'Calera', 'Calle Larga', 'Cartagena', 'Casablanca',
    'Catemu', 'Concón', 'El Quisco', 'El Tabo', 'Hijuelas', 'Isla de Pascua',
    'Juan Fernández', 'La Cruz', 'La Ligua', 'Limache', 'Llaillay', 'Los Andes',
    'Nogales', 'Olmué', 'Panquehue', 'Papudo', 'Petorca', 'Puchuncaví', 'Putaendo',
    'Quillota', 'Quilpué', 'Quintero', 'Rinconada', 'San Antonio', 'San Esteban',
    'San Felipe', 'Santa María', 'Santo Domingo', 'Valparaíso', 'Villa Alemana',
    'Viña del Mar', 'Zapallar'
  ].sort(),
  metropolitana: [
    'Alhué', 'Buin', 'Calera de Tango', 'Cerrillos', 'Cerro Navia', 'Colina',
    'Conchalí', 'Curacaví', 'El Bosque', 'El Monte', 'Estación Central',
    'Huechuraba', 'Independencia', 'Isla de Maipo', 'La Cisterna', 'La Florida',
    'La Granja', 'La Pintana', 'La Reina', 'Lampa', 'Las Condes', 'Lo Barnechea',
    'Lo Espejo', 'Lo Prado', 'Macul', 'Maipú', 'María Pinto', 'Melipilla', 'Ñuñoa',
    'Padre Hurtado', 'Paine', 'Pedro Aguirre Cerda', 'Peñaflor', 'Peñalolén',
    'Pirque', 'Providencia', 'Pudahuel', 'Puente Alto', 'Quilicura', 'Quinta Normal',
    'Recoleta', 'Renca', 'San Bernardo', 'San Joaquín', 'San José de Maipo',
    'San Miguel', 'San Pedro', 'San Ramón', 'Santiago', 'Talagante', 'Tiltil', 'Vitacura'
  ].sort(),
  ohiggins: [
    'Chépica', 'Chimbarongo', 'Codegua', 'Coinco', 'Coltauco', 'Doñihue',
    'Graneros', 'La Estrella', 'Las Cabras', 'Litueche', 'Lolol', 'Machalí',
    'Malloa', 'Marchihue', 'Mostazal', 'Nancagua', 'Navidad', 'Olivar',
    'Palmilla', 'Paredones', 'Peralillo', 'Peumo', 'Pichidegua', 'Pichilemu',
    'Placilla', 'Pumanque', 'Quinta de Tilcoco', 'Rancagua', 'Rengo', 'Requínoa',
    'San Fernando', 'San Vicente', 'Santa Cruz'
  ].sort(),
  maule: [
    'Cauquenes', 'Chanco', 'Colbún', 'Constitución', 'Curepto', 'Curicó',
    'Empedrado', 'Hualañé', 'Licantén', 'Linares', 'Longaví', 'Maule',
    'Molina', 'Parral', 'Pelarco', 'Pelluhue', 'Pencahue', 'Rauco',
    'Retiro', 'Río Claro', 'Romeral', 'Sagrada Familia', 'San Clemente',
    'San Javier', 'San Rafael', 'Talca', 'Teno', 'Vichuquén', 'Villa Alegre',
    'Yerbas Buenas'
  ].sort(),
  nuble: [
    'Bulnes', 'Chillán', 'Chillán Viejo', 'Cobquecura', 'Coelemu', 'Coihueco', 
    'El Carmen', 'Ninhue', 'Ñiquén', 'Pemuco', 'Pinto', 'Portezuelo', 'Quillón', 
    'Quirihue', 'Ránquil', 'San Carlos', 'San Fabián', 'San Ignacio', 'San Nicolás', 
    'Treguaco', 'Yungay'
  ].sort(),
  biobio: [
    'Alto Biobío', 'Antuco', 'Arauco', 'Cabrero', 'Cañete', 'Chiguayante', 'Concepción', 
    'Contulmo', 'Coronel', 'Curanilahue', 'Florida', 'Hualpén', 'Hualqui', 'Laja', 
    'Lebu', 'Los Álamos', 'Los Ángeles', 'Lota', 'Mulchén', 'Nacimiento', 'Negrete', 
    'Penco', 'Quilaco', 'Quilleco', 'San Pedro de la Paz', 'San Rosendo', 'Santa Bárbara', 
    'Santa Juana', 'Talcahuano', 'Tirúa', 'Tomé', 'Tucapel', 'Yumbel'
  ].sort(),
  araucania: [
    'Angol', 'Carahue', 'Cholchol', 'Collipulli', 'Cunco', 'Curacautín', 'Curarrehue', 
    'Ercilla', 'Freire', 'Galvarino', 'Gorbea', 'Lautaro', 'Loncoche', 'Lonquimay', 
    'Los Sauces', 'Lumaco', 'Melipeuco', 'Nueva Imperial', 'Padre Las Casas', 'Perquenco', 
    'Pitrufquén', 'Pucón', 'Purén', 'Renaico', 'Saavedra', 'Temuco', 'Teodoro Schmidt', 
    'Toltén', 'Traiguén', 'Victoria', 'Vilcún', 'Villarrica'
  ].sort(),
  losrios: [
    'Corral', 'Futrono', 'La Unión', 'Lago Ranco', 'Lanco', 'Los Lagos', 'Máfil', 
    'Mariquina', 'Paillaco', 'Panguipulli', 'Río Bueno', 'Valdivia'
  ].sort(),
  loslagos: [
    'Ancud', 'Calbuco', 'Castro', 'Chaitén', 'Chonchi', 'Cochamó', 'Curaco de Vélez', 
    'Dalcahue', 'Fresia', 'Frutillar', 'Futaleufú', 'Hualaihué', 'Llanquihue', 'Los Muermos', 
    'Maullín', 'Osorno', 'Palena', 'Puerto Montt', 'Puerto Octay', 'Puerto Varas', 
    'Puqueldón', 'Purranque', 'Puyehue', 'Queilén', 'Quellón', 'Quemchi', 'Quinchao', 
    'Río Negro', 'San Juan de la Costa', 'San Pablo'
  ].sort(),
  aysen: [
    'Aysén', 'Chile Chico', 'Cisnes', 'Cochrane', 'Coyhaique', "O'Higgins", 
    'Río Ibáñez', 'Tortel'
  ].sort(),
  magallanes: [
    'Antártica', 'Cabo de Hornos', 'Laguna Blanca', 'Natales', 'Porvenir', 'Primavera', 
    'Punta Arenas', 'Río Verde', 'San Gregorio', 'Timaukel', 'Torres del Paine'
  ].sort()
}

const regiones = [
  { value: 'arica', label: 'Región de Arica y Parinacota (XV)' },
  { value: 'tarapaca', label: 'Región de Tarapacá (I)' },
  { value: 'antofagasta', label: 'Región de Antofagasta (II)' },
  { value: 'atacama', label: 'Región de Atacama (III)' },
  { value: 'coquimbo', label: 'Región de Coquimbo (IV)' },
  { value: 'valparaiso', label: 'Región de Valparaíso (V)' },
  { value: 'metropolitana', label: 'Región Metropolitana (RM)' },
  { value: 'ohiggins', label: "Región de O'Higgins (VI)" },
  { value: 'maule', label: 'Región del Maule (VII)' },
  { value: 'nuble', label: 'Región de Ñuble (XVI)' },
  { value: 'biobio', label: 'Región del Biobío (VIII)' },
  { value: 'araucania', label: 'Región de La Araucanía (IX)' },
  { value: 'losrios', label: 'Región de Los Ríos (XIV)' },
  { value: 'loslagos', label: 'Región de Los Lagos (X)' },
  { value: 'aysen', label: 'Región de Aysén (XI)' },
  { value: 'magallanes', label: 'Región de Magallanes y La Antártica Chilena (XII)' },
]

export default function AddressStep({ onNext, onPrevious }: AddressStepProps) {
  const { origin, destination, setOriginAddress, setDestinationAddress } = useQuoteStore()
  
  const [originData, setOriginData] = useState({
    street: origin.address?.street || '',
    number: origin.address?.number || '',
    commune: origin.address?.commune || '',
    region: origin.address?.region || 'metropolitana',
    additionalInfo: origin.address?.additionalInfo || '',
  })

  const [destinationData, setDestinationData] = useState({
    street: destination.address?.street || '',
    number: destination.address?.number || '',
    commune: destination.address?.commune || '',
    region: destination.address?.region || 'metropolitana',
    additionalInfo: destination.address?.additionalInfo || '',
  })


  const handleSubmit = () => {
    // Validaciones
    if (!originData.street || !originData.number || !originData.commune) {
      toast.error('Por favor completa todos los campos de origen')
      return
    }

    if (!destinationData.street || !destinationData.number || !destinationData.commune) {
      toast.error('Por favor completa todos los campos de destino')
      return
    }

    setOriginAddress(originData)
    setDestinationAddress(destinationData)
    toast.success('Direcciones guardadas correctamente')
    onNext()
  }

  return (
    <div className="max-w-5xl mx-auto animate-slide-up">
      <div className="mb-6 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Direcciones</h2>
        <p className="text-gray-600">
          Ingresa las direcciones de origen y destino de tu mudanza
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ORIGEN */}
        <Card variant="elevated">
          <div className="flex items-center gap-2 mb-4 pb-4 border-b">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary-600" />
            </div>
            <h3 className="text-xl font-bold">Dirección de Origen</h3>
          </div>

          <div className="space-y-4">
            {/* Autocomplete de dirección */}
            <div className="bg-gradient-to-r from-primary-50 to-brand-blue-light p-3 rounded-lg border border-primary-200 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary-600" />
                <span className="text-sm font-medium text-primary-900">
                  Búsqueda Inteligente
                </span>
              </div>
              <AddressAutocomplete
                placeholder="Busca tu dirección aquí..."
                onSelect={(addressData) => {
                  setOriginData({
                    ...originData,
                    street: addressData.street,
                    number: addressData.number,
                    commune: addressData.commune,
                    region: addressData.region,
                  })
                  toast.success('¡Dirección autocompletada!')
                }}
              />
              <p className="text-xs text-primary-700 mt-2">
                Escribe y selecciona de la lista para autocompletar todos los campos
              </p>
            </div>

            <Input
              label="Calle"
              placeholder="Av. Libertador Bernardo O'Higgins"
              value={originData.street}
              onChange={(e) => setOriginData({ ...originData, street: e.target.value })}
              required
            />

            <Input
              label="Número"
              placeholder="1234"
              value={originData.number}
              onChange={(e) => setOriginData({ ...originData, number: e.target.value })}
              required
            />

            <Select
              label="Región"
              options={regiones}
              value={originData.region}
              onChange={(e) => {
                const newRegion = e.target.value
                // Limpiar la comuna si no pertenece a la nueva región
                const comunasNuevaRegion = comunasPorRegion[newRegion] || []
                const nuevaComuna = comunasNuevaRegion.includes(originData.commune) 
                  ? originData.commune 
                  : ''
                setOriginData({ ...originData, region: newRegion, commune: nuevaComuna })
              }}
              required
            />

            <Select
              label="Comuna"
              options={(comunasPorRegion[originData.region] || []).map(c => ({ value: c, label: c }))}
              value={originData.commune}
              onChange={(e) => setOriginData({ ...originData, commune: e.target.value })}
              required
            />

            <Input
              label="Información Adicional (Opcional)"
              placeholder="Depto 301, Torre B"
              value={originData.additionalInfo}
              onChange={(e) => setOriginData({ ...originData, additionalInfo: e.target.value })}
            />
          </div>
        </Card>

        {/* DESTINO */}
        <Card variant="elevated">
          <div className="flex items-center gap-2 mb-4 pb-4 border-b">
            <div className="w-10 h-10 bg-secondary-100 rounded-full flex items-center justify-center">
              <Navigation className="w-5 h-5 text-secondary-600" />
            </div>
            <h3 className="text-xl font-bold">Dirección de Destino</h3>
          </div>

          <div className="space-y-4">
            {/* Autocomplete de dirección */}
            <div className="bg-gradient-to-r from-secondary-50 to-secondary-100 p-3 rounded-lg border border-secondary-200 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-secondary-600" />
                <span className="text-sm font-medium text-secondary-900">
                  Búsqueda Inteligente
                </span>
              </div>
              <AddressAutocomplete
                placeholder="Busca tu dirección aquí..."
                onSelect={(addressData) => {
                  setDestinationData({
                    ...destinationData,
                    street: addressData.street,
                    number: addressData.number,
                    commune: addressData.commune,
                    region: addressData.region,
                  })
                  toast.success('¡Dirección autocompletada!')
                }}
              />
              <p className="text-xs text-secondary-700 mt-2">
                Escribe y selecciona de la lista para autocompletar todos los campos
              </p>
            </div>

            <Input
              label="Calle"
              placeholder="Av. Apoquindo"
              value={destinationData.street}
              onChange={(e) => setDestinationData({ ...destinationData, street: e.target.value })}
              required
            />

            <Input
              label="Número"
              placeholder="5678"
              value={destinationData.number}
              onChange={(e) => setDestinationData({ ...destinationData, number: e.target.value })}
              required
            />

            <Select
              label="Región"
              options={regiones}
              value={destinationData.region}
              onChange={(e) => {
                const newRegion = e.target.value
                // Limpiar la comuna si no pertenece a la nueva región
                const comunasNuevaRegion = comunasPorRegion[newRegion] || []
                const nuevaComuna = comunasNuevaRegion.includes(destinationData.commune) 
                  ? destinationData.commune 
                  : ''
                setDestinationData({ ...destinationData, region: newRegion, commune: nuevaComuna })
              }}
              required
            />

            <Select
              label="Comuna"
              options={(comunasPorRegion[destinationData.region] || []).map(c => ({ value: c, label: c }))}
              value={destinationData.commune}
              onChange={(e) => setDestinationData({ ...destinationData, commune: e.target.value })}
              required
            />

            <Input
              label="Información Adicional (Opcional)"
              placeholder="Casa con reja azul"
              value={destinationData.additionalInfo}
              onChange={(e) =>
                setDestinationData({ ...destinationData, additionalInfo: e.target.value })
              }
            />
          </div>
        </Card>
      </div>

      {/* Info */}
      <Card className="mt-6 bg-primary-50 border-primary-200">
        <p className="text-sm text-primary-800">
          <strong>💡 Tip:</strong> Asegúrate de incluir toda la información relevante (número de 
          departamento, torre, etc.) para facilitar el acceso el día de la mudanza.
        </p>
      </Card>

      {/* Botones */}
      <div className="flex gap-4 mt-6">
        <Button type="button" onClick={onPrevious} variant="outline" className="flex-1">
          ← Volver
        </Button>
        <Button onClick={handleSubmit} variant="brand" className="flex-1">
          Continuar →
        </Button>
      </div>
    </div>
  )
}

