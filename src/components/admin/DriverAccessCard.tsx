'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Link2, Copy, RefreshCw, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function DriverAccessCard() {
  const [token, setToken] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
    fetchToken()
  }, [])

  const fetchToken = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/driver-link')
      if (res.ok) {
        const data = await res.json()
        setToken(data.token || null)
        setPin(data.pin || '')
      }
    } catch (error) {
      console.error('Error fetching driver link:', error)
    } finally {
      setLoading(false)
    }
  }

  const generate = async (first: boolean) => {
    setWorking(true)
    try {
      const res = await fetch('/api/admin/driver-link', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'error')
      setToken(data.token)
      toast.success(first ? 'Link generado' : 'Link regenerado — el anterior dejó de funcionar')
    } catch (error) {
      console.error('Error generating driver link:', error)
      toast.error(error instanceof Error ? error.message : 'No se pudo generar el link')
    } finally {
      setWorking(false)
    }
  }

  const link = token && origin ? `${origin}/trabajos/${token}` : ''
  const waHref = link
    ? `https://wa.me/?text=${encodeURIComponent(
        `Trabajos del día · Yo Me Encargo:\n${link}\n\nPIN de acceso: ${pin}`
      )}`
    : ''

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link copiado')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-full bg-secondary-50">
          <Link2 className="w-5 h-5 text-secondary-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Acceso Choferes</h3>
          <p className="text-sm text-gray-600">
            Link de solo lectura con los trabajos de los próximos 4 días (sin precios). Pide un
            PIN de acceso (<strong>{pin}</strong>). Compartilo con los choferes por
            WhatsApp.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : token ? (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
              className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
            />
            <div className="flex gap-2">
              <Button onClick={copy} variant="outline" size="sm">
                <Copy className="w-4 h-4 mr-2" />
                Copiar
              </Button>
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-50">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  WhatsApp
                </Button>
              </a>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Cualquiera con el link ve nombres y direcciones. Si se filtra, regeneralo.
            </p>
            <Button onClick={() => generate(false)} variant="outline" size="sm" disabled={working}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerar
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => generate(true)} disabled={working}>
          <Link2 className="w-4 h-4 mr-2" />
          Generar link de choferes
        </Button>
      )}
    </Card>
  )
}
