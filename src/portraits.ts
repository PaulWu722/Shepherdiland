import { demoLook } from './model'
import type { Contact } from './model'

export function portrait(contact?: Contact, classes = '', mood?: string) {
  const look = demoLook(contact)
  const long = (look?.hair ?? contact?.hair) === 'long'
  const color = look?.shirt ?? contact?.shirt ?? ''
  const shirt = /^#[0-9a-f]{6}$/i.test(color) ? color : '#799259'
  const label = mood ? `role="img" aria-label="${mood}"` : 'aria-hidden="true"'
  const fallback = `<svg viewBox="0 0 80 80" aria-hidden="true">
    ${long ? '<path fill="#573629" d="M13 41Q8 7 40 5q32 1 29 36l3 17q-9 15-31 7Q19 73 8 61z"/>' : ''}
    <path fill="${shirt}" d="M10 80c2-17 11-22 26-24h9c15 2 23 7 26 24z"/>
    <path fill="#e6a67d" d="M33 53h14v11l-7 4-7-4z"/>
    <circle cx="18" cy="43" r="6" fill="#edb187"/><circle cx="62" cy="43" r="6" fill="#edb187"/>
    <path fill="#ffd0a7" d="M17 35q0-20 23-20t23 20v10c0 12-12 20-23 20s-23-8-23-20z"/>
    <path fill="#523429" d="${long ? 'M14 41C9 18 20 6 40 6c22 0 34 16 24 36C58 28 42 32 33 19c-2 9-11 16-19 22z' : 'M15 42C9 29 13 14 20 13L17 8l15 3 7-6 4 5c14-2 24 7 25 17l-3 15-8-13-8 5 1-11-18 8 2-9z'}"/>
    <path d="M26 36q4-3 8-1m12 0q4-2 8 1" fill="none" stroke="#664233" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="30" cy="43" rx="3.6" ry="4.6" fill="#342218"/><ellipse cx="50" cy="43" rx="3.6" ry="4.6" fill="#342218"/>
    <circle cx="29" cy="41.5" r="1.3" fill="#fff"/><circle cx="49" cy="41.5" r="1.3" fill="#fff"/>
    <path d="M36 54q4 4 8 0" fill="none" stroke="#9c5140" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="23" cy="50" rx="4.5" ry="2.4" fill="#ed9b90"/><ellipse cx="57" cy="50" rx="4.5" ry="2.4" fill="#ed9b90"/>
  </svg>`
  return `<span class="portrait ${classes}" style="--portrait-bg:${look?.backdrop ?? '#f2e2c8'}" ${label}>${fallback}${look ? `<img src="${import.meta.env.BASE_URL}avatars/${look.avatar}.png" alt="" width="160" height="160" decoding="async">` : ''}</span>`
}
