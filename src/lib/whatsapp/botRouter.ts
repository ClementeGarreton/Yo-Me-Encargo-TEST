/**
 * Enrutador determinista: jamás llama a OpenAI ni interpreta texto libre.
 * Una sesión antigua de quote_sessions NO autoriza la ejecución del bot.
 */
export const QUOTE_IDLE_TIMEOUT_MS = 5 * 60 * 1000
export const QUOTE_MAX_DURATION_MS = 15 * 60 * 1000

export type BotMode = 'idle' | 'quoting' | 'human'

export interface WhatsAppBotState {
  phone: string
  mode: BotMode
  greeted_at: string | null
  quote_session_id: string | null
  activated_at: string | null
  last_activity_at: string | null
  updated_at: string
}

export type BotCommand = 'COTIZAR' | 'ASESOR' | 'MENU' | 'SALIR' | null
export type BotDecision =
  | 'start_quote'
  | 'human'
  | 'menu'
  | 'exit'
  | 'welcome'
  | 'quote_message'
  | 'expire_silent'
  | 'silent'

export const WHATSAPP_WELCOME = [
  '¡Bienvenido a *Yo Me Encargo*! 👋',
  '',
  'Elige una opción escribiendo una de estas palabras:',
  '*COTIZAR* — Iniciar una cotización automática.',
  '*ASESOR* — Hablar con una persona (sin IA).',
  '*MENU* — Volver a ver estas opciones.',
  '*SALIR* — Finalizar la atención automática.',
].join('\n')

export function botCommand(text: string): BotCommand {
  // Solo la palabra aislada; "quiero cotizar" NO inicia OpenAI.
  const value = text.trim().toLocaleUpperCase('es')
  if (value === 'COTIZAR') return 'COTIZAR'
  if (value === 'ASESOR' || value === 'EJECUTIVO') return 'ASESOR'
  if (value === 'MENU' || value === 'MENÚ') return 'MENU'
  if (value === 'SALIR') return 'SALIR'
  return null
}

export function isQuoteExpired(state: WhatsAppBotState, now = Date.now()): boolean {
  if (state.mode !== 'quoting') return false
  const started = state.activated_at ? Date.parse(state.activated_at) : NaN
  const last = state.last_activity_at ? Date.parse(state.last_activity_at) : NaN
  // Fail closed: no se permite OpenAI con fechas ausentes o corruptas.
  return !Number.isFinite(started)
    || !Number.isFinite(last)
    || now - last >= QUOTE_IDLE_TIMEOUT_MS
    || now - started >= QUOTE_MAX_DURATION_MS
}

export function decideBotAction(text: string, state: WhatsAppBotState | null, now = Date.now()): BotDecision {
  const command = botCommand(text)
  if (command === 'SALIR') return 'exit'
  if (command === 'ASESOR') return 'human'
  if (command === 'MENU') return 'menu'
  if (command === 'COTIZAR') return 'start_quote'
  if (state?.mode === 'quoting') {
    return isQuoteExpired(state, now) ? 'expire_silent' : 'quote_message'
  }
  return !state?.greeted_at ? 'welcome' : 'silent'
}
