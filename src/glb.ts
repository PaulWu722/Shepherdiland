import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { demoLook } from './model.ts'
import type { Contact } from './model.ts'

const characterFiles: Record<string, string> = {
  honey: 'char_curly', rose: 'char_bob', lavender: 'char_aiwei',
  sky: 'char_haoyu', marigold: 'char_yuyan', sage: 'char_zichian',
}
const hairFiles: Record<string, string> = {
  short: 'char_zichian', long: 'char_bob', curly: 'char_curly', bob: 'char_bob',
  pony: 'char_aiwei', swept: 'char_haoyu', bun: 'char_yuyan',
}

export function characterFile(contact: Contact) {
  const look = demoLook(contact)
  return look ? characterFiles[look.avatar] : hairFiles[contact.hair] ?? hairFiles.short
}

const models = new Map<string, Promise<T.Group | undefined>>()
let mobileDecode: Promise<unknown> = Promise.resolve()

function simplifyMaterial(material: T.Material) {
  if (!(material instanceof T.MeshStandardMaterial)) return
  material.normalMap = material.roughnessMap = material.metalnessMap = null
  material.metalness = 0
  material.roughness = .85
  const map = material.map
  if (!map) return
  const image = map.image as CanvasImageSource & { width: number; height: number }
  const longest = Math.max(image.width, image.height)
  if (longest <= 1024) return
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * 1024 / longest)
  canvas.height = Math.round(image.height * 1024 / longest)
  const context = canvas.getContext('2d')
  if (!context) return
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  map.image = canvas
  map.needsUpdate = true
}

export function loadModel(file: string, directory: URL, low = false) {
  const url = new URL(`${file}.glb`, directory)
  const key = url.href + (low ? '#low' : '')
  const existing = models.get(key)
  if (existing) return existing
  const pending = (async () => {
    const response = await fetch(url, { cache: 'no-cache' })
    if (!response.ok) return
    const data = await response.arrayBuffer()
    if (data.byteLength < 20) return
    const header = new DataView(data)
    if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(8, true) !== data.byteLength) return
    const parse = async () => {
      const manager = new T.LoadingManager()
      let failed = false
      manager.onError = () => { failed = true }
      const { scene } = await new GLTFLoader(manager).parseAsync(data, directory.href)
      if (failed) return
      scene.updateMatrixWorld(true)
      const materials = new Set<T.Material>()
      scene.traverse(object => {
        if (!(object instanceof T.Mesh)) return
        object.userData.sharedGlb = true
        const list = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of list) materials.add(material)
        if (object instanceof T.SkinnedMesh) {
          object.computeBoundingBox()
          object.boundingSphere = object.boundingBox!.getBoundingSphere(new T.Sphere())
          object.boundingSphere.radius *= 1.2
        }
      })
      if (!materials.size) return
      if (low) for (const material of materials) simplifyMaterial(material)
      return scene
    }
    if (!low) return parse()
    const turn = mobileDecode.then(parse)
    mobileDecode = turn.catch(() => undefined)
    return turn
  })().catch(() => undefined).then(model => {
    if (!model) models.delete(key)
    return model
  })
  models.set(key, pending)
  return pending
}

export function release(object: T.Object3D) {
  const skeletons = new Set<T.Skeleton>()
  object.traverse(child => {
    if (child instanceof T.SkinnedMesh) skeletons.add(child.skeleton)
    if (!(child instanceof T.Mesh || child instanceof T.Points) || child.userData.sharedGlb) return
    child.geometry.dispose()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) material.dispose()
  })
  for (const skeleton of skeletons) skeleton.dispose()
}
