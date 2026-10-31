import test from 'node:test'
import assert from 'node:assert/strict'
import { answerExtras, extrasQuestion, getExtrasStep } from '../src/lib/whatsapp/extrasFlow.ts'

function initial() {
  return { packing: false, disassembly: false, assembly: false, unpacking: false, observations: '__pending__', extrasStep: 'packing' }
}

test('pregunta una sola decisión cada vez', () => {
  const s = initial()
  assert.match(extrasQuestion(s), /embalemos tus pertenencias/)
  assert.doesNotMatch(extrasQuestion(s), /desarmar/)
  const first = answerExtras(s, 'Sí')
  assert.ok(first)
  assert.equal(first.packing, true)
  assert.equal(first.disassembly, false)
  assert.equal(first.assembly, false)
  assert.equal(getExtrasStep(first), 'disassembly')
  assert.match(extrasQuestion(first), /desarmar/)
  assert.doesNotMatch(extrasQuestion(first), /armemos/)
  const second = answerExtras(first, 'NO')
  assert.ok(second)
  assert.equal(second.disassembly, false)
  assert.equal(second.packing, true)
  assert.match(extrasQuestion(second), /armemos/)
  const third = answerExtras(second, 'si, gracias')
  assert.ok(third)
  assert.equal(third.assembly, true)
  assert.equal(third.observations, '')
  assert.equal(getExtrasStep(third), 'done')
  assert.equal(extrasQuestion(third), '')
})

test('NINGUNO omite todos los servicios restantes sin repetir tres preguntas', () => {
  const result = answerExtras(initial(), 'NINGUNO')
  assert.ok(result)
  assert.equal(result.packing, false)
  assert.equal(result.disassembly, false)
  assert.equal(result.assembly, false)
  assert.equal(result.extrasStep, 'done')
  assert.equal(result.observations, '')
  const afterPacking = answerExtras(initial(), 'Sí')
  const afterNone = answerExtras(afterPacking, 'Ninguno')
  assert.equal(afterNone.packing, true)
  assert.equal(afterNone.disassembly, false)
  assert.equal(afterNone.assembly, false)
})

test('una respuesta ambigua no altera datos ni avanza', () => {
  const initialState = initial()
  assert.equal(answerExtras(initialState, 'tal vez'), null)
  assert.equal(initialState.extrasStep, 'packing')
})

test('mantiene compatibilidad con estados anteriores sin extrasStep', () => {
  const legacy = initial()
  delete legacy.extrasStep
  assert.equal(getExtrasStep(legacy), 'packing')
  const completed = { ...legacy, observations: '' }
  assert.equal(getExtrasStep(completed), 'done')
})

test('una respuesta no vuelve a escribir otras elecciones ni altera el original', () => {
  const initialState = { ...initial(), packing: false, disassembly: true, assembly: true }
  const next = answerExtras(initialState, 'NO')
  assert.equal(next.packing, false)
  assert.equal(next.disassembly, true)
  assert.equal(next.assembly, true)
  assert.equal(initialState.extrasStep, 'packing')
})
