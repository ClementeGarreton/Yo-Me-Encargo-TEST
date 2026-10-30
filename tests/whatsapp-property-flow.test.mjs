import test from 'node:test'
import assert from 'node:assert/strict'
import { completeOneStoryHouse, nextPropertyQuestion } from '../src/lib/whatsapp/propertyFlow.ts'
const blank = () => ({ propertyType: null, floor: null, hasElevator: null, parkingDistance: null })
const ready = (propertyType='departamento') => ({ propertyType, floor: 5, hasElevator: true, parkingDistance: 20 })

test('primera pregunta trata solo el lugar de retiro y no ocho parámetros', () => {
  const question = nextPropertyQuestion(blank(), blank())
  assert.match(question, /retiro \(origen\)/)
  assert.match(question, /¿Es casa/)
  assert.doesNotMatch(question, /entrega \(destino\)/)
  assert.doesNotMatch(question, /ascensor/)
})
test('si hay tipo y piso, pregunta ascensor solo en origen', () => {
  const origin = {propertyType:'departamento', floor: 5, hasElevator: null, parkingDistance: null}
  const question = nextPropertyQuestion(origin, blank())
  assert.match(question, /ascensor/)
  assert.doesNotMatch(question, /estacionar el camión/)
  assert.doesNotMatch(question, /entrega \(destino\)/)
})
test('pasa a destino cuando el origen está completo', () => {
  const question = nextPropertyQuestion(ready(), blank())
  assert.match(question, /entrega \(destino\)/)
  assert.doesNotMatch(question, /retiro \(origen\)/)
})
test('casa de una planta no exige ascensor ni supone la distancia del camión', () => {
  const destination = {propertyType:'casa', floor:1, hasElevator:null, parkingDistance:null}
  completeOneStoryHouse(destination)
  assert.equal(destination.hasElevator, false)
  assert.equal(destination.parkingDistance, null)
  const question = nextPropertyQuestion(ready(), destination)
  assert.match(question, /estacionar el camión/)
  assert.doesNotMatch(question, /¿Hay ascensor/)
})
test('no presupone ascensores en casas de varias plantas', () => {
  const dest = {propertyType:'casa', floor:2, hasElevator:null, parkingDistance:0}
  completeOneStoryHouse(dest)
  assert.equal(dest.hasElevator, null)
  assert.match(nextPropertyQuestion(ready(), dest), /¿Hay ascensor/)
})
test('una pregunta solicita exactamente el campo faltante', () => {
  const origin = {...ready(), parkingDistance: null}
  const question = nextPropertyQuestion(origin, ready())
  assert.match(question, /¿A cuántos metros/)
  assert.doesNotMatch(question, /¿Hay ascensor/)
})

test('"Sí, a como 10 metros" completa ascensor y distancia exacta sin repetir pregunta', async () => {
  const { applyFocusedPropertyFallback } = await import('../src/lib/whatsapp/propertyFlow.ts')
  const beforeOrigin = { propertyType: 'departamento', floor: 5, hasElevator: null, parkingDistance: null }
  const beforeDest = blank()
  const afterOrigin = { ...beforeOrigin }
  const afterDest = { ...beforeDest }
  applyFocusedPropertyFallback(beforeOrigin, beforeDest, afterOrigin, afterDest, 'Sí, a como 10 metros de la entrada')
  assert.deepEqual(afterOrigin, { propertyType: 'departamento', floor: 5, hasElevator: true, parkingDistance: 10 })
  assert.match(nextPropertyQuestion(afterOrigin, afterDest), /entrega \(destino\)/)
  assert.deepEqual(afterDest, blank())
})
test('si falta ascensor pero viene la distancia, pregunta solamente por ascensor', async () => {
  const { applyFocusedPropertyFallback } = await import('../src/lib/whatsapp/propertyFlow.ts')
  const origin = { propertyType: 'departamento', floor: 5, hasElevator: null, parkingDistance: null }
  const next = { ...origin }
  applyFocusedPropertyFallback(origin, blank(), next, blank(), 'a unos 10 metros de la entrada')
  assert.equal(next.parkingDistance, 10)
  assert.equal(next.hasElevator, null)
  assert.match(nextPropertyQuestion(next, blank()), /¿Hay ascensor para mover/)
  assert.doesNotMatch(nextPropertyQuestion(next, blank()), /metros/)
})
test('no reinterpreta metros como piso ni los redondea a 20', async () => {
  const { applyFocusedPropertyFallback } = await import('../src/lib/whatsapp/propertyFlow.ts')
  const origin = { propertyType: 'departamento', floor: 5, hasElevator: null, parkingDistance: null }
  const next = { ...origin, parkingDistance: 20 } // El modelo redondeó a la opción web
  applyFocusedPropertyFallback(origin, blank(), next, blank(), 'Sí, a 10m')
  assert.equal(next.parkingDistance, 10)
  assert.equal(next.floor, 5)
  assert.equal(next.hasElevator, true)
})
test('una respuesta posterior del destino no sobrescribe origen ya completo', async () => {
  const { applyFocusedPropertyFallback } = await import('../src/lib/whatsapp/propertyFlow.ts')
  const origin = ready()
  const dest = { propertyType: 'casa', floor: 2, hasElevator: null, parkingDistance: null }
  const nextOrigin = { ...origin }
  const nextDest = { ...dest }
  applyFocusedPropertyFallback(origin, dest, nextOrigin, nextDest, 'No, a 35 metros')
  assert.deepEqual(nextOrigin, origin)
  assert.deepEqual(nextDest, { propertyType: 'casa', floor: 2, hasElevator: false, parkingDistance: 35 })
})
test('pregunta tipo y piso no se confunde con metros y sí entiende departamento piso 5', async () => {
  const { applyFocusedPropertyFallback } = await import('../src/lib/whatsapp/propertyFlow.ts')
  const next = blank()
  applyFocusedPropertyFallback(blank(), blank(), next, blank(), 'Es departamento en un piso 5')
  assert.equal(next.propertyType, 'departamento')
  assert.equal(next.floor, 5)
  assert.match(nextPropertyQuestion(next, blank()), /¿Hay ascensor/)
})
test('una casa de un piso completa ascensor falso sin inventar estacionamiento', async () => {
  const { applyFocusedPropertyFallback } = await import('../src/lib/whatsapp/propertyFlow.ts')
  const dest = blank()
  const afterDest = blank()
  applyFocusedPropertyFallback(ready(), dest, ready(), afterDest, 'Es casa de un solo piso')
  assert.equal(afterDest.propertyType, 'casa')
  assert.equal(afterDest.floor, 1)
  assert.equal(afterDest.hasElevator, false)
  assert.equal(afterDest.parkingDistance, null)
})
