import assert from 'node:assert/strict'
import { test } from 'node:test'
import { animationPreview, islandSlot } from '../src/island-layout.ts'
import { islandWidth } from '../src/island-model.ts'

test('avatars occupy separate walking lanes as island occupancy grows', () => {
  for (let count = 1; count <= 24; count++) {
    const slots = Array.from({ length: count }, (_, i) => islandSlot(i, count, false))
    for (const [i, a] of slots.entries()) {
      if (count <= 6) {
        const ratio = a.height * Math.cos(35 * Math.PI / 180) / islandWidth
        assert.ok(ratio >= .11 && ratio <= .125)
      }
      for (const b of slots.slice(i + 1)) {
        const dx = Math.max(0, Math.abs(a.x - b.x) - a.walk - b.walk)
        const dz = Math.max(0, Math.abs(a.z - b.z) - 1.1 * (a.walk + b.walk))
        assert.ok(Math.hypot(dx, dz) > .68 * Math.max(a.height, b.height), `${count} avatars`)
      }
    }
  }
})

test('preview accepts the four moods and explicit attention only', () => {
  for (let mood = 0; mood <= 3; mood++) {
    assert.deepEqual(animationPreview(new URLSearchParams(`mood=${mood}&attention=1`)), { mood, attention: true })
  }
  assert.deepEqual(animationPreview(new URLSearchParams('mood=4&attention=true')), { mood: null, attention: false })
  assert.deepEqual(animationPreview(new URLSearchParams()), { mood: null, attention: false })
})
