'use client'

import { useEffect } from 'react'
import { captureAttribution } from '@/lib/attribution'

/**
 * Captura el gclid/UTMs de la URL una vez al montar la app (corre en todas las
 * paginas porque se monta en el root layout). No renderiza nada.
 */
export default function AttributionCapture() {
  useEffect(() => {
    captureAttribution()
  }, [])

  return null
}
