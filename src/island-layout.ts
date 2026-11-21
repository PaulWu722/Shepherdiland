import { islandWidth } from './island-model.ts'

// Orthographic foreshortening at 35 degrees makes this about 24% on screen.
const standingHeight = islandWidth * .288

export function islandSlot(index: number, count: number, compact: boolean) {
  if (compact) return { x: 0, z: 0, height: standingHeight, walk: .27, nameWidth: 3.2 }
  if (count < 4) {
    const spacing = count === 3 ? 2.55 : 3.15
    return {
      x: (index - (count - 1) / 2) * spacing,
      z: count === 3 && index !== 1 ? .48 : -.47,
      height: standingHeight, walk: .26, nameWidth: spacing - .65,
    }
  }
  if (count === 4) {
    const outer = index === 0 || index === 3
    return {
      x: (index < 2 ? -1 : 1) * (outer ? 2.68 : 1.33),
      z: outer ? 1.04 : -1.17,
      height: standingHeight, walk: .23, nameWidth: 2.04,
    }
  }
  const columns = Math.ceil(Math.sqrt(count * 1.4))
  const rows = Math.ceil(count / columns)
  const column = index % columns, row = Math.floor(index / columns)
  const columnsInRow = Math.min(columns, count - row * columns)
  const dx = 5.66 / (columns - .5), dz = 2.53 / (rows - 1)
  const gap = Math.min(dx, dz)
  return {
    x: (column - (columnsInRow - 1) / 2 + (row % 2 ? .25 : -.25)) * dx,
    z: -.96 + row * dz,
    height: Math.min(standingHeight, gap * 1.13),
    walk: Math.min(.22, gap * .1), nameWidth: dx * .77,
  }
}

export function animationPreview(params: URLSearchParams) {
  const mood = params.get('mood')
  return { mood: mood !== null && /^[0-3]$/.test(mood) ? Number(mood) : null, attention: params.get('attention') === '1' }
}
