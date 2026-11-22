import assert from 'node:assert/strict'
import { test } from 'node:test'
import { animationPreview, compositionTop, compositionWidth, elevation, islandSlot, platforms } from '../src/island-layout.ts'
import { islandWidth } from '../src/island-model.ts'

test('avatars occupy separate walking lanes as island occupancy grows', () => {
  for (let count = 1; count <= 24; count++) {
    const slots = Array.from({ length: count }, (_, i) => islandSlot(i, count, false))
    for (const [i, a] of slots.entries()) {
      if (count <= 6) {
        const ratio = a.height * Math.cos(elevation) / islandWidth
        assert.ok(ratio >= .175 && ratio <= .2)
      }
      for (const b of slots.slice(i + 1)) {
        const dx = Math.max(0, Math.abs(a.x - b.x) - a.walk - b.walk)
        const dz = Math.max(0, Math.abs(a.z - b.z) - 1.1 * (a.walk + b.walk))
        assert.ok(Math.hypot(dx, dz) > .68 * Math.max(a.height, b.height), `${count} avatars`)
      }
    }
  }
})

test('island framing matches the reference at 360–430px and leaves room between the platforms', () => {
  for (const width of [360, 390, 430]) {
    const height = width * 1280 / 720
    const units = compositionWidth / width
    const position = (platform, y = 0, z = 0) =>
      (compositionTop - (platform.y + y * platform.scale * platform.relief) * Math.cos(elevation) +
        (platform.z + z * platform.scale) * Math.sin(elevation)) / (units * height)
    const [upper, lower] = platforms
    assert.ok(Math.abs(position(upper) - .25) < .002)
    assert.ok(Math.abs(position(lower) - .48) < .006)
    assert.ok(Math.abs(position(upper, .30, upper.signDepth) - .30) < .005)
    assert.ok(Math.abs(position(lower, .30, lower.signDepth) - .507) < .005)
    assert.ok(position(upper, -2.43, 2.35) < position(lower, 0, -2.86))
    const standing = islandSlot(0, 2, false).height
    for (const platform of platforms) {
      const ratio = standing * platform.scale * Math.cos(elevation) / (units * height)
      assert.ok(ratio > .078 && ratio < .09)
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
