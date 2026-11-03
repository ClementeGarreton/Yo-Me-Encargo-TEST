import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { COMMERCIAL_STATUSES, lastStatuses, eventStatus, isCommercialStatus } from '../src/lib/admin/conversationCRM.ts'

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
test('estado comercial nuevo siempre comienza como REVISAR', () => {
  assert.equal(eventStatus(null), 'REVISAR')
  assert.equal(isCommercialStatus('VENDIDO'), true)
  assert.equal(isCommercialStatus('active'), false)
  assert.deepEqual(COMMERCIAL_STATUSES, ['REVISAR','COTIZANDO','NEGOCIACION','RESERVADO','VENDIDO','RECLAMO','CERRADO'])
})
test('auditoria de eventos prevalece sobre estado técnico y mantiene lo más reciente', () => {
  const history = [
    { conversation_id: 'a', structured_payload: { to: 'VENDIDO' } },
    { conversation_id: 'a', structured_payload: { to: 'COTIZANDO' } },
    { conversation_id: 'b', structured_payload: { to: 'RECLAMO' } },
  ]
  assert.deepEqual(lastStatuses(history), { a: 'VENDIDO', b: 'RECLAMO' })
})
test('solo el servidor autorizado cambia estados y conserva autor', () => {
  const route = read('src/app/api/admin/ai-conversations/[id]/commercial/route.ts')
  assert.match(route, /getActorFromRequest\(request\)/)
  assert.match(route, /crm_status_changed/)
  assert.match(route, /actorId: actor\.id/)
  assert.match(route, /logAdminAction/)
})
test('los operadores pueden bloquear la IA sin abrir cotizaciones automáticamente', () => {
  const route = read('src/app/api/admin/ai-conversations/[id]/bot-control/route.ts')
  const motor = read('src/lib/whatsapp/incomingProcessor.ts')
  assert.match(route, /bot_policy_changed/)
  assert.match(route, /setBotMode\(target\.external_user_id, 'idle'\)/)
  assert.match(motor, /isContactBotLocked\(phone\)/)
  assert.match(motor, /if \(locked\)/)
  assert.match(motor, /WHATSAPP_SECRETARY_PHONE_NUMBER_ID/)
})
test('se conservan imágenes fuera de cotización y enlace real de pago', () => {
  const motor = read('src/lib/whatsapp/incomingProcessor.ts')
  assert.match(motor, /archiveHumanImage/)
  assert.match(motor, /saveQuotePhoto\(router\.id, messageId, imageData\)/)
  assert.match(read('src/lib/quoteCheckout.ts'), /https:\/\/yomeencargo\.cl/)
})
