'use client'

import { useState, useEffect } from 'react'
import { useQuoteStore } from '@/store/quoteStore'
import { getAdditionalServices, AdditionalService } from '@/lib/additionalServicesService'
import Button from '../ui/Button'
import Checkbox from '../ui/Checkbox'
import Card from '../ui/Card'
import { Wrench, Package, Camera, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

interface AdditionalServicesStepProps {
  onNext: () => void
  onPrevious: () => void
}

export default function AdditionalServicesStep({ onNext, onPrevious }: AdditionalServicesStepProps) {
  const { additionalServices, setAdditionalServices, calculateTotals } = useQuoteStore()

  const [services, setServices] = useState<AdditionalService[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false)
  const [formData, setFormData] = useState({
    disassembly: additionalServices.disassembly,
    assembly: additionalServices.assembly,
    packing: additionalServices.packing,
    unpacking: additionalServices.unpacking,
    observations: additionalServices.observations,
    photos: additionalServices.photos,
  })

  // Cargar servicios adicionales dinámicamente
  useEffect(() => {
    const loadAdditionalServices = async () => {
      try {
        setLoadingServices(true)
        const servicesData = await getAdditionalServices()
        setServices(servicesData)
      } catch (error) {
        console.error('Error loading additional services:', error)
        toast.error('Error al cargar servicios adicionales')
      } finally {
        setLoadingServices(false)
      }
    }
    loadAdditionalServices()
  }, [])

  const handleServiceToggle = (serviceId: string) => {
    setFormData({
      ...formData,
      [serviceId]: !formData[serviceId as keyof typeof formData],
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    try {
      setIsUploadingPhotos(true)
      toast.loading(`Subiendo ${files.length} foto(s)...`, { id: 'upload-photos' })

      // Crear FormData con todas las fotos
      const uploadFormData = new FormData()
      Array.from(files).forEach(file => {
        uploadFormData.append('photos', file)
      })

      // Subir a Supabase Storage
      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        body: uploadFormData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Error al subir las fotos')
      }

      const { urls } = await response.json()

      // Guardar las URLs (no los nombres de archivo)
      setFormData({
        ...formData,
        photos: [...formData.photos, ...urls],
      })

      toast.success(`${files.length} foto(s) subida(s) exitosamente`, { id: 'upload-photos' })
    } catch (error) {
      console.error('Error uploading photos:', error)
      toast.error(error instanceof Error ? error.message : 'Error al subir las fotos', { id: 'upload-photos' })
    } finally {
      setIsUploadingPhotos(false)
      // Limpiar el input para permitir subir las mismas fotos de nuevo si es necesario
      e.target.value = ''
    }
  }

  const removePhoto = (index: number) => {
    const newPhotos = formData.photos.filter((_, i) => i !== index)
    setFormData({ ...formData, photos: newPhotos })
  }

  const handleSubmit = () => {
    setAdditionalServices(formData)
    calculateTotals()
    toast.success('Servicios adicionales guardados')
    onNext()
  }

  const totalServicesPrice = services.reduce((sum, service) => {
    const key = service.id as keyof typeof formData
    // No incluir servicios que requieren contacto con ejecutivo en el total
    if (service.requiresContact) return sum
    return sum + (formData[key] ? service.price : 0)
  }, 0)

  return (
    <div className="max-w-4xl mx-auto animate-slide-up">
      <div className="mb-6 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Servicios Adicionales</h2>
        <p className="text-gray-600">
          Selecciona los servicios extras que necesites para tu mudanza
        </p>
      </div>

      <Card variant="elevated">
        {/* Servicios */}
        {loadingServices ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando servicios...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {services.map((service) => {
              const Icon = service.icon
              const isSelected = formData[service.id as keyof typeof formData]

              return (
                <div
                  key={service.id}
                  onClick={() => handleServiceToggle(service.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${isSelected
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSelected ? 'bg-primary-600' : 'bg-gray-200'
                      }`}>
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold">{service.name}</h4>
                        {!service.requiresContact && (
                          <span className="text-sm font-bold text-primary-600">
                            ${service.price.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{service.description}</p>
                      {service.requiresContact && service.contactMessage && (
                        <p className="text-xs text-blue-600 mt-1 font-medium">
                          💬 {service.contactMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Total servicios */}
        {totalServicesPrice > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Total Servicios Adicionales:</span>
              <span className="text-xl font-bold text-green-600">
                ${totalServicesPrice.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Observaciones */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FileText className="inline w-4 h-4 mr-1" />
            Observaciones Especiales
          </label>
          <textarea
            placeholder="¿Hay algo que debamos saber? Ej: Calles estrechas, items muy delicados, restricciones de horario, etc."
            value={formData.observations}
            onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Cualquier información adicional que nos ayude a realizar mejor tu mudanza
          </p>
        </div>

        {/* Fotos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Camera className="inline w-4 h-4 mr-1" />
            Fotos de Items (Opcional)
          </label>
          <p className="text-sm text-gray-600 mb-3">
            Sube fotos de items especiales, objetos de valor o situaciones particulares
          </p>

          <label className="block w-full">
            <div className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors ${
              isUploadingPhotos 
                ? 'bg-gray-100 cursor-wait' 
                : 'hover:border-primary-400 hover:bg-primary-50 cursor-pointer'
            }`}>
              <Camera className={`w-12 h-12 mx-auto mb-2 ${isUploadingPhotos ? 'text-gray-300 animate-pulse' : 'text-gray-400'}`} />
              <p className="text-sm font-medium text-gray-700">
                {isUploadingPhotos ? 'Subiendo fotos...' : 'Click para subir fotos'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                JPG, PNG o WEBP (Máx. 5MB cada una)
              </p>
            </div>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isUploadingPhotos}
            />
          </label>

          {/* Lista de fotos */}
          {formData.photos.length > 0 && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
              {formData.photos.map((photoUrl, index) => (
                <div
                  key={index}
                  className="relative group rounded-lg overflow-hidden border-2 border-gray-200 hover:border-primary-400 transition-all"
                >
                  {/* Preview de la imagen */}
                  <div className="aspect-square bg-gray-100">
                    <img
                      src={photoUrl}
                      alt={`Foto ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  
                  {/* Overlay con botón eliminar */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                    <button
                      onClick={() => removePhoto(index)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                  
                  {/* Número de foto */}
                  <div className="absolute top-2 left-2 bg-white bg-opacity-90 px-2 py-1 rounded text-xs font-semibold text-gray-700">
                    #{index + 1}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <p className="text-sm text-blue-800">
            <strong>💡 Tip:</strong> Los servicios de desarme y armado pueden ahorrarte mucho tiempo
            y garantizan que tus muebles lleguen en perfecto estado. El armado de cajas es
            altamente recomendado para objetos frágiles o de valor.
          </p>
          <p className="text-sm text-blue-800 mt-3">
            <strong>📋 Nota:</strong> Los valores indicados corresponden a un servicio estándar.
            En casos de mayor volumen, complejidad o materiales especiales, podría aplicarse un
            ajuste. Te contactaremos previamente si fuera necesario realizar alguna modificación al presupuesto.
          </p>
        </div>
      </Card>

      {/* Botones */}
      <div className="flex gap-4 mt-6">
        <Button type="button" onClick={onPrevious} variant="outline" className="flex-1">
          ← Volver
        </Button>
        <Button onClick={handleSubmit} variant="brand" className="flex-1">
          Ver Resumen →
        </Button>
      </div>
    </div>
  )
}

