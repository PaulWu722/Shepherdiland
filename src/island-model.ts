import * as T from 'three'

export const islandWidth = 9.44
const islandDepth = 5.72
const surfaces = new WeakMap<T.Group, ReturnType<typeof buildSurface>>()

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
  const ray = new T.Raycaster(new T.Vector3(), new T.Vector3(0, -1, 0))
  const normal = new T.Vector3(), normalMatrix = new T.Matrix3()
  const mid: number[] = []
  const samples = Array.from({ length: columns }, (_, i) => Array.from({ length: rows }, (_, j) => {
    ray.ray.origin.set(x0 + i * stepX, bounds.max.y * scale + 1, z0 + j * stepZ)
    const heights = ray.intersectObject(model).filter(hit => hit.face &&
      normal.copy(hit.face.normal).applyNormalMatrix(normalMatrix.getNormalMatrix(hit.object.matrixWorld)).y > .5
    ).map(hit => hit.point.y)
    if (heights.length && Math.hypot(i / (columns - 1) - .5, j / (rows - 1) - .5) < .32) mid.push(heights[0])
    return heights
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
