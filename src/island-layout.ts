import { demoLook } from './model.ts'
import type { Contact } from './model.ts'

export const referenceWidth = 720
export const worldHeight = 724

// Reference pixels for the image bounds, with the grass ellipse in image fractions.
export const platforms = {
  top: { left: 94, top: 254, width: 518, height: 258, grass: { x: .50, y: .335, rx: .405, ry: .145 }, sign: .505 },
  bottom: { left: 43, top: 466, width: 619, height: 324, grass: { x: .53, y: .470, rx: .414, ry: .139 }, sign: .565 },
}
export type Platform = keyof typeof platforms
export type Point = { x: number; y: number }

const styles = new Map([
  ['short', 'sage'], ['long', 'rose'], ['curly', 'honey'], ['bob', 'rose'],
  ['pony', 'lavender'], ['swept', 'sky'], ['bun', 'marigold'],
])

export function avatarKey(contact: Contact & { style?: string }) {
  return demoLook(contact)?.avatar ?? styles.get(contact.style ?? contact.hair) ?? 'sage'
}

export function islandSlot(platform: Platform, index: number, count: number, seated = false) {
  const { width, height, grass } = platforms[platform]
  const columns = count <= 8 ? count : Math.ceil(Math.sqrt(count * 1.45))
  const rows = Math.ceil(count / columns)
  const row = Math.floor(index / columns)
  const inRow = Math.min(columns, count - row * columns)
  const rowGap = .202 / Math.max(1, rows - 1)
  const front = rows > 1 ? 0 : platform === 'bottom' ? -.032 : count < 3 ? .006 : -.020
  const y = grass.y + front + (row - (rows - 1) / 2) * rowGap
  const laneWidth = rows > 1 ? .52 : count === 4 ? .85 : .79
  const dx = Math.min(.43, laneWidth / columns)
  const step = Math.min(.034, dx * (rows > 1 ? .055 : count === 4 ? .09 : .14))
  const column = index % columns
  const offset = rows === 1 ? column - (inRow - 1) / 2
    : column + Math.floor((columns - inRow) / 2) - (columns - 1) / 2 + (row % 2 ? .25 : -.25)
  const x = grass.x + offset * dx
  const edge = x < grass.x ? -1 : 1
  const frontSeat = seated && platform === 'bottom' && count === 2
  const nameWidth = Math.min(156, (dx - 2 * step) * width - 6)
  const nameSize = Math.min(22.68, nameWidth / 5.35, rows > 1 ? (rowGap * .72 * height - 2) / 1.67 : Infinity)
  const sprite = count <= 4 ? 109 : Math.min(98, dx * width * .87, rows > 1 ? rowGap * height * 1.5 : Infinity)
  return {
    x: seated && !frontSeat ? x + edge * (count === 1 ? .27 : step) : x,
    y: seated && count === 1 ? grass.y + .04 : frontSeat ? y + .041 : y,
    walkX: seated ? 0 : step,
    walkY: seated ? 0 : rows === 1 ? .028 : Math.min(.013, rowGap * .10),
    height: sprite,
    width: Math.min(sprite * .92, rows === 1 ? (dx - 2 * step) * width - 5 : dx * width * .38),
    nameWidth, nameSize,
    seatLabel: rows === 1 && seated ? 18 : 0,
  }
}

export function animationPreview(params: URLSearchParams) {
  const mood = params.get('mood')
  return { mood: mood !== null && /^[0-3]$/.test(mood) ? Number(mood) : null, attention: params.get('attention') === '1' }
}
