import { islandWidth } from './island-model.ts'

// Fit the 720 × 1280 composition by width, with the camera anchored to the top.
export const elevation = 35 * Math.PI / 180
export const compositionWidth = 12.15
// Set the upper island back along the view axis so its shadow clears the lower grass.
export const platforms = [
  { x: -.10, y: 1.16, z: -4.79, scale: .92, relief: 1, signDepth: 2.48, memberDepth: 0 },
  { x: -.18, y: -.95, z: 1.05, scale: 1, relief: .8, signDepth: 1.14, memberDepth: -.32 },
]
export const compositionTop = platforms[0].y * Math.cos(elevation) -
  platforms[0].z * Math.sin(elevation) + compositionWidth * (320 / 720)
const standingHeight = islandWidth * .24

export function islandSlot(index: number, count: number, compact: boolean) {
  if (compact) return { x: 0, z: 0, height: islandWidth * .144, walk: .27, nameWidth: 3.2 }
  if (count < 4) {
    const spacing = count === 3 ? 2.55 : 4.35
    return {
      x: (index - (count - 1) / 2) * spacing,
      z: count === 3 && index === 1 ? -.14 : .35,
      height: standingHeight, walk: .26, nameWidth: spacing - .65,
    }
  }
  if (count === 4) {
    const outer = index === 0 || index === 3
    return {
      x: (index < 2 ? -1 : 1) * (outer ? 2.68 : 1.33),
      z: outer ? 1.55 : -.22,
      height: standingHeight * .91, walk: .23, nameWidth: 2.04,
    }
  }
  const columns = Math.ceil(Math.sqrt(count * 1.4))
  const rows = Math.ceil(count / columns)
  const column = index % columns, row = Math.floor(index / columns)
  const columnsInRow = Math.min(columns, count - row * columns)
  const dx = 5.66 / (columns - .5), dz = 2.4 / (rows - 1)
  const gap = Math.min(dx, dz)
  return {
    x: (column - (columnsInRow - 1) / 2 + (row % 2 ? .25 : -.25)) * dx,
    z: -.52 + row * dz,
    height: Math.min(standingHeight * .91, gap * 1.13),
    walk: Math.min(.22, gap * .1), nameWidth: dx * .77,
  }
}

export function animationPreview(params: URLSearchParams) {
  const mood = params.get('mood')
  return { mood: mood !== null && /^[0-3]$/.test(mood) ? Number(mood) : null, attention: params.get('attention') === '1' }
}
