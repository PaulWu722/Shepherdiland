import * as T from 'three'

export const islandWidth = 9.44
const islandDepth = 5.72
const surfaces = new WeakMap<T.Group, ReturnType<typeof buildSurface>>()

function sampleGround(model: T.Group, columns: number, rows: number, x0: number, z0: number, stepX: number, stepZ: number, top: number) {
  const samples = Array.from({ length: columns }, () => Array.from({ length: rows }, () => [] as number[]))
  const { a, b, c } = new T.Triangle()
  const normal = new T.Vector3(), hit = new T.Vector3()
  const ray = new T.Ray(new T.Vector3(0, top, 0), new T.Vector3(0, -1, 0))
  // Visit each triangle once, testing only grid points inside its projected bounds.
  model.traverse(child => {
    if (!(child instanceof T.Mesh)) return
    const index = child.geometry.index
    const positions = child.geometry.getAttribute('position')
    for (let i = 0; i + 2 < (index?.count ?? positions.count); i += 3) {
      a.fromBufferAttribute(positions, index ? index.getX(i) : i).applyMatrix4(child.matrixWorld)
      b.fromBufferAttribute(positions, index ? index.getX(i + 1) : i + 1).applyMatrix4(child.matrixWorld)
      c.fromBufferAttribute(positions, index ? index.getX(i + 2) : i + 2).applyMatrix4(child.matrixWorld)
      if (T.Triangle.getNormal(a, b, c, normal).y <= .5) continue
      const left = Math.max(0, Math.ceil((Math.min(a.x, b.x, c.x) - x0) / stepX))
      const right = Math.min(columns - 1, Math.floor((Math.max(a.x, b.x, c.x) - x0) / stepX))
      const back = Math.max(0, Math.ceil((Math.min(a.z, b.z, c.z) - z0) / stepZ))
      const front = Math.min(rows - 1, Math.floor((Math.max(a.z, b.z, c.z) - z0) / stepZ))
      for (let x = left; x <= right; x++) for (let z = back; z <= front; z++) {
        ray.origin.x = x0 + x * stepX
        ray.origin.z = z0 + z * stepZ
        if (ray.intersectTriangle(a, b, c, true, hit)) samples[x][z].push(hit.y)
      }
    }
  })
  return samples
}

function buildSurface(source: T.Group) {
  if (source.getObjectByProperty('type', 'SkinnedMesh')) return
  const object = new T.Group(), model = new T.Group()
  object.add(model)
  model.add(source.clone())
  const bounds = new T.Box3().setFromObject(model)
  const size = bounds.getSize(new T.Vector3())
  if (!Number.isFinite(size.x + size.y + size.z) || Math.min(size.x, size.y, size.z) <= 0) return
  const scale = islandWidth / size.x
  const depth = Math.min(size.z * scale, islandDepth)
  const depthScale = depth / size.z
  const center = bounds.getCenter(new T.Vector3())
  // Keep deep meshes within the existing camera framing of the two platforms.
  model.scale.set(scale, scale, depthScale)
  model.position.set(-center.x * scale, 0, -center.z * depthScale)
  object.updateMatrixWorld(true)

  // Props can sit above the grass. Find the main surface from the middle of the island.
  const columns = 15, rows = 13
  const stepX = islandWidth / columns, stepZ = depth / rows
  const x0 = (stepX - islandWidth) / 2, z0 = (stepZ - depth) / 2
  const samples = sampleGround(model, columns, rows, x0, z0, stepX, stepZ, bounds.max.y * scale + 1)
  const mid: number[] = []
  samples.forEach((column, i) => column.forEach((heights, j) => {
    heights.sort((a, b) => b - a)
    if (heights.length && Math.hypot(i / (columns - 1) - .5, j / (rows - 1) - .5) < .32) mid.push(heights[0])
  }))
  if (!mid.length) return
  mid.sort((a, b) => a - b)
  const datum = mid[mid.length >> 1]
  const stretch = datum - bounds.min.y * scale < islandWidth * .31 ? 1.32 : 1
  model.scale.y *= stretch
  model.position.y = -datum * stretch

  let left = columns, right = -1, back = rows, front = -1
  const floor = samples.map((column, i) => column.map((heights, j) => {
    const ground = heights.find(height => Math.abs(height - datum) <= .45)
    if (ground === undefined) return
    left = Math.min(left, i)
    right = Math.max(right, i)
    back = Math.min(back, j)
    front = Math.max(front, j)
    return (ground - datum) * stretch
  }))
  return {
    object,
    xScale: (right - left + 1) * stepX / islandWidth,
    zScale: (front - back + 1) * stepZ / islandDepth,
    groundAt(x: number, z: number) {
      const u = T.MathUtils.clamp((x - x0) / stepX, 0, columns - 1)
      const v = T.MathUtils.clamp((z - z0) / stepZ, 0, rows - 1)
      const i0 = Math.min(Math.floor(u), columns - 2), j0 = Math.min(Math.floor(v), rows - 2)
      let height = 0, weight = 0
      for (let i = i0; i <= i0 + 1; i++) for (let j = j0; j <= j0 + 1; j++) {
        const y = floor[i][j]
        if (y === undefined) continue
        const w = (1 - Math.abs(i - u)) * (1 - Math.abs(j - v))
        height += y * w
        weight += w
      }
      return weight > 0 ? height / weight : 0
    },
  }
}

export function islandSurface(source: T.Group) {
  if (!surfaces.has(source)) surfaces.set(source, buildSurface(source))
  return surfaces.get(source)
}
