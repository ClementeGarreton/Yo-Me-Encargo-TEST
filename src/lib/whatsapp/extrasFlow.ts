/**
 * Preguntas de servicios adicionales para WhatsApp.
 * Cada mensaje responde UNA decisión; el avance se guarda dentro del JSON
 * de quote_sessions.state, sin agregar tablas, columnas ni migraciones.
 * No usa OpenAI: evita que un «sí» marque varios servicios a la vez.
 */
export type ExtrasStep = 'packing' | 'disassembly' | 'assembly' | 'done'

export type ExtrasFields = {
  disassembly: boolean
  assembly: boolean
  packing: boolean
  unpacking: boolean
  observations: string
  extrasStep?: ExtrasStep
}

const QUESTIONS: Record<Exclude<ExtrasStep, 'done'>, string> = {
  packing: '6/7 · Servicios adicionales (1/3)\n¿Necesitas que embalemos tus pertenencias? Responde *SÍ* o *NO*.',
  disassembly: '6/7 · Servicios adicionales (2/3)\n¿Necesitas desarmar algún mueble antes de trasladarlo? Responde *SÍ* o *NO*.',
  assembly: '6/7 · Servicios adicionales (3/3)\n¿Necesitas que armemos algún mueble al llegar? Responde *SÍ* o *NO*.',
}

export function getExtrasStep(services: ExtrasFields): ExtrasStep {
  // Estados ya terminados, incluidas sesiones antiguas, no retroceden.
  if (services.observations !== '__pending__') return 'done'
  if (services.extrasStep === 'disassembly' || services.extrasStep === 'assembly') return services.extrasStep
  return 'packing'
}

export function extrasQuestion(services: ExtrasFields): string {
  const step = getExtrasStep(services)
  return step === 'done' ? '' : QUESTIONS[step]
}

function parseBinaryResponse(input: string): boolean | null {
  const normalized = input.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (/^(si|sip|sipi|claro|por supuesto|afirmativo|correcto|dale)([.!\s,]|$)/.test(normalized)) return true
  if (/^(no|nop|ninguno|ninguna|para nada)([.!\s,]|$)/.test(normalized)) return false
  return null
}

/** Devuelve null si la respuesta es ambigua, sin avanzar ni perder datos. */
export function answerExtras<T extends ExtrasFields>(services: T, input: string): T | null {
  const step = getExtrasStep(services)
  if (step === 'done') return null
  const answer = parseBinaryResponse(input)
  if (answer === null) return null

  const next: T = { ...services }
  // Compatibilidad con el comando original: NINGUNO significa que no desea
  // NINGÚN servicio restante; los ya elegidos se conservan.
  const normalized = input.trim().toLowerCase()
  if (/^(ninguno|ninguna)([!.\s,]|$)/.test(normalized)) {
    if (step === 'packing') next.packing = false
    if (step !== 'assembly') next.disassembly = false
    next.assembly = false
    next.extrasStep = 'done'
    next.observations = ''
    return next
  }
  if (step === 'packing') {
    next.packing = answer
    next.extrasStep = 'disassembly'
  } else if (step === 'disassembly') {
    next.disassembly = answer
    next.extrasStep = 'assembly'
  } else {
    next.assembly = answer
    next.extrasStep = 'done'
    // Sólo al responder las tres preguntas termina la sección de servicios.
    next.observations = ''
  }
  return next
}
