import * as T from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { demoLook } from './model'
import { batch, mesh, shadow } from './scenery'
import { release } from './glb'
import { characterRig } from './rig'
import type { Contact } from './model'

const spheres = (low: boolean) => (parent: T.Object3D, color: string | number, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
  const object = mesh(new T.SphereGeometry(1, low ? 9 : 14, low ? 7 : 10), color, parent, x, y, z, false)
  object.scale.set(sx, sy, sz)
  return object
}

function proceduralCharacter(contact: Contact, low: boolean) {
  const body = new T.Group(), head = new T.Group()
  body.add(head)
  head.position.y = 1.15
  const look = demoLook(contact), style = look?.style ?? contact.hair
  const long = (look?.hair ?? contact.hair) === 'long'
  const skin = '#f4ba8f'
  const hair = long ? '#4a2d1f' : style === 'swept' ? '#22242a' : '#34251c'
  const tint = new T.Color(look?.shirt ?? contact.shirt)
  const piping = tint.clone().multiplyScalar(.64).getHex()
  const lining = tint.clone().lerp(new T.Color('#fff0cc'), .22).getHex()
  const hairLight = new T.Color(hair).lerp(new T.Color('#a9683c'), .12)
  const ball = spheres(low)

  const face = new T.Group()
  ball(face, skin, 0, 0, .042, .393, .385, .334)
  ball(face, hair, 0, .14, -.093, .418, .37, .355)
  ball(face, hair, 0, long ? -.065 : .023, -.215, .384, long ? .385 : .296, .24)
  for (const side of [-1, 1]) {
    ball(face, skin, side * .36, -.04, .051, .079, .095, .058)
    ball(face, '#db9781', side * .393, -.049, .091, .025, .041, .013)
    ball(face, '#eb9a85', side * .227, -.102, .307, .065, .027, .019).rotation.y = side * .4
    if (long) {
      const lock = ball(face, hair, side * .31, -.047, .008, .10, style === 'bob' ? .265 : .196, .212)
      lock.rotation.z = side * .29
    }
  }
  ball(face, '#efaa7f', 0, -.068, .37, .043, .033, .034)
  if (long) {
    for (const [i, [x, y, z, sx, sy, rot]] of [[-.195,.197,.220,.112,.233,-.52],[-.133,.262,.238,.101,.247,-.75],[-.058,.284,.255,.103,.211,-.9],[.200,.196,.223,.109,.201,.55],[.157,.261,.231,.09,.184,.73]].entries()) {
      ball(face, i % 2 ? hairLight.getHex() : hair, x, y, z, sx, sy, .147).rotation.z = rot
    }
    if (style === 'bun' || style === 'long') {
      ball(face, hair, -.085, .46, -.221, .20, .186, .18)
      ball(face, hairLight.getHex(), -.123, .505, -.226, .138, .142, .159).rotation.z = .38
    }
    if (style === 'pony') {
      ball(face, '#a083aa', .275, .234, -.296, .087, .086, .086)
      ball(face, hair, .359, .107, -.364, .126, .192, .126).rotation.z = .36
      ball(face, hairLight.getHex(), .448, -.052, -.335, .121, .157, .111).rotation.z = .72
    }
  } else {
    const tresses = [[-.295,.171,.161,.108,.192,-.45],[-.245,.301,.199,.125,.197,-.65],[-.123,.338,.223,.135,.208,-.72],[-.004,.332,.198,.13,.19,-.84],[.121,.307,.198,.115,.179,.43],[.245,.243,.158,.11,.18,.62],[.306,.148,.12,.098,.143,.48]]
    for (const [i, [x, y, z, sx, sy, rot]] of tresses.entries()) {
      const lock = ball(face, i % 3 === 1 ? hairLight.getHex() : hair, x, y + (style === 'swept' ? x * .11 : 0), z, sx, style === 'curly' ? (i % 2 ? .14 : .125) : sy, .134)
      lock.rotation.z = rot + (style === 'swept' ? .25 : 0)
    }
  }
  head.add(batch(face, false))

  const eyes = [-1, 1].map(side => {
    const eye = new T.Group()
    eye.position.set(side * .132, .001, .348)
    eye.rotation.y = side * .19
    head.add(eye)
    ball(eye, '#fff6e5', 0, 0, .007, .071, .086, .029)
    ball(eye, '#38241a', -.001, -.002, .025, .058, .075, .026)
    ball(eye, '#1c1512', 0, .001, .042, .039, .056, .015)
    const glint = ball(eye, '#fff8ed', -.02, .027, .055, .016, .017, .009)
    glint.material.emissive.set('#4e463b')
    ball(eye, '#d9b44a', .02, -.029, .048, .008, .009, .007)
    return eye
  })
  const brows = [-1, 1].map(side => ball(head, hair, side * .138, .106, .34, .057, .014, .018))
  const tears = [-1, 1].map(side => ball(head, '#88c7df', side * .161, -.107, .334, .024, .043, .024))
  const curve = new T.TorusGeometry(.05, .010, 6, 16, Math.PI)
  const smile = mesh(curve, '#974e40', head, 0, -.124, .354, false)
  smile.scale.set(1, .48, 1)
  const mouth = ball(head, '#995a45', 0, -.135, .352, .040, .012, .014)

  const clothes = new T.Group()
  const coat = mesh(new T.CylinderGeometry(.216, long ? .295 : .25, .486, low ? 9 : 14), tint.getHex(), clothes, 0, .669, 0, false)
  coat.scale.z = .79
  ball(clothes, tint.getHex(), 0, .841, -.01, .229, .145, .18)
  ball(clothes, lining, 0, .865, .144, .132, .065, .051)
  ball(clothes, '#ffd6a6', 0, .939, .026, .113, .126, .11)
  const seam = ball(clothes, piping, .01, .646, .195, .013, .189, .007)
  seam.rotation.z = -.03
  for (const y of [.59, .70, .79]) ball(clothes, '#e1b16f', .047, y, .192, .018, .017, .009)
  body.add(batch(clothes, false))

  const arms = [-1, 1].map(side => {
    const pivot = new T.Group(), parts = new T.Group()
    pivot.position.set(side * .207, .826, 0)
    body.add(pivot)
    mesh(new T.CapsuleGeometry(.077, .199, 3, 8), tint.getHex(), parts, 0, -.128, 0, false)
    mesh(new T.CylinderGeometry(.081, .077, .052, 8), piping, parts, 0, -.259, 0, false)
    ball(parts, skin, 0, -.316, .001, .063, .073, .062)
    pivot.add(batch(parts, false))
    return pivot
  })
  const legs = [-1, 1].map(side => {
    const pivot = new T.Group(), parts = new T.Group()
    pivot.position.set(side * .119, .432, 0)
    body.add(pivot)
    mesh(new T.CapsuleGeometry(.080, .209, 3, 8), long ? '#9c7559' : piping, parts, 0, -.116, 0, false)
    ball(parts, '#9a6644', 0, -.306, .052, .095, .090, .139)
    ball(parts, '#5e3e29', 0, -.359, .068, .098, .040, .134)
    pivot.add(batch(parts, false))
    return pivot
  })
  const materials: T.Material[] = []
  body.traverse(object => { if (object instanceof T.Mesh) materials.push(object.material) })
  return { body, head, arms, legs, eyes, brows, tears, smile, mouth, materials }
}

export function avatar(contact: Contact, scene: T.Scene, texture: T.Texture, low: boolean) {
  const root = new T.Group()
  const { body, head, arms, legs, tears, ...face } = proceduralCharacter(contact, low)
  const fallback = new T.Group()
  const { min, max } = new T.Box3().setFromObject(body)
  const height = max.y - min.y
  fallback.scale.setScalar(1 / height)
  fallback.position.y = -min.y / height
  fallback.add(body)
  root.add(fallback)

  const weather = new T.Group(), cloud = new T.Group()
  weather.position.set(.24, 1.035, .035)
  weather.scale.setScalar(.62)
  root.add(weather)
  weather.add(cloud)
  const ball = spheres(low)
  for (let i = -1; i <= 1; i++) ball(cloud, '#ae9a89', i * .135, i === 0 ? .035 : 0, 0, .13, .105, .10)
  const rain = Array.from({ length: 4 }, (_, i) => mesh(new T.CapsuleGeometry(.012, .055, 2, 4), '#a3c7d6', cloud, i * .09 - .13))
  cloud.visible = false
  cloud.scale.setScalar(0)

  const tag = document.createElement('button')
  tag.className = 'nametag'
  tag.type = 'button'
  tag.textContent = contact.name
  const label = new CSS2DObject(tag)
  label.center.y = 1
  label.position.y = 1.08
  root.add(label)

  const bubble = document.createElement('span')
  bubble.className = 'attention-bubble'
  bubble.textContent = '!!'
  bubble.setAttribute('aria-hidden', 'true')
  const alert = new CSS2DObject(bubble)
  alert.position.set(.47, .84, .035)
  alert.visible = false
  root.add(alert)
  scene.add(root)

  const shade = shadow(texture, .3, 1.34, .97)
  scene.add(shade)
  const pose = { body, head, arms, legs }
  const model = {
    ...pose, root, face: face as typeof face | undefined, tears,
    applyRig: undefined as (() => void) | undefined,
    shadow: shade, cloud, rain, tag, label, alert, mood: -1, linked: false,
    jumping: 0, celebrating: 0, from: new T.Vector3(), attention: false,
    upgrade(source: T.Group) {
      const rig = characterRig(source, pose)
      if (!rig) return
      const newTears = rig.tears.map(({ x, y, z }) =>
        ball(rig.effects, '#88c7df', x, y, z, .013, .024, .013))
      for (const drop of newTears) drop.visible = false
      rig.apply()
      root.add(rig.model)
      rig.effects.add(weather)
      release(fallback)
      fallback.removeFromParent()
      for (const part of [body, head, ...arms, ...legs]) part.clear()
      model.face = undefined
      model.tears = newTears
      model.applyRig = rig.apply
    },
  }
  return model
}
