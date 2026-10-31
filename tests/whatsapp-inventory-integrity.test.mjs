import test from 'node:test'
import assert from 'node:assert/strict'
import { chooseClosestInventoryCandidate, upsertInventoryPhoto, canCloseInventory } from '../src/lib/whatsapp/inventoryResolution.ts'

const initial = () => ({ items: [{ catalogItemId: 'mueble1', quantity: 1 }], pendingInventory: [], inventoryPhotos: [], inventoryCollectionDone: false })

test('no confunde ropero con alfombra si son candidatas incompatibles', () => {
  assert.equal(chooseClosestInventoryCandidate('ropero grande', [
    { catalogItemId: 'alfombra', label: 'Alfombra', confidence: 0.99 },
  ]), null)
})
test('sinónimos de ropero y cajonera mantienen correspondencia legítima', () => {
  assert.equal(chooseClosestInventoryCandidate('closet de madera', [{ catalogItemId: 'A', label: 'Ropero Grande', confidence: 0.8 }])?.catalogItemId, 'A')
  assert.equal(chooseClosestInventoryCandidate('cómoda de cajones', [{ catalogItemId: 'B', label: 'Cajonera Mediana', confidence: 0.8 }])?.catalogItemId, 'B')
})
test('cada foto conserva su identificador y no borra las otras', () => {
  let state = initial()
  for (const id of ['foto1', 'foto2', 'foto3', 'foto4']) {
    state = upsertInventoryPhoto(state, { messageId: id, status: 'done', recognized: [id] })
  }
  assert.equal(state.inventoryPhotos.length, 4)
  assert.equal(new Set(state.inventoryPhotos.map((p) => p.messageId)).size, 4)
})
test('foto en proceso impide cerrar el inventario aunque existan artículos', () => {
  let state = initial()
  state = upsertInventoryPhoto(state, { messageId: 'foto1', status: 'processing', recognized: [] })
  assert.equal(canCloseInventory(state), false)
  state = upsertInventoryPhoto(state, { messageId: 'foto1', status: 'done', recognized: ['Ropero'] })
  assert.equal(canCloseInventory(state), true)
})
test('foto no identificada impide generar el PDF', () => {
  const state = upsertInventoryPhoto(initial(), { messageId: 'foto2', status: 'needs_description', recognized: [] })
  assert.equal(canCloseInventory(state), false)
})
test('una foto nueva revoca el LISTO anterior', () => {
  const state = upsertInventoryPhoto({ ...initial(), inventoryCollectionDone: true }, { messageId: 'foto2', status: 'processing', recognized: [] })
  assert.equal(state.inventoryCollectionDone, false)
})
