import * as T from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { demoLook, levels } from './model'
import type { Contact, Settings } from './model'
import { icon } from './icons'
import { avatar } from './character'
import { cloud, distantIsland, dressIsland, shadowTexture } from './scenery'
import { characterFile, loadModel, release } from './glb'
import { islandSurface, islandWidth } from './island-model'

export type IslandMember = { contact: Contact; mood: number; linked: boolean; count: number }
const palette = ['#fff0d8', '#fff0d9', '#fbe1cb', '#edddce']
const platforms = [{ y: 2.12, z: -2.7, scale: .92 }, { y: -.67, z: .95, scale: 1 }]
const detailPlatform = { y: 0, z: 0, scale: .65 }
const elevation = 35 * Math.PI / 180
export const periods = ['晨光', '白日', '黃昏', '夜晚']

export function localPeriod() {
  const h = new Date().getHours()
  return h < 5 || h >= 19 ? 3 : h < 10 ? 0 : h < 16 ? 1 : 2
}

export function mountIsland(host: HTMLElement, choose: (id: string) => void, compact = false) {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const low = (navigator.hardwareConcurrency || 4) <= 4 || (memory !== undefined && memory <= 2)
  let renderer: T.WebGLRenderer
  try { renderer = new T.WebGLRenderer({ antialias: !low, alpha: true, powerPreference: 'low-power' }) }
  catch { host.classList.add('no-webgl'); return null }
  const modelDirectory = new URL('models/', new URL(import.meta.env.BASE_URL, document.baseURI))
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.85))
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.03
  const labels = new CSS2DRenderer()
  labels.domElement.className = 'scene-labels'
  host.prepend(renderer.domElement, labels.domElement)
  const scene = new T.Scene()
  const sky = new T.Color(palette[localPeriod()])
  const fog = new T.FogExp2(sky, .018)
  scene.fog = fog
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 116)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = compact
  controls.enableRotate = compact
  controls.enablePan = false
  controls.enableZoom = compact
  controls.minZoom = .75
  controls.maxZoom = 2.7
  controls.touches.TWO = T.TOUCH.DOLLY_PAN
  const offset = new T.Vector3(0, Math.sin(elevation), Math.cos(elevation)).multiplyScalar(26)
  const reset = () => {
    const w = host.clientWidth, h = host.clientHeight
    if (!w || !h) return
    controls.target.set(0, 0, 0)
    camera.position.copy(offset)
    controls.update()
    const units = compact ? Math.max(6.7 / w, 6.0 / h) : Math.max(10.65 / w, 10.0 / h)
    const upper = platforms[0]
    const mid = compact ? -.21 : upper.y * Math.cos(elevation) - upper.z * Math.sin(elevation) - h * units * .018
    camera.zoom = 1
    camera.left = -w * units / 2
    camera.right = w * units / 2
    camera.top = mid + h * units / 2
    camera.bottom = mid - h * units / 2
    camera.updateProjectionMatrix()
  }
  const sun = new T.DirectionalLight('#fff0d2', 2.43)
  sun.position.set(-8, 16, 7)
  scene.add(sun, new T.HemisphereLight('#fffbef', '#a8865b', 1.40), new T.AmbientLight('#fff1de', .29))
  const texture = shadowTexture()
  let disposed = false
  const islands = (compact ? [detailPlatform] : platforms).map((platform, i) => {
    const group = new T.Group()
    const fallback = new T.Group()
    group.position.set(0, platform.y, platform.z)
    group.scale.setScalar(platform.scale)
    group.add(fallback)
    scene.add(group)
    let label: CSS2DObject | undefined
    if (!compact) {
      const node = document.createElement('span')
      node.className = 'island-sign'
      node.innerHTML = icon('people')
      node.append(i === 0 ? '本週已聯繫' : '待聯繫')
      label = new CSS2DObject(node)
      label.position.set(0, .34, 2.11)
      group.add(label)
    }
    const { fire, lamp } = dressIsland(fallback, low, i === 1, texture)
    const island = { platform, fire, lamp, surface: undefined as ReturnType<typeof islandSurface> }
    void loadModel(i === 0 ? 'island_top' : 'island_bottom', modelDirectory, low).then(source => {
      if (disposed || !source) return
      const surface = islandSurface(source)
      if (!surface) return
      group.add(surface.object.clone(), fire, lamp)
      fallback.removeFromParent()
      release(fallback)
      for (const light of [fire, lamp]) {
        light.position.x *= surface.xScale
        light.position.z *= surface.zScale
        light.position.y += surface.groundAt(light.position.x, light.position.z)
      }
      if (label) label.position.z *= surface.zScale
      island.surface = surface
    }).catch(() => {})
    return island
  })
  if (!compact) {
    // Place distant props by projected height while keeping depth for the warm aerial haze.
    const place = (object: T.Object3D, x: number, height: number, depth: number, scale: number) => {
      object.position.set(x, (height + depth * Math.sin(elevation)) / Math.cos(elevation), depth)
      object.scale.setScalar(scale)
      scene.add(object)
    }
    const distant = [[4.32,4.40,-15,.27],[-5.1,1.51,-19,.34],[4.96,-.63,-17,.28],[-5.42,-3.30,-23,.28],[5.72,-3.32,-25,.26]]
    distant.forEach(([x, height, depth, scale], i) => place(distantIsland(21 + i, low), x, height, depth, scale))
    for (const [x, height, depth, scale] of [[-4.22,5.98,-12,.72],[4.04,6.35,-13,.82],[-5.29,3.50,-24,.92],[5.49,1.61,-22,.85],[-4.93,-1.52,-19,.74],[4.58,-3.75,-23,1.37],[-4.77,-3.43,-24,1.09]]) {
      place(cloud(low), x, height, depth, scale)
    }
  }
  const orb = new T.Mesh(new T.IcosahedronGeometry(.22, 2), new T.MeshBasicMaterial({ color: '#fff1ce', fog: false }))
  scene.add(orb)
  const starGeometry = new T.BufferGeometry()
  const starPositions = Array.from({ length: low ? 16 : 31 }, (_, i) => [Math.sin(i * 8.4) * 8, -.6 + (i % 7) * .57, -11 - i % 9]).flat()
  starGeometry.setAttribute('position', new T.Float32BufferAttribute(starPositions, 3))
  const stars = new T.Points(starGeometry, new T.PointsMaterial({ color: '#fff4cf', size: low ? 1 : 1.6, transparent: true, depthWrite: false }))
  scene.add(stars)
  const avatars = new Map<string, ReturnType<typeof avatar>>()
  const lookKey = (contact: Contact) => [contact.hair, contact.shirt, demoLook(contact)?.avatar].join('/')
  let groupCounts = [0, 0]
  let members: IslandMember[] = [], preferences: Settings | undefined, override: number | null = null
  let frame = 0
  let focus: { member: string; start: number; position: T.Vector3; target: T.Vector3; point: T.Vector3; end: T.Vector3; zoom: number } | null = null
  function select(member: string) {
    const model = avatars.get(member)
    if (!model || compact || focus) return
    const start = performance.now()
    if (model.attention) model.celebrating = start
    const screenCenter = (camera.top + camera.bottom) / 2
    const up = new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
    const point = model.root.position.clone().add(new T.Vector3(0, model.height * .49, 0)).addScaledVector(up, -screenCenter)
    focus = { member, start, zoom: camera.zoom, target: controls.target.clone(), position: camera.position.clone(), point, end: camera.position.clone().sub(controls.target).add(point) }
    controls.enabled = false
  }
  const start = new T.Vector2(), ray = new T.Raycaster()
  renderer.domElement.onpointerdown = e => start.set(e.clientX, e.clientY)
  renderer.domElement.onpointerup = e => {
    if (start.distanceTo(new T.Vector2(e.clientX, e.clientY)) > 7) return
    const rect = renderer.domElement.getBoundingClientRect()
    ray.setFromCamera(new T.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, 1 - (e.clientY - rect.top) / rect.height * 2), camera)
    const hit = ray.intersectObjects([...avatars.values()].map(value => value.root), true)[0]?.object
    hit?.traverseAncestors(object => { const member = object.userData.member; if (member) select(member) })
  }
  const observer = new ResizeObserver(() => {
    const w = host.clientWidth, h = host.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h)
    labels.setSize(w, h)
    if (!focus) reset()
  })
  observer.observe(host)
  let inView = true
  const visibility = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting })
  visibility.observe(host)
  const clockStart = performance.now()
  let lastFrame = clockStart
  const skyColors = palette.map(value => new T.Color(value))
  const lightPosition = new T.Vector3()
  function animate(now: number) {
    frame = requestAnimationFrame(animate)
    if (!host.clientWidth || document.hidden || (!inView && !focus)) return
    if (low && now - lastFrame < 31) return
    const dt = Math.min(.05, (now - lastFrame) / 1000)
    lastFrame = now
    const t = (now - clockStart) / 1000
    const period = override ?? localPeriod()
    if (host.dataset.period !== String(period)) host.dataset.period = String(period)
    sky.lerp(skyColors[period], .022)
    fog.color.copy(sky)
    fog.density = period === 0 ? .020 : .0175
    sun.intensity += ((period === 3 ? 1.25 : 2.43) - sun.intensity) * .025
    const date = new Date()
    const hour = override === null ? date.getHours() + date.getMinutes() / 60 : [7, 12, 17.5, 22][period]
    const arc = (hour - (period === 3 ? 18 : 5)) / 14 * Math.PI
    const altitude = Math.max(0, Math.sin(arc))
    sun.position.lerp(lightPosition.set(-8 + Math.cos(arc) * 3, 13 + altitude * 4, 7), .025)
    orb.visible = !compact && period === 3
    orb.position.set(-3.9 + Math.sin(arc) * 7, -.5 + altitude * 1.1, -12)
    stars.visible = !compact && period === 3
    stars.material.opacity = .58 + .12 * Math.sin(t * 1.7)
    stars.rotation.z = Math.sin(t * .13) * .015
    islands.forEach(({ fire, lamp }) => { fire.visible = period === 3; fire.scale.y = 1 + Math.sin(t * 13) * .15; lamp.visible = period >= 2 })
    if (focus) {
      const f = Math.min(1, (now - focus.start) / 630)
      const smooth = f * f * (3 - 2 * f)
      camera.position.lerpVectors(focus.position, focus.end, smooth)
      controls.target.lerpVectors(focus.target, focus.point, smooth)
      camera.zoom = T.MathUtils.lerp(focus.zoom, 2.3, smooth)
      camera.updateProjectionMatrix()
      if (f === 1) {
        const member = focus.member
        focus = null
        controls.enabled = true
        reset()
        choose(member)
      }
    }
    controls.update()
    const slots = [0, 0]
    members.forEach(({ contact, mood, linked }, i) => {
      const model = avatars.get(contact.id)!
      if (model.mood !== -1 && mood === 0 && model.mood !== 0) model.celebrating = now
      if (model.mood !== -1 && linked !== model.linked) {
        model.from.copy(model.root.position)
        model.jumping = now
        if (linked) model.celebrating = now
      }
      model.mood = mood
      model.linked = linked
      const phase = t + i * 5.73
      const cycle = (mood === 1 ? 15 : 8) / (preferences?.pace || 1)
      const attention = Boolean(mood && preferences?.attention && phase % cycle > cycle - Math.min(3.6, cycle * .47))
      model.attention = attention
      const speed = mood === 0 ? .56 : mood === 1 ? .29 : .15
      const angle = i * 2.39996 + phase * speed
      const groupIndex = linked ? 0 : 1
      const { platform, surface } = islands[compact ? 0 : groupIndex]
      const slot = slots[groupIndex]++
      const columns = Math.min(4, groupCounts[groupIndex])
      const column = slot % columns
      const row = Math.floor(slot / columns)
      const spacing = columns === 2 ? 2.72 : 5.15 / Math.max(3, columns - 1)
      const lane = (column - (columns - 1) / 2) * spacing
      const sitting = !attention && (mood === 3 || (period === 3 && phase % 9 < 6) || (mood === 2 && phase % 8 < 2.5))
      const restingAtFire = sitting && period === 3 && mood !== 3 && row === 0
      const orbit = sitting ? i * 2.4 : angle
      const gestureIndex = (i + Math.floor(phase / cycle)) % 4
      const approaching = attention && !compact && (gestureIndex === 1 || (mood === 2 && gestureIndex === 3)) && row === 0
      const walk = mood === 0 ? .31 : .22
      const localX = compact ? Math.sin(orbit) : lane + Math.sin(orbit) * walk
      const depth = compact ? Math.cos(orbit) * .6 : -.73 + Math.cos(orbit) * walk * 1.15 + (column % 2 - .5) * .64 + (row % 3) * .66
      const localZ = restingAtFire ? -1 + Math.cos(orbit) * .26 : depth + (approaching ? .86 : 0)
      const x = localX * (surface?.xScale ?? 1) * platform.scale
      const z = platform.z + localZ * (surface?.zScale ?? 1) * platform.scale
      const jump = model.jumping ? Math.min(1, (now - model.jumping) / 1150) : 1
      const celebration = model.celebrating ? Math.min(1, (now - model.celebrating) / 880) : 1
      const follow = 1 - Math.pow(.935, dt * 60)
      if (model.root.position.lengthSq() === 0) model.root.position.set(x, platform.y + .047, z)
      model.root.position.x = jump < 1 ? T.MathUtils.lerp(model.from.x, x, jump) : T.MathUtils.lerp(model.root.position.x, x, follow)
      model.root.position.z = jump < 1 ? T.MathUtils.lerp(model.from.z, z, jump) : T.MathUtils.lerp(model.root.position.z, z, follow)
      const floorX = (jump < 1 ? x : model.root.position.x) / platform.scale
      const floorZ = ((jump < 1 ? z : model.root.position.z) - platform.z) / platform.scale
      const ground = platform.y + (surface?.groundAt(floorX, floorZ) ?? 0) * platform.scale + .047
      const hop = attention ? Math.abs(Math.sin(phase * 5.4)) * (mood === 1 ? .09 : .20) : mood === 0 && phase % 11 < 1.1 ? Math.abs(Math.sin(phase * 5)) * .12 : 0
      const arcHeight = jump < 1 ? T.MathUtils.lerp(model.from.y, ground, jump) + Math.sin(jump * Math.PI) * 1.7 : ground
      model.root.position.y = arcHeight + Math.sin(celebration * Math.PI) * .46 + hop
      model.shadow.position.set(model.root.position.x + (period === 2 ? .21 : .10), ground + .036, model.root.position.z + .095)
      model.shadow.scale.set(period === 2 ? 1.48 : 1, 1, 1)
      model.shadow.material.opacity = jump < 1 ? 0 : (period === 3 ? .26 : .36) / (1 + model.root.position.y - ground)
      const facing = Math.atan2(camera.position.x - model.root.position.x, camera.position.z - model.root.position.z)
      const turn = mood === 0 && phase % 19 < 1.1 ? (phase % 19) / 1.1 * Math.PI * 2 : 0
      const yaw = facing + (attention ? 0 : .22 * Math.sin(orbit) + turn)
      model.root.rotation.y += Math.atan2(Math.sin(yaw - model.root.rotation.y), Math.cos(yaw - model.root.rotation.y)) * .15
      model.body.position.y = T.MathUtils.lerp(model.body.position.y, sitting ? -.22 : 0, .12)
      model.body.rotation.x = T.MathUtils.lerp(model.body.rotation.x, mood >= 2 && !attention ? .24 : 0, .1)
      model.head.rotation.y = mood === 1 && !attention ? Math.sin(phase * 1.5) * .22 : 0
      model.head.rotation.x = mood >= 2 && !attention ? .14 : -.06
      const stride = Math.sin(phase * (mood ? 4 : 8)) * (mood ? .23 : .48)
      const waving = attention || celebration < 1 || (mood === 0 && (phase % 11 < 2 || (period === 0 && phase % 17 < 2)))
      model.arms.forEach((arm, side) => {
        const thumb = side ? 1 : -1
        const gesture = gestureIndex === 2 && attention ? thumb * (side ? 1.97 : .48) : thumb * (1.13 + Math.sin(phase * 11) * .25)
        arm.rotation.z = T.MathUtils.lerp(arm.rotation.z, waving ? gesture : thumb * .12, .19)
        arm.rotation.x = sitting ? -.8 : stride * thumb * .55
        model.legs[side].rotation.x = T.MathUtils.lerp(model.legs[side].rotation.x, sitting ? -1.42 : stride * thumb, .15)
        model.tears[side].visible = mood === 2 && !attention
        if (model.face) {
          model.face.brows[side].rotation.z = mood >= 2 ? thumb * -.36 : 0
          model.face.eyes[side].scale.y = period === 3 && sitting ? .24 : 1
        }
      })
      if (model.applyRig) {
        model.height = islandWidth * platform.scale * .18
        model.root.scale.setScalar(model.height)
        model.applyRig()
      }
      if (model.face) {
        model.face.smile.visible = mood !== 1
        model.face.smile.rotation.z = mood >= 2 && !attention ? 0 : Math.PI
        model.face.mouth.visible = mood === 1
        model.label.position.y = sitting ? 1.96 : 2.19
        for (const material of model.face.materials) {
          material.opacity = T.MathUtils.lerp(material.opacity, mood === 3 && !attention ? .83 : 1, .1)
          material.transparent = material.opacity < .995
        }
      }
      const cloudScale = mood >= 2 && !attention ? (period === 3 ? 1 : .58) : 0
      model.cloud.scale.setScalar(T.MathUtils.lerp(model.cloud.scale.x, cloudScale, .14))
      model.cloud.visible = model.cloud.scale.x > .025
      model.cloud.rotation.z = attention ? Math.sin(phase * 10) * .22 : 0
      model.rain.forEach((drop, index) => { drop.visible = mood === 2; drop.position.y = -.12 - ((t * 1.25 + index * .15) % .54) })
      model.tag.title = [contact.school, contact.department, levels[contact.openness - 1]].filter(Boolean).join('・')
      if (model.tag.textContent !== contact.name) model.tag.textContent = contact.name
      model.alert.visible = attention
      model.tag.disabled = compact
    })
    renderer.render(scene, camera)
    labels.render(scene, camera)
  }
  frame = requestAnimationFrame(animate)
  return {
    reset,
    period(value: number | null) { override = value },
    update(rows: IslandMember[], settings: Settings) {
      const order = new Map(rows.map(({ contact }) => [contact.id, demoLook(contact)?.islandOrder ?? 6]))
      members = [...rows].sort((a, b) => order.get(a.contact.id)! - order.get(b.contact.id)!)
      preferences = settings
      groupCounts = [rows.filter(row => row.linked).length, rows.filter(row => !row.linked).length]
      for (const [key, model] of avatars) if (!rows.some(row => row.contact.id === key)) {
        scene.remove(model.root, model.shadow); release(model.root); release(model.shadow); model.tag.remove(); model.alert.element.remove(); avatars.delete(key)
      }
      rows.forEach(({ contact }) => {
        const existing = avatars.get(contact.id)
        if (existing && existing.root.userData.look === lookKey(contact)) return
        if (existing) { scene.remove(existing.root, existing.shadow); release(existing.root); release(existing.shadow); existing.tag.remove(); existing.alert.element.remove() }
        const model = avatar(contact, scene, texture, low)
        model.root.userData = { member: contact.id, look: lookKey(contact) }
        model.tag.onclick = () => select(contact.id)
        avatars.set(contact.id, model)
        void loadModel(characterFile(contact), modelDirectory, low).then(source => {
          if (!disposed && source && avatars.get(contact.id) === model) model.upgrade(source)
        }).catch(() => {})
      })
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(frame); observer.disconnect(); visibility.disconnect(); controls.dispose(); release(scene); texture.dispose(); renderer.dispose()
      renderer.domElement.remove(); labels.domElement.remove()
    },
  }
}
