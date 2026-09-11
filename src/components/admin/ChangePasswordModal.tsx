'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { KeyRound, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface ChangePasswordModalProps {
  isOpen: boolean
  /** Si es obligatorio (primer ingreso), no se puede cerrar sin cambiarla. */
  required?: boolean
  onClose: () => void
  onChanged: () => void
}

export default function ChangePasswordModal({
  isOpen,
  required = false,
  onClose,
  onChanged,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
  }

  const submit = async () => {
    setError('')

    if (!currentPassword || !newPassword) {
      setError('Completa la contraseña actual y la nueva')
      return
    }
    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('La nueva contraseña y su confirmación no coinciden')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(
          res.status === 429
            ? 'Demasiados intentos. Espera unos minutos.'
            : data?.error || 'No se pudo cambiar la contraseña'
        )
        return
      }

      toast.success('Contraseña actualizada')
      reset()
      onChanged()
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (required) return // obligatorio: no se cierra sin cambiarla
        reset()
        onClose()
      }}
      title="Cambiar contraseña"
    >
      <div className="space-y-4">
        {required && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="text-sm text-amber-900">
              Por seguridad, debes cambiar la contraseña temporal antes de seguir usando el
              panel.
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Contraseña actual
          </label>
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Nueva contraseña
          </label>
          <Input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500">Mínimo 8 caracteres.</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Repetir nueva contraseña
          </label>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          {!required && (
            <Button
              variant="outline"
              onClick={() => {
                reset()
                onClose()
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
          )}
          <Button onClick={submit} disabled={saving}>
            <KeyRound className="mr-2 h-4 w-4" />
            {saving ? 'Guardando…' : 'Cambiar contraseña'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
