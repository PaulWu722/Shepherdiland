export const schools = ['亞洲大學', '朝陽科技大學']
export const levels = ['冷淡', '禮貌', '有興趣', '想讀經', '固定讀經']
export const colors = ['#a0a7b4', '#639bd9', '#65b595', '#e6b94f', '#db8d32']
export const moods = ['開心', '有點失落', '沮喪', '很久沒見']
export const faces = ['😊', '😐', '😢', '💤']
export const methods = ['見面', 'LINE', 'IG', '電話']
export const id = () => crypto.randomUUID()
export const day = (offset = 0, base = new Date()) => {
  const date = new Date(base)
  date.setDate(date.getDate() + offset)
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}
export const monday = (now = new Date()) => day(-((now.getDay() + 6) % 7), now)
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000)
export type Goal = { frequency_mode: 'interval' | 'weekly'; frequency_value: number }
export type Contact = Goal & { id: string; name: string; school: string; department: string; grade: string; openness: number; line_id: string; line_type: string; instagram: string; introduction: string; notes: string; hair: string; shirt: string; last_contact: string | null; bible_progress: { book: string; chapter: number; total: number } | null; life_updates: string }
export type Interaction = { id: string; contact_id: string; date: string; method: string; summary: string; topics: string[]; ai: Analysis | null; created_at: string }
export type Appointment = { id: string; contact_id: string; date: string; time: string; location: string; scripture: string; status: string }
export type Prayer = { id: string; contact_id: string; content: string; date: string; answered: boolean }
export type Screenshot = { id: string; contact_id: string; interaction_id: string; storage_path: string; uploaded_at: string; position: number }
export type Advice = { topics: string[]; remember: string; care: string; opener: string; preparation: string }
export type Suggestion = { id: string; contact_id: string; content: Advice; generated_at: string; interaction_id: string | null; feedback: number }
export type Settings = Goal & { weekly_target: number; defaults: Record<string, Goal>; attention: boolean; pace: number; vibration: boolean; notifications: boolean }
export type Analysis = { summary: string; topics: string[]; appointment: { date: string; time: string; location: string; scripture: string } | null; prayer_requests: string[]; bible_progress: Contact['bible_progress']; life_updates: string; openness_hint: { level: number; reason: string } | null; follow_ups: string[]; chat_date: string }
export type State = { contacts: Contact[]; interactions: Interaction[]; appointments: Appointment[]; prayer_requests: Prayer[]; screenshots: Screenshot[]; suggestions: Suggestion[]; settings: Settings }
export const defaults: Settings = { frequency_mode: 'interval', frequency_value: 2, weekly_target: 5, defaults: {}, attention: true, pace: 1, vibration: false, notifications: false }
const empty = (): State => ({ contacts: [], interactions: [], appointments: [], prayer_requests: [], screenshots: [], suggestions: [], settings: defaults })
export function demoAdvice(name: string, upcoming = false): Advice {
  return { topics: ['最近上課或社團有什麼新鮮事？', '最近有哪一段經文讓你印象深刻？', '這週有沒有想一起禱告的事？'], remember: '先接續上次提過的校園生活。', care: '留些空間讓對方按自己的步調分享。', opener: `嗨 ${name}，今天想到你，祝你這週順利。有空再聊～`, preparation: upcoming ? '先確認時間、地點並預備約好的經文。' : '' }
}
export function seed(): State {
  const state = empty()
  const names = ['林晨禾', '周星語', '許沐晴', '江小嶼', '方予安', '陳禾希']
  const offsets = [0, -3, -7, -33, 0, -1]
  names.forEach((name, i) => {
    const contact = id()
    const interaction = id()
    const date = day(offsets[i])
    state.contacts.push({ id: contact, name, school: schools[i % 2], department: ['心理系', '資工系', '社工系', '設計系', '護理系', '應英系'][i], grade: '大二', openness: i % 5 + 1, line_id: '', line_type: 'personal', instagram: '', introduction: '校園活動認識（虛構）', notes: '', hair: i % 2 ? 'long' : 'short', shirt: ['#e5aa75', '#72b6a1', '#b495cf'][i % 3], last_contact: date, frequency_mode: i === 4 ? 'weekly' : 'interval', frequency_value: i === 4 ? 3 : 2, bible_progress: i === 0 ? { book: '約翰福音', chapter: 3, total: 21 } : null, life_updates: '最近在準備課堂報告。' })
    state.interactions.push({ id: interaction, contact_id: contact, date, method: '見面', summary: '聊了近期的課業與校園生活。', topics: ['課業'], ai: null, created_at: new Date().toISOString() })
    state.suggestions.push({ id: id(), contact_id: contact, content: demoAdvice(name, i < 2), interaction_id: interaction, generated_at: new Date().toISOString(), feedback: 0 })
    if (i < 2) state.appointments.push({ id: id(), contact_id: contact, date: day(), time: i === 0 ? '12:30' : '17:00', location: i === 0 ? '亞洲大學圖書館' : '朝陽科技大學圖書館', scripture: i === 0 ? '約翰福音 3:16' : '詩篇 23:1', status: 'planned' })
  })
  return state
}
export function status(contact: Contact, interactions: Interaction[], now = new Date()) {
  const today = day(0, now)
  const elapsed = contact.last_contact ? Math.max(0, daysBetween(today, contact.last_contact)) : Infinity
  const count = interactions.filter(row => row.contact_id === contact.id && row.date >= monday(now) && row.date <= today).length
  const target = contact.frequency_value
  const weekly = contact.frequency_mode === 'weekly'
  const weekday = (now.getDay() + 6) % 7 + 1
  const expected = Math.ceil(target * weekday / 7)
  const overdue = weekly ? (expected - count) / target : elapsed / target - 1
  const mood = elapsed === 0 || (weekly && count >= target) ? 0
    : elapsed > 30 || (!weekly && elapsed > target * 5) ? 3
      : weekly ? (count + 7 - weekday < target ? 2 : count < expected ? 1 : 0)
        : overdue > 1 ? 2 : overdue > 0 ? 1 : 0
  return { elapsed, count, mood, overdue, linked: count > 0 || (!!contact.last_contact && contact.last_contact >= monday(now) && contact.last_contact <= today) }
}
export function latest(state: State, contact: string) {
  return state.interactions.filter(row => row.contact_id === contact).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
}
