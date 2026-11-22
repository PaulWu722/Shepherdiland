import { icon } from './icons'
import { demoLook, faces, levels, moods } from './model'
import type { Contact, Settings } from './model'
import { animationPreview, avatarKey, islandSlot, platforms, referenceWidth, worldHeight } from './island-layout'
import type { Platform, Point } from './island-layout'

export type IslandMember = { contact: Contact; mood: number; linked: boolean; count: number }
export const periods = ['晨光', '白日', '黃昏', '夜晚']

export function localPeriod() {
  const h = new Date().getHours()
  return h < 5 || h >= 19 ? 3 : h < 10 ? 0 : h < 16 ? 1 : 2
}

const files = new Set(Object.keys(import.meta.glob('/public/{islands,sprites}/**/*.webp')))
const steps = new WeakMap<object, number>()
const phrases = ['我在這裡！', '來找我聊聊～', '好久不見😢', '想你了']
const random = (low: number, high: number) => low + Math.random() * (high - low)
const cqw = (pixels: number) => `${pixels / referenceWidth * 100}cqw`
const pct = (fraction: number) => `${fraction * 100}%`

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string) {
  const node = document.createElement(tag)
  node.className = className
  return node
}

function artwork(box: HTMLElement, image: HTMLImageElement, path: string) {
  if (image.dataset.path === path) return
  image.dataset.path = path
  box.classList.remove('has-art')
  if (path) image.src = import.meta.env.BASE_URL + path
  else image.removeAttribute('src')
}

function artImage(box: HTMLElement, className = '') {
  const image = element('img', className)
  image.alt = ''
  image.draggable = false
  image.onload = () => box.classList.add('has-art')
  image.onerror = () => box.classList.remove('has-art')
  box.append(image)
  return image
}

type Activity = 'idle' | 'walk' | 'wave' | 'hop' | 'sigh' | 'attention' | 'tap' | 'flight' | 'recover'
type Slot = ReturnType<typeof islandSlot>
type Actor = {
  button: HTMLButtonElement
  visual: HTMLElement
  image: HTMLImageElement
  tagName: HTMLElement
  tagMood: HTMLElement
  expression: HTMLElement
  speech: HTMLElement
  row: IslandMember
  platform: Platform
  key: string
  mood: number
  slot: Slot
  assignment: string
  point: Point
  activity: Activity
  idleTimer: number
  attentionTimer: number
  flight?: Animation
  pendingRecovery?: boolean
}

export function mountIsland(host: HTMLElement, choose: (id: string) => void, compact = false) {
  // Moonlight as a channel multiply: CSS hue-rotate turned skin and grass teal.
  if (!document.getElementById('island-night')) document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
    <filter id="island-night" color-interpolation-filters="sRGB"><feColorMatrix values=".52 .04 .04 0 0  .04 .58 .06 0 0  .06 .09 .86 0 .03  0 0 0 1 0"/></filter>
    <filter id="sprite-night" color-interpolation-filters="sRGB"><feColorMatrix values=".74 .03 .03 0 0  .03 .78 .04 0 0  .04 .06 .93 0 .02  0 0 0 1 0"/></filter></svg>`)
  const preview = animationPreview(new URLSearchParams(import.meta.env.DEV ? location.search : ''))
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const camera = element('div', compact ? 'island-scene island-compact' : 'island-scene')
  if (compact) camera.setAttribute('aria-hidden', 'true')
  host.prepend(camera)
  const landscape = element('div', 'island-landscape')
  camera.append(landscape)
  const layers = {} as Record<Platform, HTMLElement>
  for (const name of (compact ? ['bottom'] : ['top', 'bottom']) as Platform[]) {
    const platform = platforms[name]
    const layer = element('div', `island-layer island-${name}`)
    if (!compact) Object.assign(layer.style, {
      left: pct(platform.left / referenceWidth), top: pct(platform.top / worldHeight),
      width: pct(platform.width / referenceWidth), height: pct(platform.height / worldHeight),
    })
    const art = element('div', 'island-art')
    art.setAttribute('aria-hidden', 'true')
    const path = `islands/${name}.webp`
    artwork(art, artImage(art), files.has('/public/' + path) ? path : '')
    layer.append(art)
    if (!compact) {
      const sign = element('span', 'island-sign')
      sign.style.top = pct(platform.sign)
      sign.innerHTML = icon('people')
      sign.append(name === 'top' ? '本週已聯繫' : '待聯繫')
      layer.append(sign)
    }
    layers[name] = layer
    landscape.append(layer)
  }
  if (!compact) {
    const fireflies = element('div', 'island-fireflies')
    fireflies.setAttribute('aria-hidden', 'true')
    for (const [i, [x, y]] of [[.16, .43], [.48, .40], [.84, .53], [.25, .74], [.56, .81], [.87, .84]].entries()) {
      const light = element('i', '')
      Object.assign(light.style, { left: pct(x), top: pct(y), animationDelay: `-${i * .83}s` })
      fireflies.append(light)
    }
    landscape.append(fireflies)
  }

  const actors = new Map<string, Actor>()
  let preferences: Settings
  let focus: Actor | undefined
  let focusTimer = 0
  let covered = false

  function clearTimers(actor: Actor) {
    window.clearTimeout(actor.idleTimer)
    window.clearTimeout(actor.attentionTimer)
  }

  function appearance(actor: Actor, activity: Activity, message = '') {
    actor.activity = activity
    actor.button.dataset.activity = activity
    actor.speech.textContent = message
    const waving = ['wave', 'attention', 'tap', 'flight', 'recover'].includes(activity)
    const pose = waving ? 'wave' : actor.mood === 3 ? 'sit' : actor.mood === 2 ? 'sad' : 'stand'
    const dir = `sprites/${actor.key}/`
    const path = [pose, 'stand'].map(name => `${dir}${name}.webp`).find(file => files.has('/public/' + file))
    actor.visual.dataset.pose = pose
    artwork(actor.visual, actor.image, path ?? '')
    stepFrames(actor)
  }

  function place(actor: Actor, point: Point, duration = 0) {
    const { width, height } = platforms[actor.platform]
    actor.point = point
    const { style } = actor.button
    style.setProperty('--foot-x', cqw(point.x * width))
    style.setProperty('--foot-y', cqw(point.y * height))
    style.setProperty('--walk-time', `${duration}ms`)
    style.zIndex = String(10 + Math.round(point.y * 1000))
  }

  function stopWalking(actor: Actor) {
    if (actor.activity !== 'walk') return
    const layer = layers[actor.platform].getBoundingClientRect()
    const rect = actor.button.getBoundingClientRect()
    if (!layer.width || !layer.height) return
    place(actor, {
      x: (rect.left + rect.width / 2 - layer.left) / layer.width,
      y: (rect.bottom - layer.top) / layer.height,
    })
  }

  // Roam the whole grass ellipse, preferring spots away from everyone else's destination.
  function wanderPoint(actor: Actor): Point {
    const { grass } = platforms[actor.platform]
    const others = [...actors.values()].filter(other => other !== actor && other.platform === actor.platform).map(other => other.point)
    let best = actor.point, bestGap = -1
    for (let i = 0; i < 24; i++) {
      const angle = random(0, 2 * Math.PI), distance = Math.sqrt(Math.random()) * .8
      const point = { x: grass.x + grass.rx * distance * Math.cos(angle), y: grass.y + grass.ry * distance * Math.sin(angle) }
      const gap = Math.min(1, ...others.map(other => Math.hypot(other.x - point.x, (other.y - point.y) * 2.4)))
      if (gap > bestGap) { best = point; bestGap = gap }
      if (gap > .3) break
    }
    return best
  }

  function stepFrames(actor: Actor) {
    window.clearInterval(steps.get(actor))
    const frames = ['walk1', 'walk2'].map(name => `sprites/${actor.key}/${name}.webp`)
    if (actor.activity !== 'walk' || actor.mood > 1 || !frames.every(file => files.has('/public/' + file))) return
    for (const file of frames) new Image().src = import.meta.env.BASE_URL + file
    let i = 0
    // Swap src directly so the placeholder never flashes between cached frames.
    steps.set(actor, window.setInterval(() => { actor.image.src = import.meta.env.BASE_URL + frames[i++ % 2]; actor.image.dataset.path = frames[(i + 1) % 2] }, actor.mood ? 340 : 230))
  }

  function scheduleMove(actor: Actor) {
    if (reduced.matches || actor.mood === 3 || preview.mood !== null) return
    actor.idleTimer = window.setTimeout(() => {
      const roll = Math.random()
      let duration: number
      if (actor.mood === 0 && roll < .22) {
        appearance(actor, 'wave')
        duration = 1500
      } else if (actor.mood === 0 && roll < .40) {
        appearance(actor, 'hop')
        duration = 540
      } else if (actor.mood === 1 && roll < .26) {
        appearance(actor, 'sigh', '…')
        duration = 1450
      } else {
        const point = wanderPoint(actor)
        const { width, height } = platforms[actor.platform]
        const meters = Math.hypot((point.x - actor.point.x) * width, (point.y - actor.point.y) * height)
        duration = Math.max(700, meters / [62, 38, 24][actor.mood] * 1000)
        actor.button.style.setProperty('--facing', point.x < actor.point.x ? '-1' : '1')
        appearance(actor, 'walk')
        place(actor, point, duration)
      }
      actor.idleTimer = window.setTimeout(() => {
        appearance(actor, 'idle')
        scheduleMove(actor)
      }, duration)
    }, random(1050, 2600))
  }

  function resume(actor: Actor, stagger = 0) {
    clearTimers(actor)
    appearance(actor, 'idle')
    if (compact) return
    if (actor.mood && preferences.attention && preview.attention) {
      appearance(actor, 'attention', phrases[stagger % phrases.length])
      return
    }
    scheduleMove(actor)
    if (!actor.mood || !preferences.attention || preview.mood !== null) return
    const pace = preferences.pace > 0 ? preferences.pace : 1
    actor.attentionTimer = window.setTimeout(() => {
      window.clearTimeout(actor.idleTimer)
      stopWalking(actor)
      actor.button.style.setProperty('--facing', '1')
      appearance(actor, 'attention', phrases[Math.floor(random(0, phrases.length))])
      actor.attentionTimer = window.setTimeout(() => resume(actor), random(3000, 4000))
    }, (stagger ? 4000 + (stagger % 6) * 360 : random(4000, 6000)) / pace)
  }

  function reset() {
    window.clearTimeout(focusTimer)
    camera.classList.remove('is-focusing')
    camera.style.transform = ''
    const previous = focus
    focus = undefined
    if (previous && actors.has(previous.row.contact.id)) resume(previous)
  }

  function select(actor: Actor) {
    if (compact || focus || actor.flight) return
    const id = actor.row.contact.id
    if (reduced.matches) { choose(id); return }
    clearTimers(actor)
    stopWalking(actor)
    const frame = host.getBoundingClientRect()
    const person = actor.button.getBoundingClientRect()
    const zoom = 1.9
    const x = frame.width / 2 - (person.left + person.width / 2 - frame.left) * zoom
    const y = frame.height / 2 - (person.top + person.height / 2 - frame.top) * zoom
    focus = actor
    actor.button.style.setProperty('--facing', '1')
    appearance(actor, 'tap')
    camera.classList.add('is-focusing')
    camera.style.transform = `translate(${x}px,${y}px) scale(${zoom})`
    focusTimer = window.setTimeout(() => {
      try { choose(id) } finally { reset() }
    }, 600)
  }

  function create(row: IslandMember, platform: Platform, slot: Slot, mood: number, key: string, assignment: string) {
    const button = element('button', 'island-avatar')
    button.type = 'button'
    button.disabled = compact
    button.dataset.member = row.contact.id
    button.innerHTML = `
      <span class="avatar-motion" aria-hidden="true">
        <span class="sprite-visual"><span class="sprite-placeholder"><i></i><b></b></span></span>
        <span class="avatar-cloud"></span><span class="attention-bubble">!!</span>
        <span class="avatar-speech"></span><span class="avatar-sparkle">♡ ✧ ♥</span>
      </span>
      <span class="avatar-label"><span class="nametag"><span class="nametag-name"></span><span class="nametag-mood"></span></span></span>`
    const visual = button.querySelector<HTMLElement>('.sprite-visual')!
    const tagName = button.querySelector<HTMLElement>('.nametag-name')!
    const tagMood = button.querySelector<HTMLElement>('.nametag-mood')!
    const expression = button.querySelector<HTMLElement>('.sprite-placeholder i')!
    const speech = button.querySelector<HTMLElement>('.avatar-speech')!
    const actor: Actor = {
      button, visual, image: artImage(visual), tagName, tagMood, expression, speech,
      row, platform, mood, key, slot, assignment, point: slot, activity: 'idle', idleTimer: 0, attentionTimer: 0,
    }
    button.onclick = () => select(actor)
    layers[platform].append(button)
    actors.set(row.contact.id, actor)
    return actor
  }

  function celebrate(actor: Actor, from?: DOMRect) {
    clearTimers(actor)
    actor.button.style.setProperty('--facing', '1')
    const to = actor.button.getBoundingClientRect()
    const width = host.clientWidth
    if (from?.width && to.width && width && !reduced.matches && camera.style.transform === '') {
      const dx = from.left + from.width / 2 - to.left - to.width / 2
      const dy = from.bottom - to.bottom
      const arc = Math.min(width * .15, Math.abs(dy) * .27 + 12)
      const relative = (pixels: number) => `${pixels / width * 100}cqw`
      appearance(actor, 'flight')
      const path = [0, .2, .4, .6, .8, 1].map(progress => {
        const remaining = 1 - progress
        const lift = 4 * arc * progress * remaining
        return { translate: `${relative(dx * remaining)} ${relative(dy * remaining - lift)}` }
      })
      actor.flight = actor.button.animate(path, { duration: 920, easing: 'cubic-bezier(.25,.52,.46,1)' })
      if (covered) actor.flight.pause()
      actor.flight.onfinish = () => {
        actor.flight = undefined
        celebrate(actor)
      }
      return
    }
    if (covered) {
      actor.pendingRecovery = true
      appearance(actor, 'idle')
      return
    }
    actor.pendingRecovery = false
    appearance(actor, 'recover')
    actor.idleTimer = window.setTimeout(() => resume(actor), 1000)
  }

  function rearrange(actor: Actor) {
    const { slot, button, platform } = actor
    button.style.setProperty('--sprite-height', cqw(slot.height))
    button.style.setProperty('--sprite-width', cqw(slot.width))
    button.style.setProperty('--tag-width', cqw(slot.nameWidth))
    button.style.setProperty('--tag-size', cqw(slot.nameSize))
    button.style.setProperty('--seat-label', `${slot.seatLabel}%`)
    if (button.parentElement !== layers[platform]) layers[platform].append(button)
    place(actor, slot)
  }

  function motionChanged() {
    const selected = focus
    if (selected) {
      try { choose(selected.row.contact.id) } finally { reset() }
    }
    for (const actor of actors.values()) {
      const wasFlying = Boolean(actor.flight)
      actor.flight?.cancel()
      actor.flight = undefined
      stopWalking(actor)
      if (wasFlying) celebrate(actor)
      else resume(actor)
    }
  }
  reduced.addEventListener('change', motionChanged)

  // Roaming people cross paths, so lift the farther-back tag whenever two tags overlap.
  function separateTags() {
    if (compact || document.hidden) return
    for (const platform of Object.keys(platforms) as Platform[]) {
      const boxes = [...actors.values()].filter(actor => actor.platform === platform).map(actor => {
        const label = actor.button.querySelector<HTMLElement>('.avatar-label')!
        const lift = Number.parseFloat(actor.button.style.getPropertyValue('--tag-lift')) || 0
        const rect = label.getBoundingClientRect()
        return { actor, left: rect.left, right: rect.right, height: rect.height, bottom: rect.bottom + lift, lift: 0 }
      }).sort((a, b) => b.bottom - a.bottom)
      const placed: typeof boxes = []
      for (const box of boxes) {
        for (const other of placed) {
          const top = other.bottom - other.lift - other.height
          if (box.left < other.right + 3 && box.right > other.left - 3 && box.bottom - box.lift > top - 2) box.lift = box.bottom - top + 2
        }
        box.actor.button.style.setProperty('--tag-lift', `${Math.round(box.lift)}px`)
        placed.push(box)
      }
    }
  }
  const tagTimer = window.setInterval(separateTags, 200)

  return {
    reset,
    setCovered(value: boolean) {
      covered = value
      for (const actor of actors.values()) {
        if (actor.flight) {
          if (covered) actor.flight.pause()
          else actor.flight.play()
        } else if (!covered && actor.pendingRecovery) celebrate(actor)
      }
    },
    period(value: number | null) { host.dataset.period = String(value ?? localPeriod()) },
    update(rows: IslandMember[], settings: Settings) {
      const settingsChanged = settings.attention !== preferences?.attention || settings.pace !== preferences?.pace
      preferences = settings
      const ids = new Set(rows.map(({ contact }) => contact.id))
      for (const [id, actor] of actors) {
        if (ids.has(id)) continue
        clearTimers(actor)
        actor.flight?.cancel()
        actor.button.remove()
        actors.delete(id)
        if (focus === actor) reset()
      }
      const order = (row: IslandMember) => demoLook(row.contact)?.islandOrder ?? 6
      const sorted = [...rows].sort((a, b) => order(a) - order(b))
      const groups = compact ? [sorted.slice(0, 1)] : [sorted.filter(row => row.linked), sorted.filter(row => !row.linked)]
      groups.forEach((group, i) => {
        const platform = compact || i === 1 ? 'bottom' : 'top'
        group.forEach((row, index) => {
          const { contact } = row
          const mood = preview.mood ?? row.mood
          const key = avatarKey(contact)
          const assignment = `${platform}/${index}/${group.length}/${mood === 3}`
          const slot = islandSlot(platform, index, group.length, mood === 3 && !compact)
          const previous = actors.get(contact.id)
          const actor = previous ?? create(row, platform, slot, mood, key, assignment)
          const moved = previous && actor.platform !== platform
          const from = moved && platform === 'top' ? actor.button.getBoundingClientRect() : undefined
          const recovered = !compact && previous && actor.mood > 0 && mood === 0
          const reflow = !previous || actor.assignment !== assignment
          const restart = reflow || settingsChanged || actor.mood !== mood || actor.key !== key

          if (reflow) {
            actor.flight?.cancel()
            actor.flight = undefined
            actor.pendingRecovery = false
          } else if (restart && actor !== focus && !actor.flight) stopWalking(actor)
          Object.assign(actor, { row, platform, slot, mood, key, assignment })
          actor.button.dataset.mood = String(mood)
          actor.button.setAttribute('aria-label', `${contact.name}・${moods[mood]}`)
          actor.button.title = [contact.name, contact.school, contact.department, levels[contact.openness - 1]].filter(Boolean).join('・')
          actor.tagName.textContent = contact.name
          actor.tagMood.textContent = faces[mood]
          actor.expression.textContent = faces[mood]
          actor.visual.style.setProperty('--shirt', /^#[0-9a-f]{6}$/i.test(contact.shirt) ? contact.shirt : '#98a875')
          if (reflow) rearrange(actor)
          if (actor === focus || actor.flight) return
          if (from || recovered) celebrate(actor, from)
          else if (restart) resume(actor, index + i * 3 + 1)
        })
      })
    },
    dispose() {
      window.clearTimeout(focusTimer)
      window.clearInterval(tagTimer)
      for (const actor of actors.values()) {
        clearTimers(actor)
        actor.flight?.cancel()
      }
      actors.clear()
      reduced.removeEventListener('change', motionChanged)
      camera.remove()
    },
  }
}
