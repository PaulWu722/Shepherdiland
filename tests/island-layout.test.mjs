import assert from 'node:assert/strict'
import { test } from 'node:test'
import { animationPreview, avatarKey, islandSlot, platforms, referenceWidth } from '../src/island-layout.ts'
import { seed } from '../src/model.ts'

test('demo looks and saved styles choose the expected sprite families', () => {
  const { contacts } = seed()
  assert.deepEqual(contacts.map(avatarKey), ['honey', 'rose', 'lavender', 'sky', 'marigold', 'sage'])
  const contact = { ...contacts[0], introduction: '' }
  const keys = { short: 'sage', long: 'rose', curly: 'honey', bob: 'rose', pony: 'lavender', swept: 'sky', bun: 'marigold' }
  for (const [style, key] of Object.entries(keys)) {
    assert.equal(avatarKey({ ...contact, hair: style }), key)
    assert.equal(avatarKey({ ...contact, style }), key)
  }
  assert.equal(avatarKey({ ...contact, hair: 'unknown' }), 'sage')
})

test('walk and seated slots stay on the grass and leave room for sprites and tags', () => {
  for (const [name, { grass, width, height }] of Object.entries(platforms)) {
    for (let count = 1; count <= 24; count++) {
      const slots = Array.from({ length: count }, (_, i) => [islandSlot(name, i, count), islandSlot(name, i, count, true)])
      for (const [i, poses] of slots.entries()) {
        for (const a of poses) {
          for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI / 18) {
            const x = a.x + Math.cos(angle) * a.walkX
            const y = a.y + Math.sin(angle) * a.walkY
            assert.ok(Math.hypot((x - grass.x) / grass.rx, (y - grass.y) / grass.ry) <= 1, `${name}: slot ${i} of ${count}`)
          }
          assert.ok(count <= 4 ? a.height === 109 : a.height < 109)
          for (const b of slots.slice(i + 1).flat()) {
            const dx = (Math.abs(a.x - b.x) - a.walkX - b.walkX) * width
            const dy = (Math.abs(a.y - b.y) - a.walkY - b.walkY) * height
            assert.ok(dx >= (a.width + b.width) / 2 || dy >= a.height, `${name}: sprite spacing for ${count}`)
            assert.ok(dx >= (a.nameWidth + b.nameWidth) / 2 || dy >= a.nameSize * 1.67, `${name}: tag spacing for ${count}`)
          }
        }
      }
    }
  }
  assert.ok(Math.abs(platforms.top.left / referenceWidth - .13) < .01)
  assert.ok(Math.abs((platforms.bottom.left + platforms.bottom.width) / referenceWidth - .92) < .01)
})

test('preview accepts the four moods and explicit attention only', () => {
  for (let mood = 0; mood <= 3; mood++) {
    assert.deepEqual(animationPreview(new URLSearchParams(`mood=${mood}&attention=1`)), { mood, attention: true })
  }
  assert.deepEqual(animationPreview(new URLSearchParams('mood=4&attention=true')), { mood: null, attention: false })
  assert.deepEqual(animationPreview(new URLSearchParams()), { mood: null, attention: false })
})
