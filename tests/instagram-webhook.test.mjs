import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { splitInstagramText } from '../src/lib/instagram/splitText.ts'
import { extractInstagramMessages, inspectInstagramWebhook } from '../src/lib/instagram/webhookPayload.ts'

const account = '17841447706872387'
const event = (message, overrides = {}) => ({ sender: { id: '123456' }, recipient: { id: account }, message, ...overrides })
const payload = (...messaging) => ({ object: 'instagram', entry: [{ id: account, messaging }] })

test('DM entrante: texto se asigna al canal Instagram sin mezclar cuentas', () => {
  assert.deepEqual(extractInstagramMessages(payload(event({ mid: 'm_001', text: 'COTIZAR' })), account), [{
    id: 'ig:m_001', from: '123456', type: 'text', text: 'COTIZAR', accountId: account,
  }])
})
test('imágenes de Instagram pasan URL al motor fotográfico compartido', () => {
  const out = extractInstagramMessages(payload(event({ mid: 'm_002', attachments: [
    { type: 'image', payload: { url: 'https://scontent.cdninstagram.com/photo.jpg' } },
  ] })), account)
  assert.equal(out[0].type, 'image')
  assert.equal(out[0].imageId, 'https://scontent.cdninstagram.com/photo.jpg')
})
test('prioriza fotografía aunque venga acompañada de texto', () => {
  const out = extractInstagramMessages(payload(event({ mid: 'm_imgtext', text: 'Esta es mi cómoda', attachments: [
    { type: 'image', payload: { url: 'https://scontent.cdninstagram.com/commode.jpg' } },
  ] })), account)
  assert.equal(out[0].type, 'image')
  assert.equal(out[0].text, 'Esta es mi cómoda')
})
test('descarta ecos, mensajes propios y cuentas distintas', () => {
  assert.equal(extractInstagramMessages(payload(event({ mid: 'm_003', text: 'hola', is_echo: true })), account).length, 0)
  assert.equal(extractInstagramMessages(payload(event({ mid: 'm_004', text: 'hola' }, { sender: { id: account } })), account).length, 0)
  assert.equal(extractInstagramMessages(payload(event({ mid: 'm_005', text: 'hola' }, { recipient: { id: 'otro' } })), account).length, 0)
  assert.equal(extractInstagramMessages(payload(event({ mid: 'm_006', text: 'hola' })), 'otra_cuenta').length, 0)
})
test('descarta eventos no conversacionales, videos, reacciones y mensajes eliminados', () => {
  assert.equal(extractInstagramMessages(payload({ sender: { id: '123' }, reaction: { mid: 'm_99' } }), account).length, 0)
  assert.equal(extractInstagramMessages(payload(event({ mid: 'm_007', is_deleted: true, text: 'hola' })), account).length, 0)
  assert.equal(extractInstagramMessages(payload(event({ mid: 'm_008', attachments: [{ type: 'video' }] })), account).length, 0)
})
test('deduplica en un mismo lote y rechaza formatos incorrectos', () => {
  const same = event({ mid: 'm_009', text: 'hola' })
  assert.equal(extractInstagramMessages(payload(same, same), account).length, 1)
  assert.deepEqual(extractInstagramMessages({ object: 'whatsapp_business_account' }, account), [])
  assert.deepEqual(extractInstagramMessages({ object: 'instagram', entry: null }, account), [])
})
test('contrato: firma, handshake y motor común conservados', () => {
  const route = readFileSync(new URL('../src/app/api/instagram/webhook/route.ts', import.meta.url), 'utf8')
  assert.match(route, /INSTAGRAM_VERIFY_TOKEN/)
  assert.match(route, /hub\.challenge/)
  assert.match(route, /verifyWebhookSignature\(rawBody,/)
  assert.match(route, /inspectInstagramWebhook/)
  assert.match(route, /processIncoming/)
  assert.match(route, /messageContext\.run/)
})

test('inventarios extensos se dividen en mensajes de Instagram completos', () => {
  const input = Array.from({ length: 80 }, (_, i) => `${i + 1}. Mueble de prueba`).join('\n')
  const chunks = splitInstagramText(input)
  assert.ok(chunks.length > 1)
  assert.ok(chunks.every((chunk) => chunk.length <= 900))
  assert.equal(chunks.join('\n'), input)
})

test('diagnostica los eventos descartados sin registrar texto ni identificadores', () => {
  const result = inspectInstagramWebhook(payload(event({ mid: 'm_012', text: 'Hola' }, { recipient: { id: 'otro' } })), account)
  assert.equal(result.messages.length, 0)
  assert.equal(result.diagnostic.messagingEvents, 1)
  assert.equal(result.diagnostic.ignored.accountMismatch, 1)
  assert.equal(JSON.stringify(result.diagnostic).includes('Hola'), false)
  assert.equal(JSON.stringify(result.diagnostic).includes('123456'), false)
})

test('admite entry.id alternativo siempre que el destinatario exacto sea la cuenta autorizada', () => {
  const result = inspectInstagramWebhook({object: 'instagram', entry: [
    {id: 'identificador_alternativo', messaging: [event({mid: 'm_013', text: 'Hola'})]},
  ]}, account)
  assert.equal(result.messages.length, 1)
  assert.equal(result.diagnostic.matchingEntry, false)
  assert.equal(result.diagnostic.matchingRecipient, true)
})

test('el mensaje de otra cuenta se rechaza aunque coincida entry.id', () => {
  const result = inspectInstagramWebhook(payload(event({mid: 'm_014', text: 'Hola'}, {recipient: {id: 'otra_cuenta'}})), account)
  assert.equal(result.messages.length, 0)
})

test('registra decisiones y resultados de envío solo para el canal Instagram', () => {
  const processor = readFileSync(new URL('../src/lib/whatsapp/incomingProcessor.ts', import.meta.url), 'utf8')
  const transport = readFileSync(new URL('../src/lib/whatsapp/messageTransport.ts', import.meta.url), 'utf8')
  const route = readFileSync(new URL('../src/app/api/instagram/webhook/route.ts', import.meta.url), 'utf8')
  assert.match(processor, /\[Instagram\]\[motor\]/)
  assert.match(transport, /\[Instagram\]\[envio\]/)
  assert.match(route, /\[Instagram\]\[webhook\]/)
})
