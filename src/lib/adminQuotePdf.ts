import jsPDF from 'jspdf'
import { formatCurrency, formatDistanceKm, formatParkingDistance } from './utils'

/**
 * Generador de PDF para el panel admin, alimentado por DATOS (no por el store).
 * Sirve para reservas y prospectos. El flag `includePrices` produce dos versiones:
 *
 *  - includePrices = true  -> "Cotización" (cliente): incluye precios, datos de
 *    facturación y el bloque de precio final.
 *  - includePrices = false -> "Orden de Trabajo" (trabajadores): MISMO contenido
 *    operativo (qué mover, direcciones, fecha, servicios) pero SIN precios ni
 *    facturación, para entregar a los trabajadores sin exponer la facturación.
 */
export interface AdminQuoteData {
  name: string
  email?: string | null
  phone?: string | null
  isCompany?: boolean
  companyName?: string | null
  companyRut?: string | null
  originAddress?: string | null
  destinationAddress?: string | null
  originFloor?: number | null
  originHasElevator?: boolean | null
  originParkingDistance?: number | null
  destinationFloor?: number | null
  destinationHasElevator?: boolean | null
  destinationParkingDistance?: number | null
  scheduledDate?: string | null
  scheduledTime?: string | null
  totalPrice?: number | null
  isFlexible?: boolean
  recommendedVehicle?: string | null
  totalVolume?: number | null
  totalWeight?: number | null
  totalDistance?: number | null
  items?: Array<{ name: string; quantity: number; volume: number; packaging?: { type: string } }> | null
  additionalServices?: Record<string, any> | null
}

export interface AdminQuotePdfOptions {
  /** true = con precios (cliente); false = sin precios (trabajadores). */
  includePrices: boolean
  /** Si es false, devuelve solo el blob sin descargar. Por defecto true. */
  download?: boolean
}

const PRIMARY: [number, number, number] = [111, 168, 220] // #6FA8DC
const SECONDARY: [number, number, number] = [140, 198, 63] // #8CC63F
const TEXT: [number, number, number] = [0, 0, 0]
const LIGHT: [number, number, number] = [225, 240, 250] // #E1F0FA
const GRAY: [number, number, number] = [128, 128, 128]

function formatDateCL(dateStr?: string | null): string {
  if (!dateStr) return 'No especificada'
  // Acepta "YYYY-MM-DD"; evita el corrimiento de zona horaria usando partes.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
  }
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('es-CL')
}

/** Texto de piso/ascensor para una dirección. null si no hay piso relevante (planta baja o sin dato). */
function floorInfo(floor?: number | null, hasElevator?: boolean | null): string | null {
  if (typeof floor !== 'number' || floor <= 0) return null
  if (hasElevator === false) return `Piso ${floor} - SIN ascensor (hay que subir por escaleras)`
  if (hasElevator === true) return `Piso ${floor} - con ascensor`
  return `Piso ${floor}`
}

export async function generateAdminQuotePDF(
  data: AdminQuoteData,
  options: AdminQuotePdfOptions
): Promise<{ blob: Blob; fileName: string } | undefined> {
  if (typeof window === 'undefined') {
    console.error('generateAdminQuotePDF debe ejecutarse solo en el cliente')
    return
  }

  const withPrices = options.includePrices
  const shouldDownload = options.download !== false

  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  let y = 20

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 25) {
      pdf.addPage()
      y = 20
    }
  }

  // ── Header ──
  pdf.setFillColor(...PRIMARY)
  pdf.rect(0, 0, pageWidth, 40, 'F')

  try {
    const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = '/logo.png'
    })
    const logoHeight = 26
    const logoWidth = (logoImg.width / logoImg.height) * logoHeight
    pdf.addImage(logoImg, 'PNG', 14, 7, logoWidth, logoHeight)
  } catch {
    /* sin logo si no carga */
  }

  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(22)
  pdf.setFont('helvetica', 'bold')
  pdf.text(withPrices ? 'COTIZACION DE MUDANZA' : 'ORDEN DE TRABAJO', pageWidth / 2, 16, { align: 'center' })
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Yo Me Encargo - Servicios de Mudanza', pageWidth / 2, 25, { align: 'center' })
  pdf.text(`Emision: ${new Date().toLocaleDateString('es-CL')}`, pageWidth / 2, 32, { align: 'center' })

  // Banda distintiva para la versión de trabajadores
  if (!withPrices) {
    pdf.setFillColor(...SECONDARY)
    pdf.rect(0, 40, pageWidth, 9, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.text('DOCUMENTO OPERATIVO - SIN INFORMACION DE PRECIOS', pageWidth / 2, 46, { align: 'center' })
    y = 58
  } else {
    y = 50
  }

  // ── Información del cliente ──
  pdf.setTextColor(...TEXT)
  pdf.setFontSize(15)
  pdf.setFont('helvetica', 'bold')
  pdf.text('INFORMACION DEL CLIENTE', 20, y)
  y += 9
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Nombre: ${data.name || 'No especificado'}`, 20, y); y += 6
  if (data.phone) { pdf.text(`Telefono: ${data.phone}`, 20, y); y += 6 }
  // El email y la facturación solo en la versión con precios (cliente)
  if (withPrices) {
    if (data.email) { pdf.text(`Email: ${data.email}`, 20, y); y += 6 }
    if (data.isCompany && data.companyName) {
      y += 3
      pdf.setFillColor(219, 234, 254)
      pdf.setDrawColor(220, 38, 38)
      pdf.setLineWidth(1.2)
      pdf.rect(20, y - 3, pageWidth - 40, 26, 'FD')
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(...PRIMARY)
      pdf.text('CON FACTURA', 25, y + 3)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(...TEXT)
      y += 9
      pdf.text(`Razon Social: ${data.companyName}`, 25, y); y += 6
      pdf.text(`RUT: ${data.companyRut || 'No especificado'}`, 25, y); y += 7
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(220, 38, 38)
      pdf.setFontSize(9)
      pdf.text('ESTE DOCUMENTO NO ES VALIDO COMO FACTURA', pageWidth / 2, y, { align: 'center' })
      pdf.setTextColor(...TEXT)
      pdf.setFontSize(11)
      y += 8
    }
  }
  y += 6

  // ── Detalles de la mudanza ──
  ensureSpace(30)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(15)
  pdf.text('DETALLES DE LA MUDANZA', 20, y)
  y += 9
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Fecha: ${formatDateCL(data.scheduledDate)}`, 20, y); y += 6
  pdf.text(`Hora: ${data.scheduledTime || 'No especificada'}`, 20, y); y += 6
  if (data.isFlexible && withPrices) {
    pdf.setTextColor(...SECONDARY)
    pdf.text('[OK] Con descuento por flexibilidad (10%)', 20, y)
    pdf.setTextColor(...TEXT)
    y += 6
  }
  y += 4

  // ── Direcciones ──
  ensureSpace(24)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.text('DIRECCIONES', 20, y)
  y += 8
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  const originLines = pdf.splitTextToSize(`Origen: ${data.originAddress || 'No especificada'}`, pageWidth - 40)
  originLines.forEach((l: string) => { ensureSpace(6); pdf.text(l, 20, y); y += 6 })
  const originFloorTxt = floorInfo(data.originFloor, data.originHasElevator)
  if (originFloorTxt) {
    ensureSpace(6)
    if (data.originHasElevator === false) { pdf.setFont('helvetica', 'bold'); pdf.setTextColor(220, 38, 38) }
    pdf.text(`  ${originFloorTxt}`, 20, y); y += 6
    if (data.originHasElevator === false) { pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...TEXT) }
  }
  const originParkingTxt = formatParkingDistance(data.originParkingDistance)
  if (originParkingTxt) {
    ensureSpace(6)
    pdf.text(`  Acarreo estacionamiento a puerta: ${originParkingTxt}`, 20, y); y += 6
  }
  const destLines = pdf.splitTextToSize(`Destino: ${data.destinationAddress || 'No especificada'}`, pageWidth - 40)
  destLines.forEach((l: string) => { ensureSpace(6); pdf.text(l, 20, y); y += 6 })
  const destFloorTxt = floorInfo(data.destinationFloor, data.destinationHasElevator)
  if (destFloorTxt) {
    ensureSpace(6)
    if (data.destinationHasElevator === false) { pdf.setFont('helvetica', 'bold'); pdf.setTextColor(220, 38, 38) }
    pdf.text(`  ${destFloorTxt}`, 20, y); y += 6
    if (data.destinationHasElevator === false) { pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...TEXT) }
  }
  const destParkingTxt = formatParkingDistance(data.destinationParkingDistance)
  if (destParkingTxt) {
    ensureSpace(6)
    pdf.text(`  Acarreo estacionamiento a puerta: ${destParkingTxt}`, 20, y); y += 6
  }
  if (typeof data.totalDistance === 'number' && data.totalDistance > 0) {
    pdf.text(`Distancia puerta a puerta: ${formatDistanceKm(data.totalDistance)}`, 20, y); y += 6
  }
  y += 4

  // ── Items a transportar ──
  const items = Array.isArray(data.items) ? data.items : []
  ensureSpace(20)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(15)
  pdf.text('ITEMS A TRANSPORTAR', 20, y)
  y += 9
  pdf.setFontSize(11)
  if (items.length > 0) {
    const col1 = 20, col2 = 130, col3 = 165
    pdf.setFont('helvetica', 'bold')
    pdf.text('Item', col1, y)
    pdf.text('Cant.', col2, y)
    pdf.text('Volumen', col3, y)
    y += 6
    pdf.setDrawColor(200, 200, 200)
    pdf.line(col1, y - 2, pageWidth - 20, y - 2)
    pdf.setFont('helvetica', 'normal')
    items.forEach((item) => {
      ensureSpace(6)
      const nameLines = pdf.splitTextToSize(item.name, col2 - col1 - 4)
      pdf.text(nameLines[0], col1, y)
      pdf.text(`x${item.quantity}`, col2, y)
      pdf.text(`${(item.volume * item.quantity).toFixed(2)} m3`, col3, y)
      y += 6
      if (item.packaging?.type) {
        ensureSpace(5)
        pdf.setFontSize(9)
        pdf.setTextColor(...PRIMARY)
        pdf.text(`  Embalaje: ${item.packaging.type}`, col1, y)
        pdf.setTextColor(...TEXT)
        pdf.setFontSize(11)
        y += 5
      }
    })
  } else {
    pdf.setFont('helvetica', 'italic')
    pdf.setTextColor(...GRAY)
    pdf.text('Detalle de items no disponible para esta reserva.', 20, y)
    pdf.setTextColor(...TEXT)
    pdf.setFont('helvetica', 'normal')
    y += 6
  }
  y += 6

  // ── Resumen volumen / vehículo ──
  ensureSpace(20)
  pdf.setFont('helvetica', 'bold')
  if (typeof data.totalVolume === 'number') { pdf.text(`Volumen Total: ${data.totalVolume.toFixed(2)} m3`, 20, y); y += 6 }
  if (typeof data.totalWeight === 'number' && data.totalWeight > 0) { pdf.text(`Peso Total: ${data.totalWeight} kg`, 20, y); y += 6 }
  if (data.recommendedVehicle) { pdf.text(`Vehiculo: ${data.recommendedVehicle}`, 20, y); y += 6 }
  y += 6

  // ── Servicios adicionales (operativos: útiles para trabajadores) ──
  const svc = data.additionalServices || {}
  const hasSvc = svc.disassembly || svc.assembly || svc.packing || svc.unpacking
  if (hasSvc) {
    ensureSpace(24)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    pdf.text('SERVICIOS ADICIONALES', 20, y)
    y += 8
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'normal')
    if (svc.disassembly) { ensureSpace(6); pdf.text('[OK] Desarme de muebles', 20, y); y += 6 }
    if (svc.assembly) { ensureSpace(6); pdf.text('[OK] Armado de muebles', 20, y); y += 6 }
    if (svc.packing) { ensureSpace(6); pdf.text('[OK] Embalaje / armado de cajas', 20, y); y += 6 }
    if (svc.unpacking) { ensureSpace(6); pdf.text('[OK] Desembalaje', 20, y); y += 6 }
    y += 4
  }

  // ── Observaciones ──
  if (svc.observations) {
    ensureSpace(18)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text('OBSERVACIONES:', 20, y)
    y += 7
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    pdf.splitTextToSize(String(svc.observations), pageWidth - 40).forEach((line: string) => {
      ensureSpace(6); pdf.text(line, 20, y); y += 6
    })
    y += 4
  }

  // ── Precio final (solo versión con precios) ──
  if (withPrices && typeof data.totalPrice === 'number' && data.totalPrice > 0) {
    ensureSpace(30)
    pdf.setFillColor(...LIGHT)
    pdf.rect(20, y, pageWidth - 40, 25, 'F')
    pdf.setTextColor(...PRIMARY)
    pdf.setFontSize(18)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PRECIO ESTIMADO', pageWidth / 2, y + 9, { align: 'center' })
    pdf.setFontSize(26)
    pdf.text(formatCurrency(data.totalPrice), pageWidth / 2, y + 19, { align: 'center' })
    pdf.setTextColor(...TEXT)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.text('IVA incluido', pageWidth / 2, y + 24, { align: 'center' })
    y += 30
  }

  // ── Footer ──
  const footerY = pageHeight - 14
  pdf.setFontSize(8)
  pdf.setTextColor(...GRAY)
  if (!withPrices) {
    pdf.text('Documento interno para coordinacion del equipo de trabajo.', pageWidth / 2, footerY - 5, { align: 'center' })
  } else {
    pdf.text('Cotizacion valida por 7 dias desde la emision.', pageWidth / 2, footerY - 5, { align: 'center' })
  }
  pdf.text('www.yomeencargo.cl | +56 9 5439 0267', pageWidth / 2, footerY, { align: 'center' })

  const safeName = (data.name || 'Cliente').replace(/\s+/g, '_').replace(/[^\w-]/g, '')
  const prefix = withPrices ? 'Cotizacion' : 'OrdenTrabajo'
  const fileName = `${prefix}_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`

  if (shouldDownload) pdf.save(fileName)
  return { blob: pdf.output('blob'), fileName }
}
