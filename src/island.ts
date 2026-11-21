import * as T from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { colors, levels } from './model'
import type { Contact, Settings } from './model'

export type IslandMember = { contact: Contact; mood: number; linked: boolean; count: number }
const palette = ['#fff1d5', '#fff3dc', '#fbe5cf', '#f0e4d8']
const platforms = [{ y: 2.65, z: -3.5 }, { y: -2.65, z: 3.5 }]
export const periods = ['晨光', '白日', '黃昏', '夜晚']
export function localPeriod() {
  const h = new Date().getHours()
  return h < 5 || h >= 19 ? 3 : h < 10 ? 0 : h < 16 ? 1 : 2
}
function mesh(geometry: T.BufferGeometry, color: string | number, parent: T.Object3D, x = 0, y = 0, z = 0) {
  const object = new T.Mesh(geometry, new T.MeshStandardMaterial({ color, flatShading: true }))
  object.position.set(x, y, z)
  parent.add(object)
  return object
}
const sphere = (r: number) => new T.IcosahedronGeometry(r, 1)
function terrain(parent: T.Object3D) {
  const vertices: number[] = [], shades: number[] = []
  const rings: [number, number][] = [[4.25, 0], [4.4, -.35], [3.3, -1.15], [1.6, -2.05], [.25, -2.55]]
  const sides = 15
  const point = (radius: number, height: number, i: number) => {
    const angle = i / sides * 2 * Math.PI
    const rim = 1 + .09 * Math.sin(angle * 7)
    return [Math.sin(angle) * radius * rim, height, Math.cos(angle) * radius * rim]
  }
  const face = (a: number[], b: number[], c: number[], grass: boolean, i: number) => {
    const color = new T.Color((grass ? ['#879540', '#a2a950', '#768637', '#b3ab57'] : ['#896747', '#a17b54', '#755637', '#b28a60'])[i % 4])
    vertices.push(...a, ...b, ...c)
    for (let j = 0; j < 3; j++) shades.push(color.r, color.g, color.b)
  }
  for (let i = 0; i < sides; i++) {
    const outer = point(...rings[0], i)
    const next = point(...rings[0], i + 1)
    const inner = point(2.25, .035, i)
    const innerNext = point(2.25, .035, i + 1)
    face([0, .06, 0], inner, innerNext, true, i)
    face(inner, outer, next, true, i + 2)
    face(inner, next, innerNext, true, i + 1)
    rings.slice(1).forEach(([radius, height], j) => {
      const [upperRadius, upperHeight] = rings[j]
      const top = point(upperRadius, upperHeight, i)
      const topNext = point(upperRadius, upperHeight, i + 1)
      const lower = point(radius, height, i)
      const lowerNext = point(radius, height, i + 1)
      face(top, lower, topNext, j === 0, i + j)
      face(topNext, lower, lowerNext, j === 0, i + j + 2)
    })
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('color', new T.Float32BufferAttribute(shades, 3))
  geometry.computeVertexNormals()
  parent.add(new T.Mesh(geometry, new T.MeshStandardMaterial({ vertexColors: true, side: T.DoubleSide, flatShading: true })))
}
function island(scene: T.Scene, y: number, z: number, compact: boolean, lower = false) {
  const group = new T.Group()
  group.position.set(0, y, z)
  group.scale.setScalar(compact ? .65 : 1)
  scene.add(group)
  terrain(group)
  if (!lower) {
    const tent = mesh(new T.ConeGeometry(.72, 1.35, 4), '#c89b5e', group, -2.65, .63, -1.64)
    tent.rotation.y = Math.PI / 4
    for (let i = 0; i < 3; i++) mesh(new T.BoxGeometry(.58, .12, .42), ['#b28761', '#e3b975', '#687e47'][i], group, 2.1, .1 + i * .13, 1.5)
  }
  for (let i = 0; i < (lower ? 2 : 0); i++) {
    const px = [-2.65, 2.6, 1.65][i], pz = [-1.64, -1.9, 2.4][i]
    mesh(new T.CylinderGeometry(.11, .16, .91, 6), '#926945', group, px, .44, pz)
    const crown = mesh(sphere(lower && !i ? .95 : .57), '#74883d', group, px, 1.18, pz)
    crown.scale.y = 1.22
  }
  for (let i = 0; i < 18; i++) {
    const angle = i * 2.4
    const flower = mesh(sphere(.13), ['#fff0b4', '#f4a8af', '#f3ebce'][i % 3], group, Math.sin(angle) * (2.5 + i % 3 * .45), .07, Math.cos(angle) * (2.5 + i % 3 * .45))
    flower.scale.y = .55
  }
  const fire = mesh(new T.ConeGeometry(.32, .8, 6), '#ffbd61', group, 0, .4, -1.6)
  fire.material.emissive.set('#ec7836')
  const lamp = mesh(sphere(.23), '#ffeac1', group, 2.6, 1.1, -1.9)
  lamp.material.emissive.set('#fba34f')
  return { fire, lamp }
}
function avatar(contact: Contact, scene: T.Scene) {
  const root = new T.Group(), body = new T.Group(), head = new T.Group()
  root.add(body)
  body.add(head)
  head.position.y = 1.16
  const skin = '#f2bc91'
  mesh(sphere(.37), skin, head)
  for (const side of [-1, 1]) mesh(sphere(.078), skin, head, side * .35, -.07, .05)
  const hair = mesh(sphere(.39), '#513a3d', head, 0, .14, -.065)
  hair.scale.set(1.04, contact.hair === 'long' ? 1.05 : .72, 1)
  if (contact.hair === 'long') {
    mesh(sphere(.24), '#513a3d', head, 0, .24, -.34)
    for (const side of [-1, 1]) mesh(sphere(.18), '#513a3d', head, side * .26, -.17, -.16).scale.y = 1.45
  }
  const fringe = mesh(sphere(.23), '#513a3d', head, -.14, .24, .21)
  fringe.scale.set(1.04, .57, .73)
  fringe.rotation.z = .42
  const glints = [-1, 1].map(i => mesh(sphere(.014), '#fff7d6', head, i * .12 - .012, .027, .377))
  const eyes = [-1, 1].map(i => mesh(sphere(.041), '#423547', head, i * .12, .015, .345))
  const brows = [-1, 1].map(i => mesh(new T.BoxGeometry(.075, .016, .018), '#63474c', head, i * .12, .09, .33))
  const tears = [-1, 1].map(i => mesh(sphere(.031), '#83cde5', head, i * .15, -.079, .33))
  const smile = mesh(new T.TorusGeometry(.067, .015, 5, 10, Math.PI), '#925c57', head, 0, -.085, .343)
  const mouth = mesh(new T.BoxGeometry(.11, .021, .025), '#925c57', head, 0, -.105, .343)
  mesh(new T.CylinderGeometry(.235, .28, .44, 8), contact.shirt, body, 0, .69)
  const arms = [-1, 1].map(side => {
    const pivot = new T.Group()
    pivot.position.set(side * .249, .86, 0)
    body.add(pivot)
    mesh(new T.CapsuleGeometry(.067, .22, 3, 6), skin, pivot, 0, -.16)
    return pivot
  })
  const legs = [-1, 1].map(side => {
    const pivot = new T.Group()
    pivot.position.set(side * .12, .49, 0)
    body.add(pivot)
    mesh(new T.CapsuleGeometry(.087, .25, 3, 6), '#56627d', pivot, 0, -.19)
    mesh(sphere(.1), '#684a35', pivot, 0, -.39, .045).scale.set(.92, .57, 1.38)
    return pivot
  })
  const cloud = new T.Group()
  cloud.position.set(0, 1.85, 0)
  root.add(cloud)
  for (let i = -1; i <= 1; i++) mesh(sphere(.17), '#8d98ab', cloud, i * .17, i === 0 ? .06 : 0)
  const rain = Array.from({ length: 4 }, (_, i) => mesh(new T.CapsuleGeometry(.017, .075, 2, 4), '#9ad3e6', cloud, i * .13 - .2))
  const tag = document.createElement('button')
  tag.className = 'nametag'
  tag.type = 'button'
  tag.style.setProperty('--level', colors[contact.openness - 1])
  tag.dataset.gold = String(contact.openness === 5)
  const label = new CSS2DObject(tag)
  label.position.y = 2.33
  root.add(label)
  scene.add(root)
  const shadow = new T.Mesh(new T.CircleGeometry(.38, 12), new T.MeshBasicMaterial({ color: '#385a4e', transparent: true, opacity: .2, depthWrite: false }))
  shadow.rotation.x = -Math.PI / 2
  scene.add(shadow)
  return { root, body, head, eyes, glints, shadow, brows, tears, smile, mouth, arms, legs, cloud, rain, tag, label, mood: -1, linked: false, jumping: 0, celebrating: 0, from: 0, attention: false, key: '' }
}
export function mountIsland(host: HTMLElement, choose: (id: string) => void, compact = false) {
  let renderer: T.WebGLRenderer
  try { renderer = new T.WebGLRenderer({ antialias: (navigator.hardwareConcurrency || 4) > 4, alpha: true }) }
  catch { host.classList.add('no-webgl'); return null }
  const low = (navigator.hardwareConcurrency || 4) <= 4
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.7))
  const labels = new CSS2DRenderer()
  labels.domElement.className = 'scene-labels'
  host.prepend(renderer.domElement, labels.domElement)
  const scene = new T.Scene()
  const sky = new T.Color(palette[localPeriod()])
  const fog = new T.FogExp2(sky, .014)
  scene.fog = fog
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 180)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enableRotate = compact
  controls.enablePan = false
  controls.enableZoom = compact
  controls.touches.TWO = T.TOUCH.DOLLY_PAN
  const reset = () => {
    const w = host.clientWidth, h = host.clientHeight
    if (!w || !h) return
    controls.target.set(0, .35, 0)
    camera.position.set(0, 9.35, 29)
    controls.update()
    camera.updateMatrixWorld()
    const bounds = new T.Box2()
    for (const { y, z } of compact ? [{ y: 0, z: 0 }] : platforms) {
      const radius = compact ? 2.95 : 4.85
      // Include the rock tips, walking avatars, and room above their name tags.
      const corners = [
        [0, -2.6, 0], [0, -2.05, 1.75], [0, -1.15, 3.65],
        [-radius, -.35, 0], [radius, -.35, 0], [0, -.35, radius],
        [0, 0, -radius], [0, 2.7, -3.55],
      ]
      for (const [x, v, d] of corners) {
        const point = new T.Vector3(x, y + v, z + d).applyMatrix4(camera.matrixWorldInverse)
        bounds.expandByPoint(new T.Vector2(point.x, point.y))
      }
    }
    const size = bounds.getSize(new T.Vector2())
    const center = bounds.getCenter(new T.Vector2())
    const header = compact ? 0 : 74
    const units = Math.max(size.x / (w * .88), size.y / Math.max(1, h - header - 40))
    camera.zoom = 1
    camera.left = center.x - w * units / 2
    camera.right = center.x + w * units / 2
    camera.top = center.y + (h + header) * units / 2
    camera.bottom = center.y - (h - header) * units / 2
    camera.updateProjectionMatrix()
  }
  const sun = new T.DirectionalLight('#fff3d3', 2.3)
  scene.add(sun, new T.HemisphereLight('#fff9ed', '#b18b69', 2))
  const islands = compact ? [island(scene, 0, 0, true)] : platforms.map(({ y, z }, i) => island(scene, y, z, false, i === 1))
  if (!compact) {
    for (const [x, y, z, scale] of [[-5.8, 1, -9, .38], [5.8, 4, -12, .45], [5.55, -2, -9, .35], [-5.6, -6, -8, .3]]) {
      const distant = new T.Group()
      distant.position.set(x, y, z)
      distant.scale.setScalar(scale)
      terrain(distant)
      mesh(sphere(.95), '#9aa573', distant, 0, .45)
      scene.add(distant)
    }
    for (const [x, y, z] of [[-5, 5, -10], [5, 6, -12], [-5.5, -3, -10], [6, 0, -8], [-3.8, -7, -8]]) {
      for (let i = -1; i <= 1; i++) {
        const puff = mesh(sphere(i === 0 ? .83 : .56), '#fff8ec', scene, x + i * .62, y, z)
        puff.scale.set(1.4, i === 0 ? .74 : .55, .8)
      }
    }
  }
  const orb = mesh(sphere(1.15), '#ffe3ae', scene)
  orb.material.emissive.set('#e7ab56')
  const stars = Array.from({ length: low ? 18 : 50 }, (_, i) => {
    const object = mesh(sphere(.045 + i % 3 * .022), '#fff2d2', scene, Math.sin(i * 2.2) * 32, 4 + i % 11 * 1.7, Math.cos(i * 2.2) * 32)
    object.material.emissive.set('#fff0bb')
    return object
  })
  const sign = ({ y, z }: typeof platforms[number], text: string) => {
    const node = document.createElement('span')
    node.className = 'island-sign'
    const icon = document.createElement('span')
    icon.className = 'group-icon'
    icon.setAttribute('aria-hidden', 'true')
    node.append(icon, text)
    const label = new CSS2DObject(node)
    label.position.set(0, y + .1, z + 3.35)
    scene.add(label)
  }
  if (!compact) { sign(platforms[0], '本週已聯繫'); sign(platforms[1], '待聯繫') }

  const avatars = new Map<string, ReturnType<typeof avatar>>()
  let members: IslandMember[] = [], preferences: Settings | undefined, override: number | null = null
  let frame = 0
  let focus: { member: string; start: number; position: T.Vector3; target: T.Vector3; point: T.Vector3; end: T.Vector3; zoom: number } | null = null
  const release = (object: T.Object3D) => object.traverse(child => {
    if (child instanceof T.Mesh) { child.geometry.dispose(); child.material.dispose() }
  })
  function select(member: string) {
    const model = avatars.get(member)
    if (!model || compact || focus) return
    const start = performance.now()
    if (model.attention) model.celebrating = start
    const point = model.root.position.clone().add(new T.Vector3(0, .95, 0))
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
  const clockStart = performance.now()
  const skyColors = palette.map(value => new T.Color(value))
  const lightPosition = new T.Vector3()
  function animate(now: number) {
    frame = requestAnimationFrame(animate)
    if (!host.clientWidth || document.hidden) return
    const t = (now - clockStart) / 1000
    const period = override ?? localPeriod()
    sky.lerp(skyColors[period], .022)
    fog.color.copy(sky)
    fog.density = period === 0 ? .020 : .016
    sun.intensity += ((period === 3 ? .68 : 2.3) - sun.intensity) * .025
    const date = new Date()
    const hour = override === null ? date.getHours() + date.getMinutes() / 60 : [7, 12, 17.5, 22][period]
    const arc = (hour - (period === 3 ? 18 : 5)) / 14 * Math.PI
    const altitude = Math.sin(arc) * 22
    orb.position.lerp(lightPosition.set(-Math.cos(arc) * 29, 5 + Math.max(0, altitude), -29), .025)
    sun.position.copy(orb.position)
    orb.material.color.set(period === 3 ? '#fff4d5' : '#ffcb83')
    stars.forEach((star, i) => {
      star.visible = period === 3
      star.scale.setScalar(.75 + .24 * Math.sin(t * 2 + i))
      if (i < 8) star.position.set(Math.sin(t * .35 + i) * (3 + i), .5 + i % 3 * .45, Math.cos(t * .4 + i) * 3)
    })
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
    members.forEach(({ contact, mood, linked }, i) => {
      const model = avatars.get(contact.id)!
      if (model.mood !== -1 && mood === 0 && model.mood !== 0) model.celebrating = now
      if (model.mood !== -1 && linked !== model.linked) {
        model.from = model.root.position.x
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
      const radius = compact ? .9 : mood === 3 ? 3.55 : 1 + (i % 3) * .83
      const platform = compact ? { y: 0, z: 0 } : platforms[linked ? 0 : 1]
      const sitting = !attention && (mood === 3 || (period === 3 && phase % 9 < 6) || (mood === 2 && phase % 8 < 2.5))
      const restingAtFire = sitting && period === 3 && mood !== 3
      const orbit = sitting ? i * 2.4 : angle
      const restingRadius = restingAtFire ? compact ? .65 : 1.25 : radius
      const gestureIndex = (i + Math.floor(phase / cycle)) % 4
      const nearCamera = new T.Vector2(camera.position.x, camera.position.z - platform.z).normalize()
      const approaching = attention && !compact && (gestureIndex === 1 || (mood === 2 && gestureIndex === 3))
      const x = (approaching ? nearCamera.x * 3.35 : Math.sin(orbit) * restingRadius)
      const z = platform.z + (approaching ? nearCamera.y * 3.35 : Math.cos(orbit) * restingRadius - (restingAtFire ? compact ? 1.04 : 1.6 : 0))
      const jump = model.jumping ? Math.min(1, (now - model.jumping) / 1150) : 1
      const celebration = model.celebrating ? Math.min(1, (now - model.celebrating) / 1100) : 1
      if (model.root.position.lengthSq() === 0) model.root.position.set(x, platform.y, z)
      model.root.position.x = jump < 1 ? T.MathUtils.lerp(model.from, x, jump) : T.MathUtils.lerp(model.root.position.x, x, .065)
      model.root.position.z = T.MathUtils.lerp(model.root.position.z, z, .065)
      const hop = attention ? Math.abs(Math.sin(phase * 5.4)) * (mood === 1 ? .17 : .49) : mood === 0 && phase % 11 < 1.1 ? Math.abs(Math.sin(phase * 5)) * .24 : 0
      model.root.position.y = platform.y + Math.sin(jump * Math.PI) * 2.7 + Math.sin(celebration * Math.PI) * .65 + hop
      model.shadow.position.set(model.root.position.x - (period === 2 ? .38 : .12), platform.y + .055, model.root.position.z + .14)
      model.shadow.scale.set(period === 2 ? 1.65 : 1, period === 2 ? .8 : 1, 1)
      model.shadow.material.opacity = jump < 1 ? 0 : (period === 3 ? .32 : .22) / (1 + model.root.position.y - platform.y)
      const yaw = !compact || attention || celebration < 1 ? Math.atan2(camera.position.x - model.root.position.x, camera.position.z - model.root.position.z) : angle + Math.PI / 2 + (mood === 0 && phase % 13 < 1.4 ? phase * 4 : 0)
      model.root.rotation.y += Math.atan2(Math.sin(yaw - model.root.rotation.y), Math.cos(yaw - model.root.rotation.y)) * .15
      model.body.position.y = T.MathUtils.lerp(model.body.position.y, sitting ? -.31 : 0, .12)
      model.body.rotation.x = T.MathUtils.lerp(model.body.rotation.x, mood >= 2 && !attention ? .24 : 0, .1)
      model.head.rotation.y = mood === 1 && !attention ? Math.sin(phase * 1.5) * .22 : 0
      model.head.rotation.x = mood >= 2 && !attention ? .21 : 0
      const stride = Math.sin(phase * (mood ? 4 : 8)) * (mood ? .23 : .48)
      const waving = attention || celebration < 1 || (mood === 0 && (phase % 11 < 2 || (period === 0 && phase % 17 < 2)))
      model.arms.forEach((arm, side) => {
        const thumb = side ? 1 : -1
        const gesture = gestureIndex === 2 && attention ? thumb * (side ? 2.55 : .7) : thumb * (1.9 + Math.sin(phase * 11) * .34)
        arm.rotation.z = T.MathUtils.lerp(arm.rotation.z, waving ? gesture : thumb * .12, .19)
        arm.rotation.x = sitting ? -.8 : stride * thumb * .55
        model.legs[side].rotation.x = T.MathUtils.lerp(model.legs[side].rotation.x, sitting ? -1.42 : stride * thumb, .15)
        model.brows[side].rotation.z = mood >= 2 ? thumb * -.36 : 0
        model.eyes[side].scale.y = period === 3 && sitting ? .24 : 1
        model.glints[side].visible = mood === 0 && !sitting
        model.tears[side].visible = mood === 2 && !attention
      })
      model.smile.visible = mood !== 1
      model.smile.rotation.z = mood >= 2 && !attention ? 0 : Math.PI
      model.mouth.visible = mood === 1
      const cloudScale = mood >= 2 ? 1 : 0
      model.cloud.scale.setScalar(T.MathUtils.lerp(model.cloud.scale.x, cloudScale, .14))
      model.cloud.visible = model.cloud.scale.x > .025
      model.cloud.rotation.z = attention ? Math.sin(phase * 10) * .22 : 0
      model.rain.forEach((drop, index) => { drop.visible = mood === 2; drop.position.y = -.12 - ((t * 1.25 + index * .15) % .54) })
      model.body.traverse(object => {
        if (object instanceof T.Mesh) {
          object.material.transparent = mood === 3
          object.material.opacity = T.MathUtils.lerp(object.material.opacity, mood === 3 ? .55 : 1, .1)
        }
      })
      const label = `${contact.name}${attention ? ' ❗' : ''}`
      model.tag.title = levels[contact.openness - 1]
      if (model.key !== label) { model.tag.textContent = label; model.key = label }
      model.tag.classList.toggle('attention', attention)
      model.label.position.y = sitting ? 1.99 : 2.25
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
      members = rows
      preferences = settings
      for (const [key, model] of avatars) if (!rows.some(row => row.contact.id === key)) {
        scene.remove(model.root, model.shadow); release(model.root); release(model.shadow); model.tag.remove(); avatars.delete(key)
      }
      rows.forEach(({ contact }) => {
        const existing = avatars.get(contact.id)
        if (existing && existing.root.userData.look === contact.hair + contact.shirt) {
          existing.tag.style.setProperty('--level', colors[contact.openness - 1])
          existing.tag.dataset.gold = String(contact.openness === 5)
          return
        }
        if (existing) { scene.remove(existing.root, existing.shadow); release(existing.root); release(existing.shadow); existing.tag.remove() }
        const model = avatar(contact, scene)
        model.root.userData = { member: contact.id, look: contact.hair + contact.shirt }
        model.tag.onclick = () => select(contact.id)
        avatars.set(contact.id, model)
      })
    },
    dispose() {
      cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); release(scene); renderer.dispose()
      renderer.domElement.remove(); labels.domElement.remove()
    },
  }
}
