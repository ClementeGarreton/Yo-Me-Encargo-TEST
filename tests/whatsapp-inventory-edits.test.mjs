import test from 'node:test'
import assert from 'node:assert/strict'
import { parseInventoryEdits, applyInventoryEdits } from '../src/lib/whatsapp/inventoryEdits.ts'

const catalog = [
  { id: 'frigo', name: 'Refrigerador', is_active: true },
  { id: 'sofa2', name: 'Sillón de 2 Cuerpos', is_active: true },
  { id: 'sofa3', name: 'Sillón de 3 Cuerpos', is_active: true },
  { id: 'rack', name: 'Rack Mediano', is_active: true },
]
const original = [{ catalogItemId: 'frigo', quantity: 1 }, { catalogItemId: 'rack', quantity: 1 }]

test('QUITAR refrigerador Y AGREGAR un sofá de 2 cuerpos: ambas operaciones', () => {
  const edits = parseInventoryEdits('quitar refrigerador y agregar un sofá de 2 cuerpos')
  assert.equal(edits.length, 2)
  const result = applyInventoryEdits(original, edits, catalog)
  assert.equal(result.ok, true)
  assert.deepEqual(result.items, [{ catalogItemId: 'rack', quantity: 1 }, { catalogItemId: 'sofa2', quantity: 1 }])
  assert.deepEqual(original, [{ catalogItemId: 'frigo', quantity: 1 }, { catalogItemId: 'rack', quantity: 1 }])
})

test('un comando de agregar no elige el sofá de 3 cuerpos en lugar del de 2', () => {
  const result = applyInventoryEdits(original, parseInventoryEdits('agregar un sofá de 2 cuerpos'), catalog)
  assert.equal(result.ok, true)
  assert.ok(result.items.some(x => x.catalogItemId === 'sofa2'))
  assert.ok(!result.items.some(x => x.catalogItemId === 'sofa3'))
})

test('si falla AGREGAR, QUITAR también se revierte', () => {
  const result = applyInventoryEdits(original, parseInventoryEdits('quitar refrigerador y agregar un dragón'), catalog)
  assert.equal(result.ok, false)
  assert.deepEqual(original, [{ catalogItemId: 'frigo', quantity: 1 }, { catalogItemId: 'rack', quantity: 1 }])
})

test('si falla QUITAR, AGREGAR tampoco se aplica', () => {
  const result = applyInventoryEdits(original, parseInventoryEdits('quitar cama King y agregar sofá de 2 cuerpos'), catalog)
  assert.equal(result.ok, false)
})

test('QUITAR simple funciona y no deja inventario vacío', () => {
  const edits = parseInventoryEdits('QUITAR refrigerador')
  const result = applyInventoryEdits(original, edits, catalog)
  assert.equal(result.ok, true)
  assert.deepEqual(result.items, [{ catalogItemId: 'rack', quantity: 1 }])
  const onlyFridge = [{ catalogItemId: 'frigo', quantity: 1 }]
  assert.equal(applyInventoryEdits(onlyFridge, edits, catalog).ok, false)
})

test('si hay dos sillones, QUITAR sofá sin tamaño es ambiguo', () => {
  const items = [{ catalogItemId: 'sofa2', quantity: 1 }, { catalogItemId: 'sofa3', quantity: 1 }]
  const result = applyInventoryEdits(items, parseInventoryEdits('quitar sofá'), catalog)
  assert.equal(result.ok, false)
})

test('al eliminar cantidad explícita, se conserva el resto', () => {
  const items = [{ catalogItemId: 'rack', quantity: 3 }]
  const result = applyInventoryEdits(items, parseInventoryEdits('quitar 2 rack mediano'), catalog)
  assert.equal(result.ok, true)
  assert.deepEqual(result.items, [{ catalogItemId: 'rack', quantity: 1 }])
})

test('no interpreta charla ordinaria como edición', () => {
  assert.equal(parseInventoryEdits('Me gustaría cotizar una mudanza'), null)
  assert.equal(parseInventoryEdits('CONFIRMAR'), null)
})
