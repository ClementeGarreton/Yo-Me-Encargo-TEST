'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, ChevronDown, FileText, HardHat } from 'lucide-react'
import { generateAdminQuotePDF, type AdminQuoteData } from '@/lib/adminQuotePdf'

interface PdfDownloadMenuProps {
  data: AdminQuoteData
  /** Estilo compacto (solo ícono) para filas de tabla. */
  compact?: boolean
  className?: string
}

export default function PdfDownloadMenu({ data, compact, className }: PdfDownloadMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleWithPrices = async () => {
    setOpen(false)
    setBusy(true)
    try {
      await generateAdminQuotePDF(data, { includePrices: true })
    } finally {
      setBusy(false)
    }
  }

  const handleWithoutPrices = async () => {
    setOpen(false)
    setBusy(true)
    try {
      await generateAdminQuotePDF(data, { includePrices: false })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={ref} className={`relative inline-block ${className || ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        title="Descargar PDF"
        className={
          compact
            ? 'inline-flex items-center gap-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 px-2 py-1.5 text-sm font-medium transition-colors disabled:opacity-50'
            : 'inline-flex items-center gap-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50'
        }
      >
        <Download className="w-4 h-4" />
        {!compact && <span>{busy ? 'Generando…' : 'Descargar PDF'}</span>}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
          <button
            type="button"
            onClick={handleWithPrices}
            className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
          >
            <FileText className="w-4 h-4 mt-0.5 text-primary-600 flex-shrink-0" />
            <span>
              <span className="block text-sm font-semibold text-gray-900">Con precios</span>
              <span className="block text-xs text-gray-500">Cotización completa para el cliente</span>
            </span>
          </button>
          <div className="border-t border-gray-100" />
          <button
            type="button"
            onClick={handleWithoutPrices}
            className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
          >
            <HardHat className="w-4 h-4 mt-0.5 text-secondary-600 flex-shrink-0" />
            <span>
              <span className="block text-sm font-semibold text-gray-900">Sin precios (trabajadores)</span>
              <span className="block text-xs text-gray-500">Orden de trabajo, sin facturación</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
