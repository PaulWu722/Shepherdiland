import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as T from 'three'
import { characterFile, loadModel, release } from '../src/glb.ts'
import { islandSurface, islandWidth } from '../src/island-model.ts'
import { seed } from '../src/model.ts'
import { characterRig } from '../src/rig.ts'

function triangleGlb() {
  const document = {
    asset: { version: '2.0' }, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: 36 }], bufferViews: [{ buffer: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, componentType: 5126, type: 'VEC3', count: 3, min: [0, 0, 0], max: [1, 0, 1] }],
  }
  const json = JSON.stringify(document)
  const length = Math.ceil(json.length / 4) * 4
  const glb = Buffer.alloc(28 + length + 36)
  glb.write('glTF')
  glb.writeUInt32LE(2, 4)
  glb.writeUInt32LE(glb.length, 8)
  glb.writeUInt32LE(length, 12)
  glb.write('JSON', 16)
  glb.write(json.padEnd(length), 20)
  glb.writeUInt32LE(36, 20 + length)
  glb.writeUInt32LE(0x004e4942, 24 + length)
  glb.writeFloatLE(1, 28 + length + 12)
  glb.writeFloatLE(1, 28 + length + 32)
  return glb
}

test('model files match demo looks and non-demo hair', () => {
  const { contacts } = seed()
  assert.deepEqual(contacts.map(characterFile), ['char_curly', 'char_bob', 'char_aiwei', 'char_haoyu', 'char_yuyan', 'char_zichian'])
  assert.equal(characterFile({ ...contacts[0], name: '新成員', hair: 'long' }), 'char_bob')
  assert.equal(characterFile({ ...contacts[0], name: '新成員', hair: 'short' }), 'char_zichian')
})

test('missing, truncated and unavailable GLBs leave fallback active and a retry can load', async t => {
  const glb = triangleGlb()
  const directory = new URL('https://example.test/models/')
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    switch (++calls) {
      case 1: return new Response('', { status: 404 })
      case 2: return new Response(glb.subarray(0, glb.length - 4))
      case 3: throw new TypeError('offline')
      default: return new Response(glb)
    }
  })
  for (let i = 0; i < 3; i++) assert.equal(await loadModel('island_top', directory), undefined)
  const first = loadModel('island_top', directory)
  assert.equal(loadModel('island_top', directory), first)
  const template = await first
  assert.ok(template instanceof T.Group)
  const mesh = template.clone().getObjectByProperty('type', 'Mesh')
  const dispose = t.mock.method(mesh.material, 'dispose', () => {})
  release(mesh)
  assert.equal(dispose.mock.callCount(), 0)
  assert.equal(await loadModel('island_top', directory), template)
  assert.equal(calls, 4)
})

test('island normalization uses the grass instead of the highest prop', () => {
  const source = new T.Group()
  const turf = new T.Mesh(new T.BoxGeometry(10, 2, 3))
  turf.position.set(12, 3, -15)
  source.add(turf)
  const tree = new T.Mesh(new T.BoxGeometry(1.5, 4, 1.5))
  tree.position.set(12, 6, -15)
  source.add(tree)
  const surface = islandSurface(source)
  assert.ok(surface)
  assert.equal(islandSurface(source), surface)
  const bounds = new T.Box3().setFromObject(surface.object)
  assert.ok(Math.abs(bounds.max.x - bounds.min.x - islandWidth) < .001)
  assert.ok(Math.abs(bounds.getCenter(new T.Vector3()).x) < .001)
  assert.ok(Math.abs(surface.groundAt(0, 0)) < .001)
  assert.ok(Math.abs(surface.groundAt(2.5, .6)) < .001)
  assert.ok(surface.zScale < .55)
  assert.ok(bounds.min.y < -2.4)
})

test('a rotated Mixamo rig lowers arms, waves, and keeps cloned bones independent', () => {
  const source = new T.Group()
  const geometry = new T.BoxGeometry(.45, 1, .3).translate(0, .5, 0)
  const count = geometry.attributes.position.count
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(count * 4), 4))
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(
    Array.from({ length: count }, () => [1, 0, 0, 0]).flat(), 4))
  const skin = new T.SkinnedMesh(geometry)
  source.add(skin)
  const bones = []
  const add = (parent, name, x, y, z = 0) => {
    const bone = new T.Bone()
    bone.name = `mixamorig:${name}`
    bone.position.set(x, y, z)
    parent.add(bone)
    bones.push(bone)
    return bone
  }
  const hips = add(skin, 'Hips', 0, .26)
  const spine = add(hips, 'Spine', 0, .08)
  add(spine, 'Head', 0, .25)
  for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
    const arm = add(spine, side + 'Arm', sign * .13, .14)
    arm.rotation.y = sign * .7
    const hand = add(arm, side + 'Hand', sign * .16, -.16)
    hand.rotation.z = sign * .23
    const thigh = add(hips, side + 'UpLeg', sign * .07, -.05)
    add(thigh, side + 'Leg', 0, -.12)
  }
  skin.bind(new T.Skeleton(bones))
  source.rotation.y = .9
  const pose = {
    body: new T.Group(), head: new T.Group(),
    arms: [new T.Group(), new T.Group()], legs: [new T.Group(), new T.Group()],
  }
  const rig = characterRig(source, pose), other = characterRig(source, pose)
  assert.ok(rig && other)
  const joint = (rig, name) => rig.model.getObjectByName('mixamorig:' + name)
  const at = (rig, name) => joint(rig, name).getWorldPosition(new T.Vector3())
  rig.apply()
  other.apply()
  const lowered = at(rig, 'LeftHand').sub(at(rig, 'LeftArm'))
  assert.ok(lowered.y < -.18 && Math.abs(lowered.x) < .001 && Math.abs(lowered.z) < .001)
  pose.arms[1].rotation.z = 1.75
  pose.body.position.y = -.22
  pose.legs[1].rotation.x = -1.4
  rig.apply()
  const waved = at(rig, 'LeftHand').sub(at(rig, 'LeftArm'))
  assert.ok(waved.x > .18 && waved.y > 0)
  assert.ok(at(rig, 'Head').y < at(other, 'Head').y - .08)
  assert.equal(rig.effects.parent, joint(rig, 'Head'))
  assert.ok(at(other, 'LeftHand').sub(at(other, 'LeftArm')).distanceTo(lowered) < .001)
  assert.notEqual(joint(rig, 'Head'), joint(other, 'Head'))
})
