import test from 'node:test'
import assert from 'node:assert/strict'
import {
  botCommand,
  decideBotAction,
  isQuoteExpired,
  QUOTE_IDLE_TIMEOUT_MS,
  QUOTE_MAX_DURATION_MS,
} from '../src/lib/whatsapp/botRouter.ts'

const START = Date.parse('2026-10-28T15:00:00.000Z')
function state({ mode = 'quoting', last = START, started = START, greeted = true } = {}) {
  return {
    phone: '+56911112222',
    mode,
    quote_session_id: mode === 'quoting' ? 'test-quote' : null,
    activated_at: started === null ? null : new Date(started).toISOString(),
    last_activity_at: last === null ? null : new Date(last).toISOString(),
    greeted_at: greeted ? new Date(START).toISOString() : null,
    updated_at: new Date(START).toISOString(),
  }
}

test('solo palabra exacta inicia cotización', () => {
  assert.equal(botCommand('COTIZAR'), 'COTIZAR')
  assert.equal(botCommand(' cotizar '), 'COTIZAR')
  assert.equal(botCommand('quiero cotizar'), null)
  assert.equal(botCommand('cotizar ahora'), null)
  assert.equal(decideBotAction('quiero cotizar', state({ mode: 'idle' }), START), 'silent')
})

test('primer mensaje muestra bienvenida sin autorización', () => {
  assert.equal(decideBotAction('hola', null, START), 'welcome')
  assert.equal(decideBotAction('hola', state({ mode: 'idle' }), START), 'silent')
  assert.equal(decideBotAction('foto', state({ mode: 'human' }), START), 'silent')
})

test('los cuatro comandos tienen prioridad sobre el estado anterior', () => {
  const current = state()
  assert.equal(decideBotAction('COTIZAR', null, START), 'start_quote')
  assert.equal(decideBotAction('COTIZAR', current, START + 3600000), 'start_quote')
  assert.equal(decideBotAction('ASESOR', current, START), 'human')
  assert.equal(decideBotAction('EJECUTIVO', current, START), 'human')
  assert.equal(decideBotAction('MENU', current, START), 'menu')
  assert.equal(decideBotAction('MENÚ', current, START), 'menu')
  assert.equal(decideBotAction('SALIR', current, START), 'exit')
})

test('5 minutos de inactividad desactivan OpenAI', () => {
  const current = state()
  assert.equal(decideBotAction('cama', current, START + QUOTE_IDLE_TIMEOUT_MS - 1), 'quote_message')
  assert.equal(decideBotAction('cama', current, START + QUOTE_IDLE_TIMEOUT_MS), 'expire_silent')
})

test('15 minutos de duración máxima desactivan OpenAI aunque siga activo', () => {
  const current = state({ last: START + QUOTE_MAX_DURATION_MS - 2_000 })
  assert.equal(decideBotAction('respuesta', current, START + QUOTE_MAX_DURATION_MS - 1), 'quote_message')
  assert.equal(decideBotAction('respuesta', current, START + QUOTE_MAX_DURATION_MS), 'expire_silent')
})

test('fechas inválidas o ausentes cierran la sesión por seguridad', () => {
  assert.equal(isQuoteExpired(state({ started: null })), true)
  assert.equal(isQuoteExpired(state({ last: null })), true)
})
