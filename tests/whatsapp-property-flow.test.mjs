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
test('si hay tipo y piso, pregunta acceso y estacionamiento solo en origen', () => {
  const origin = {propertyType:'departamento', floor: 5, hasElevator: null, parkingDistance: null}
  const question = nextPropertyQuestion(origin, blank())
  assert.match(question, /ascensor/)
  assert.match(question, /estacionar el camión/)
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
