import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const grass = ['#839637', '#acb948', '#95a741', '#b6bb55', '#728831', '#c6c369', '#7e9538', '#aab45a']
const sod = ['#777b34', '#89953c', '#a3a343', '#67792e', '#9b913f']
const soil = ['#a67d4c', '#785639', '#bc9466', '#936a44', '#d1a479', '#846043', '#ad895b']

export function mesh(geometry: T.BufferGeometry, color: string | number, parent: T.Object3D, x = 0, y = 0, z = 0, flatShading = true) {
  const object = new T.Mesh(geometry, new T.MeshStandardMaterial({ color, flatShading, roughness: .88 }))
  object.position.set(x, y, z)
  parent.add(object)
  return object
}

const noise = (i: number) => {
  const n = Math.sin(i * 127.1 + 14.7) * 43758.5453
  return n - Math.floor(n)
}

export function terrain(parent: T.Object3D, seed: number, low: boolean) {
  const positions: number[] = [], shades: number[] = []
  const sides = low ? 18 : 24
  const rings = [
    [.23, .045], [.48, .04], [.73, .025], [1, 0], [1.015, -.35],
    [.92, -1.02], [.72, -1.88], [.48, -2.73], [.22, -3.47], [.065, -3.88],
  ]
  const points = rings.map(([size, height], ring) => Array.from({ length: sides }, (_, i) => {
    const a = i / sides * Math.PI * 2
    const id = seed * 193 + ring * 97 + i
    const angle = a + (noise(id + 27) - .5) * .13 + (ring > 4 && ring % 2 ? .08 : 0)
    const rim = 1 + Math.cos(a * 3 + seed) * .085 + Math.sin(a * 7) * .035
    const radius = size * (rim + (noise(id) - .5) * (ring > 4 ? .22 : .12))
    const jitter = (noise(id + 52) - .5) * (ring > 4 ? .6 : .075)
    const tip = ring > 5 ? .17 * Math.sin(a * 3 + seed) : 0
    return new T.Vector3(Math.sin(angle) * 4.72 * radius, height + jitter + tip, Math.cos(angle) * 2.86 * radius)
  }))
  function face(a: T.Vector3, b: T.Vector3, c: T.Vector3, palette: string[], key: number) {
    const color = new T.Color(palette[Math.floor(noise(key + seed * 43) * palette.length)])
    positions.push(...a, ...b, ...c)
    for (let i = 0; i < 3; i++) shades.push(color.r, color.g, color.b)
  }
  const center = new T.Vector3(0, .04, 0)
  const tip = new T.Vector3(.12, -3.99, -.12)
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides
    face(center, points[0][i], points[0][next], grass, i)
    for (let ring = 0; ring < points.length - 1; ring++) {
      const [inner, outer] = [points[ring], points[ring + 1]]
      const palette = ring < 3 ? grass : ring === 3 ? sod : soil
      const key = (ring * sides + i) * 2
      if ((i + ring) % 2) {
        face(inner[i], outer[i], inner[next], palette, key)
        face(inner[next], outer[i], outer[next], palette, key + 1)
      } else {
        face(inner[i], outer[i], outer[next], palette, key)
        face(inner[i], outer[next], inner[next], palette, key + 1)
      }
    }
    face(points.at(-1)![i], tip, points.at(-1)![next], soil, i * 7)
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new T.Float32BufferAttribute(shades, 3))
  geometry.computeVertexNormals()
  parent.add(new T.Mesh(geometry, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 })))
}

// Bake scenery and the stationary parts of each face into vertex colors to limit draw calls.
export function batch(group: T.Group, flatShading = true) {
  group.updateMatrixWorld(true)
  const geometries: T.BufferGeometry[] = []
  group.traverse(child => {
    if (!(child instanceof T.Mesh)) return
    const source = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()
    source.deleteAttribute('uv')
    source.applyMatrix4(child.matrixWorld)
    const color = child.material.color as T.Color
    const count = source.getAttribute('position').count
    const shades = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) color.toArray(shades, i * 3)
    source.setAttribute('color', new T.BufferAttribute(shades, 3))
    geometries.push(source)
    child.geometry.dispose()
    child.material.dispose()
  })
  const geometry = mergeGeometries(geometries)!
  for (const source of geometries) source.dispose()
  return new T.Mesh(geometry, new T.MeshStandardMaterial({ vertexColors: true, flatShading, roughness: .89 }))
}

export function shadowTexture() {
  const size = 32
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1)
    data.set([255, 255, 255, Math.round(255 * Math.max(0, 1 - r * r) ** 2)], (y * size + x) * 4)
  }
  const texture = new T.DataTexture(data, size, size)
  texture.magFilter = T.LinearFilter
  texture.minFilter = T.LinearFilter
  texture.needsUpdate = true
  return texture
}

export function shadow(texture: T.Texture, opacity: number, width: number, depth: number) {
  const shade = new T.Mesh(new T.PlaneGeometry(width, depth), new T.MeshBasicMaterial({
    color: '#47351a', map: texture, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
  }))
  shade.rotation.x = -Math.PI / 2
  return shade
}

const poly = (detail = 0) => new T.IcosahedronGeometry(1, detail)
function rock(group: T.Group, x: number, z: number, size: number, color: string, turns: number) {
  const stone = mesh(poly(), color, group, x, size * .40, z)
  stone.scale.set(size, size * .64, size * .77)
  stone.rotation.y = turns
}

function tree(group: T.Group, x: number, z: number, size: number) {
  const trunk = mesh(new T.CylinderGeometry(.105 * size, .155 * size, .9 * size, 6), '#785029', group, x, .43 * size, z)
  trunk.rotation.z = -.12
  mesh(new T.CylinderGeometry(.058 * size, .092 * size, .58 * size, 5), '#875932', group, x - .15 * size, .63 * size, z).rotation.z = .66
  const crown = mesh(poly(1), '#768f33', group, x, 1.49 * size, z)
  crown.scale.set(.81 * size, 1.02 * size, .83 * size)
  crown.rotation.y = .52
  for (const [dx, dy, dz, radius, tint] of [[-.37, 1.16, .05, .58, '#849b38'], [.34, 1.22, .10, .52, '#668230'], [.03, 1.85, -.18, .58, '#94a844']] as const) {
    mesh(poly(1), tint, group, x + dx * size, dy * size, z + dz * size).scale.setScalar(radius * size)
  }
}

function tent(group: T.Group) {
  const prop = new T.Group()
  prop.position.set(-3.13, 0, -1.03)
  prop.rotation.y = -.18
  group.add(prop)
  const corners = [-.65, 0, .45, .65, 0, .45, 0, 1.24, .29, -.58, 0, -.53, .58, 0, -.53, 0, 1.24, -.39]
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(corners, 3))
  geometry.setIndex([0, 1, 2, 1, 4, 5, 1, 5, 2, 3, 0, 2, 3, 2, 5, 4, 3, 5])
  geometry.computeVertexNormals()
  mesh(geometry, '#d5ad73', prop)
  const door = new T.BufferGeometry()
  door.setAttribute('position', new T.Float32BufferAttribute([-.25, .024, .467, .24, .024, .467, 0, .72, .374], 3))
  door.computeVertexNormals()
  mesh(door, '#563921', prop)
  const flap = mesh(new T.BoxGeometry(.085, .72, .059), '#edc48c', prop, -.15, .35, .43)
  flap.rotation.z = -.27
  mesh(new T.CylinderGeometry(.025, .028, 1.25, 5), '#8f653a', prop, 0, .64, .277)
}

function books(group: T.Group) {
  const stack = new T.Group()
  stack.position.set(1.78, .04, .25)
  stack.rotation.y = .24
  group.add(stack)
  for (const [i, tint] of ['#7f5b50', '#698457', '#c39558', '#537593', '#9e9863'].entries()) {
    const book = new T.Group()
    book.position.y = i * .123
    book.rotation.y = i % 2 ? -.12 : .07
    stack.add(book)
    mesh(new T.BoxGeometry(.51, .082, .37), '#e6d2a5', book, 0, .06, 0)
    mesh(new T.BoxGeometry(.052, .12, .39), tint, book, -.255, .06, 0)
    for (const y of [.11, .012]) mesh(new T.BoxGeometry(.57, .025, .41), tint, book, 0, y, 0)
  }
}

const patches = [[-3.75,.7],[-2.8,1.43],[-2.36,-1.65],[-1.75,.96],[-1.25,-1.98],[-.78,.69],[-.56,-.78],[.25,-2.33],[.98,1.43],[1.3,-1.58],[2.5,1.28],[2.72,-1.43],[3.2,.55],[3.85,-.54],[.35,2.13],[-1.45,1.96]]
function flowers(group: T.Group, low: boolean, lower: boolean) {
  patches.slice(0, low ? 12 : patches.length).forEach(([x, z], i) => {
    const color = ['#fff4e0', '#f3b6c4', '#f9d96f', '#fff9e9'][(i + Number(lower)) % 4]
    for (let j = 0; j < (low ? 1 : i % 3 ? 2 : 1); j++) {
      const px = x + j * .17, pz = z + j * .09
      const height = .19 + noise(i + j * 22) * .18
      mesh(new T.CylinderGeometry(.017, .024, height, 4), '#637635', group, px, height / 2, pz).rotation.z = -.12
      const leaf = mesh(poly(), '#879c41', group, px + .065, .095, pz)
      leaf.scale.set(.105, .043, .046)
      leaf.rotation.z = .36
      for (let k = 0; k < (low ? 4 : 5); k++) {
        const a = k * Math.PI * 2 / (low ? 4 : 5)
        const petal = mesh(poly(), color, group, px + Math.cos(a) * .073, height, pz + Math.sin(a) * .073)
        petal.scale.set(.083, .044, .066)
        petal.rotation.y = -a
      }
      mesh(poly(), '#e5ae42', group, px, height + .034, pz).scale.set(.048, .030, .048)
    }
  })
}

function trail(group: T.Group, lower: boolean) {
  const points = [[-3.22,.58],[-2.25,.31],[-1.5,-.08],[-.58,-.12],[.24,.33],[.98,.45],[1.84,.20],[2.80,-.22]]
  const positions: number[] = []
  const colors: number[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const [x, z] = points[i], [nx, nz] = points[i + 1]
    const width = .21 + noise(i) * .16, next = .21 + noise(i + 1) * .16
    const shift = lower ? .38 : 0
    const a = [x, .092, z + shift + width], b = [nx, .092, nz + shift + next]
    const c = [x, .092, z + shift - width], d = [nx, .092, nz + shift - next]
    positions.push(...a, ...b, ...c, ...b, ...d, ...c)
    for (const tint of (i % 2 ? ['#caba76', '#c6b66e'] : ['#d8c684', '#cbb972'])) {
      const color = new T.Color(tint)
      for (let j = 0; j < 3; j++) colors.push(color.r, color.g, color.b)
    }
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  group.add(new T.Mesh(geometry, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 })))
}

export function dressIsland(group: T.Group, low: boolean, lower: boolean, texture: T.Texture, castShadows = false) {
  terrain(group, lower ? 9 : 4, low)
  trail(group, lower)
  const props = new T.Group()
  if (lower) {
    tree(props, -3.13, -.86, 1)
    rock(props, 3.03, -1.15, .5, '#98958d', 1.1)
  } else {
    tent(props)
    books(props)
    rock(props, .56, -2.12, .55, '#839442', .75)
    rock(props, 3.57, -.79, .56, '#75875c', .42)
  }
  for (const [i, [x, z]] of [[-3.51,.57],[-2.92,1.02],[-2.13,1.48],[-.96,.98],[.38,1.42],[1.64,-1.49],[2.56,1.51],[3.15,-.44],[-3.37,-.37],[-1.28,-1.82]].entries()) {
    rock(props, x, z, .16 + noise(i * 27) * .24, ['#aaa59b', '#888477', '#c7bba6'][i % 3], i * 1.2)
  }
  flowers(props, low, lower)
  const decor = batch(props)
  group.add(decor)
  if (castShadows && !low) {
    for (const land of group.children) land.receiveShadow = true
    decor.castShadow = true
  }
  const anchors = lower ? [[-3.1, -.77, 1.95], [3.04, -1.13, .83]] : [[-3.12, -1.02, 1.7], [1.78, .27, .92], [3.57, -.79, 1.32]]
  for (const [x, z, size] of anchors) {
    const shade = shadow(texture, .28, size, size * .78)
    shade.position.set(x + .17, .082, z + .14)
    group.add(shade)
  }
  const fire = mesh(new T.ConeGeometry(.27, .58, 6), '#ffbd61', group, 0, .3, -1.46)
  fire.material.emissive.set('#ec7836')
  const lamp = mesh(poly(1), '#ffeac1', group, 2.98, .35, -1.58)
  lamp.scale.setScalar(.15)
  lamp.material.emissive.set('#fba34f')
  return { fire, lamp }
}

export function fireflies(group: T.Group, texture: T.Texture, count: number, seed: number) {
  const positions = Array.from({ length: count }, (_, i) => {
    const n = i * 3 + seed * 53
    return [(noise(n) - .5) * 6.8, .35 + noise(n + 1) * 1.1, (noise(n + 2) - .5) * 3.8]
  }).flat()
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  const swarm = new T.Points(geometry, new T.PointsMaterial({
    color: '#ffe09a', map: texture, size: 4, sizeAttenuation: false, toneMapped: false,
    transparent: true, blending: T.AdditiveBlending, depthWrite: false,
  }))
  swarm.visible = false
  group.add(swarm)
  return swarm
}
