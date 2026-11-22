import './style.css'
import './island2d.css'
import { db, load, cache, saveRows, imageUrl, removeImages, invoke } from './data'
import type { Table } from './data'
import { day, monday, id, schools, levels, colors, moods, faces, methods, defaults, status, latest, demoAdvice } from './model'
import type { Contact, Interaction, Appointment, Prayer, Settings, State, Advice } from './model'
import { mountIsland, localPeriod, periods } from './island2d'
import { chatUpload } from './upload'
import { escape } from './html'
import { icon } from './icons'
import { portrait } from './portraits'

const $ = <T extends HTMLElement = HTMLElement>(selector: string, parent: ParentNode = document) => parent.querySelector<T>(selector)!
const e = escape
const selected = (a: unknown, b: unknown) => a === b ? 'selected' : ''
const checked = (value: boolean) => value ? 'checked' : ''
const options = (items: string[], value: string) => items.map(item => `<option ${selected(value, item)}>${e(item)}</option>`).join('')
const button = (label: string, action: string, value = '', cls = 'soft') => `<button type="button" class="${cls}" data-action="${action}" data-value="${e(value)}">${label}</button>`
const heading = (icon: string, title: string, description = '') => `<header class="section-title"><span aria-hidden="true">${icon}</span><div><h2>${title}</h2>${description ? `<p>${description}</p>` : ''}</div></header>`
const empty = (message: string) => `<p class="empty">${message}</p>`
const fields = (label: string, body: string) => `<label><span>${label}</span>${body}</label>`
const input = (label: string, name: string, value = '', attributes = '') => fields(label, `<input name="${name}" value="${e(value)}" ${attributes}>`)
const area = (label: string, name: string, value = '') => fields(label, `<textarea name="${name}" rows="2">${e(value)}</textarea>`)
const get = (data: FormData, name: string) => String(data.get(name) ?? '').trim()
const openness = (level: number) => `<span class="level" style="--level:${colors[level - 1]}">${levels[level - 1]}</span>`
const targetFields = (pref: Pick<Contact, 'frequency_mode' | 'frequency_value'>, prefix = '') => `<div class="form-grid">${fields('回訪模式', `<select name="${prefix}frequency_mode"><option value="interval" ${selected(pref.frequency_mode, 'interval')}>每隔幾天</option><option value="weekly" ${selected(pref.frequency_mode, 'weekly')}>每週幾次</option></select>`)}${input('天數／次數', prefix + 'frequency_value', String(pref.frequency_value), 'required type="number" min="1" max="365"')}</div>`
const readGoal = (data: FormData, prefix = '') => ({ frequency_mode: get(data, prefix + 'frequency_mode') === 'weekly' ? 'weekly' as const : 'interval' as const, frequency_value: Number(get(data, prefix + 'frequency_value')) })
let state: State, user = '', tab = 'island', expanded = false, period: number | null = null
let detailId: string | null = null, detailScene: ReturnType<typeof mountIsland> | null = null
let month = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
let calendarDay = day()
let filters = { search: '', school: '', department: '', openness: '', mood: '' }
let lastRefresh = '', sessionToken = 0
const photoUrls = new Set<string>()

const backdrop = Object.keys(import.meta.glob('/public/bg/{day,dusk,night}.webp')).map(file => {
  const name = file.slice('/public/bg/'.length, -'.webp'.length)
  const url = import.meta.env.BASE_URL + file.slice('/public/'.length)
  return `<div class="scene-plate plate-${name}" aria-hidden="true" style="background-image:url('${e(url)}')"></div>`
}).join('')
const stage = $('#stage')
stage.innerHTML = backdrop
$('#app').innerHTML = `
 <header class="top"><div class="brand"><span class="mark" aria-hidden="true">🌱</span><div><strong>Shepherdiland</strong><small>我的回訪</small></div></div><div class="top-actions"><span id="mode"></span>${button('⚙', 'settings', '', 'icon settings-button')}</div></header>
 <main id="workspace" hidden>
  <section id="island" aria-label="回訪島嶼">
   <div class="scene" id="world">${backdrop}<div class="scene-caption"><h1>${icon('sprig')}<span>我的回訪</span></h1><div class="scene-ornament" aria-hidden="true">★</div></div><div id="scene-progress"></div><div class="scene-actions"><button type="button" class="icon" data-action="reset" aria-label="重設視角" title="重設視角">${icon('reset')}</button><button type="button" class="icon" data-action="period" aria-label="自動時段" title="自動時段">${icon('period')}</button></div></div>
   <section id="sheet" class="sheet"><button class="sheet-handle" aria-expanded="false" aria-label="展開本週回訪"><span></span></button><div id="overview"></div></section>
  </section>
  <section id="page" hidden></section>
  <nav class="nav" aria-label="主選單">
   ${([['island', 'island', '島嶼'], ['contacts', 'people', '名單'], ['add', 'add', '新增'], ['calendar', 'calendar', '行程'], ['stats', 'stats', '統計']] as const).map(([key, glyph, title]) => button(`${icon(glyph)}<span${key === 'add' ? ' class="sr-only"' : ''}>${title}</span>`, key === 'add' ? 'add' : 'tab', key, key === 'add' ? 'nav-add' : 'nav-item')).join('')}
  </nav>
 </main>
 <section id="auth" hidden></section><dialog id="detail"></dialog><dialog id="modal"></dialog><div id="toast" role="status"></div>`
$('.settings-button').setAttribute('aria-label', '設定')
document.addEventListener('error', event => {
  const image = event.target
  if (image instanceof HTMLImageElement && image.parentElement?.classList.contains('portrait')) image.hidden = true
}, true)
const modal = $<HTMLDialogElement>('#modal'), detail = $<HTMLDialogElement>('#detail')
const world = $('#world')
const scene = mountIsland(world, openDetail)
const todayRows = () => state.appointments.filter(row => row.date === day() && row.status === 'planned').sort((a, b) => a.time.localeCompare(b.time))
const find = (key: string) => state.contacts.find(contact => contact.id === key)
const stateOf = (contact: Contact) => status(contact, state.interactions)
const nextAppointments = (key: string) => state.appointments.filter(row => row.contact_id === key && row.status === 'planned' && `${row.date}T${row.time}` >= `${day()}T${new Date().toTimeString().slice(0, 5)}`).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
const lastText = (elapsed: number) => !Number.isFinite(elapsed) ? '尚未聯繫' : elapsed ? `${elapsed} 天沒聯繫` : '今天聯繫過'
const refreshTheme = () => {
  const current = period ?? localPeriod()
  document.documentElement.dataset.period = stage.dataset.period = world.dataset.period = String(current)
  scene?.period(period)
  detailScene?.period(period)
  const control = $('[data-action="period"]')
  control.title = period === null ? '自動時段' : `時段：${periods[period]}`
  control.setAttribute('aria-label', control.title)
  control.dataset.manual = String(period !== null)
}
refreshTheme()
function progress(count = state.contacts.filter(contact => stateOf(contact).linked).length, goal = state.settings.weekly_target) {
  const fraction = Math.min(100, count / goal * 100)
  return `<div class="progress" role="img" aria-label="本週 ${count}/${goal} 人"><div class="progress-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="progress-track" cx="50" cy="50" r="44"/>${fraction ? `<circle class="progress-value" cx="50" cy="50" r="44" pathLength="100" stroke-dasharray="${fraction} 100"/>` : ''}</svg><div class="progress-center"><small>本週</small><strong>${count}/${goal}</strong></div></div><span class="progress-count" aria-hidden="true">${count}/${goal} 人</span></div>`
}
function links(contact: Contact, big = false) {
  const lineId = encodeURIComponent(contact.line_id.trim())
  const ig = encodeURIComponent(contact.instagram.replace(/^@/, '').trim())
  const link = (href: string, label: string, kind: 'line' | 'ig') => {
    const content = big ? label : icon(kind)
    return href ? `<a class="chat ${kind}" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${label}">${content}</a>` : `<span title="尚未設定 ${kind === 'line' ? 'LINE' : 'IG'}" aria-label="${label}，尚未設定帳號" aria-disabled="true" class="chat ${kind} disabled">${content}</span>`
  }
  return `<div class="chat-links">${link(lineId ? contact.line_type === 'official' ? `https://line.me/R/oaMessage/${lineId}/` : `https://line.me/ti/p/~${lineId}` : '', big ? '用 LINE 聊天' : 'LINE', 'line')}${link(ig ? `https://instagram.com/direct/t/${ig}` : '', big ? '用 IG 聊天' : 'IG', 'ig')}${ig && big ? link(`https://ig.me/m/${ig}`, 'IG 備援', 'ig') : ''}</div>`
}
function person(contact: Contact, onSheet = false) {
  const value = stateOf(contact)
  const level = openness(contact.openness)
  return `<article class="person"><button type="button" class="person-main" data-action="detail" data-value="${e(contact.id)}">${portrait(contact, '', moods[value.mood])}<span class="person-details"><strong>${e(contact.name)}</strong><small>${[contact.school, contact.department].filter(Boolean).map(e).join('・')}</small></span></button>${onSheet ? `<span class="sheet-level" title="敞開程度：${levels[contact.openness - 1]}">${level}</span>` : ''}<div class="person-status">${onSheet ? '' : level}<small class="day-badge ${value.mood >= 2 ? 'day-urgent' : ''}" title="${lastText(value.elapsed)}">${Number.isFinite(value.elapsed) ? `${value.elapsed} 天` : '未聯繫'}</small></div>${links(contact)}</article>`
}
function appointment(row: Appointment, full = false) {
  const time = e(row.time.slice(0, 5))
  const contact = find(row.contact_id)
  const mapUrl = row.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.location)}` : ''
  if (!full) {
    const navigate = (className: string, content: string) => `<a class="${className}" href="${mapUrl}" target="_blank" rel="noopener noreferrer" aria-label="導航至${e(row.location)}">${content}</a>`
    return expanded ? `<article class="appointment today-appointment">
      ${portrait(contact, 'appointment-portrait')}<div class="appointment-summary" title="${e(row.scripture)}"><strong>${time}</strong><span>${e(contact?.name)}</span>${row.scripture ? `<span class="sr-only">${e(row.scripture)}</span>` : ''}</div>
      ${mapUrl ? navigate('appointment-place', e(row.location)) : ''}
    </article>` : `<article class="appointment today-appointment">
      <div class="appointment-summary"><strong>${[time, e(contact?.name), e(row.location), e(row.scripture)].filter(Boolean).join('・')}</strong>${row.location ? `<small>${icon('pin')}${e(row.location)}</small>` : ''}</div>
      ${mapUrl ? navigate('map-button', icon('navigate')) : ''}
    </article>`
  }
  const minutes = Math.ceil((new Date(`${row.date}T${row.time}`).getTime() - Date.now()) / 60000)
  const countdown = minutes <= 0 ? '已到約定時間' : minutes < 60 ? `${minutes} 分鐘後` : minutes < 1440 ? `${Math.floor(minutes / 60)} 小時後` : `${Math.floor(minutes / 1440)} 天後`
  return `<article class="appointment"><div class="appointment-time"><strong>${time}</strong><small>${e(row.date)}</small></div><div><strong>${e(contact?.name)}</strong><small>${e(row.location)}${row.scripture ? `・${e(row.scripture)}` : ''}</small><small>${row.status === 'planned' ? countdown : row.status === 'done' ? '已完成' : '已取消'}</small></div><div class="appointment-actions">${mapUrl ? `<a class="soft" href="${mapUrl}" target="_blank" rel="noopener noreferrer">導航 ↗</a>` : ''}${button('編輯', 'appointment', row.id)}</div></article>`
}
function distribution(onSheet = false) {
  const count = state.contacts.length
  const byLevel = colors.map((_, i) => state.contacts.filter(contact => contact.openness === i + 1).length)
  const byMood = moods.map((_, i) => state.contacts.filter(contact => stateOf(contact).mood === i).length)
  const moodChart = `<section class="card distribution"><h3>心情分布</h3><div class="chips">${moods.map((mood, i) => `<span class="chip">${faces[i]} ${mood}・${byMood[i]} 位</span>`).join('')}</div></section>`
  if (onSheet) return `<section class="sheet-distribution"><h3>敞開程度分布</h3><div class="distribution-bars">${byLevel.map((number, i) => `<div style="--level:${colors[i]}"><span aria-label="${levels[i]} ${number} 位" role="img"></span><strong aria-hidden="true">${number}</strong></div>`).join('')}</div></section><div class="sheet-moods">${moodChart}</div>`
  return `<section class="card distribution"><h3>敞開程度分布</h3><div class="segments">${byLevel.map((number, i) => `<span style="flex:${number || (!count ? 1 : 0)};background:${colors[i]}" title="${levels[i]} ${number} 位"></span>`).join('')}</div><div class="chips">${levels.map((label, i) => `<span style="--level:${colors[i]}" class="level">${label} ${byLevel[i]}</span>`).join('')}</div></section>${moodChart}`
}
function overview() {
  const overdue = state.contacts.map(contact => ({ contact, ...stateOf(contact) })).filter(row => row.mood > 0)
  overdue.sort((a, b) => Number(b.mood === 2) - Number(a.mood === 2) || (b.overdue === a.overdue ? b.mood - a.mood : b.overdue - a.overdue))
  const today = todayRows()
  return `${expanded ? `<div class="sheet-heading"><h1>本週回訪</h1>${progress()}</div>` : ''}
  <div class="overview-grid">
    <section class="today-section"><h2><button type="button" class="sheet-title-button" data-action="tab" data-value="calendar" title="看行程">${expanded ? '' : icon('calendar')}今天的約</button></h2>
    <div class="appointment-list">${(expanded ? today : today.slice(0, 1)).map(row => appointment(row)).join('') || empty('今天還沒有安排約定。')}</div></section>
    <section><h2>${expanded ? '該聯繫了' : `<button type="button" class="sheet-title-button" data-action="expand" title="展開聯繫清單">快快聯繫 ${icon('bell')}</button>`}</h2>
    <div class="people">${overdue.slice(0, expanded ? undefined : 3).map(({ contact }) => person(contact, true)).join('') || empty('目前沒有逾期的回訪。')}</div></section>
  </div>${expanded ? distribution(true) : ''}`
}
function contacts() {
  const departments = [...new Set(state.contacts.map(contact => contact.department))].filter(Boolean).sort()
  return `<div class="page-heading"><div><span class="eyebrow">我的回訪</span><h1>名單</h1><p>共 ${state.contacts.length} 位同學</p></div>${button('＋ 新增成員', 'add', '', 'primary')}</div><section class="card filters"><label><span>搜尋名單</span><input type="search" id="search" placeholder="姓名、學校或科系" value="${e(filters.search)}"></label><div class="form-grid">${[
    ['school', '學校', schools], ['department', '科系', departments], ['openness', '敞開程度', levels], ['mood', '心情', moods],
  ].map(([key, label, values]) => fields(String(label), `<select data-filter="${key}"><option value="">全部</option>${options(values as string[], filters[key as keyof typeof filters])}</select>`)).join('')}</div></section><div id="people-list" class="people"></div>`
}
function filterPeople() {
  const list = document.querySelector('#people-list')
  if (!list) return
  const query = filters.search.trim().toLowerCase()
  list.innerHTML = state.contacts.filter(contact =>
    (!query || [contact.name, contact.school, contact.department].some(value => value.toLowerCase().includes(query))) &&
    (!filters.school || contact.school === filters.school) &&
    (!filters.department || contact.department === filters.department) &&
    (!filters.openness || levels[contact.openness - 1] === filters.openness) &&
    (!filters.mood || moods[stateOf(contact).mood] === filters.mood),
  ).map(contact => person(contact)).join('') || empty('找不到符合條件的成員。')
}
function calendar() {
  const first = (month.getDay() + 6) % 7
  const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const monthLabel = new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long' }).format(month)
  const scheduled = state.appointments.filter(row => row.date === calendarDay).sort((a, b) => a.time.localeCompare(b.time))
  return `<div class="page-heading"><div><span class="eyebrow">我的回訪</span><h1>行程</h1></div>${button('＋ 新增約定', 'new-appointment', '', 'primary')}</div><section class="card calendar"><div class="section-row">${button('‹ 上個月', 'month', '-1')}<h2>${monthLabel}</h2>${button('下個月 ›', 'month', '1')}</div><div class="calendar-grid">${'一二三四五六日'.split('').map(label => `<span>${label}</span>`).join('')}${'<span></span>'.repeat(first)}${Array.from({ length }, (_, i) => {
    const date = day(i, month)
    const has = state.appointments.some(row => row.date === date && row.status === 'planned')
    return button(`${i + 1}${has ? '<i aria-label="有約定"></i>' : ''}`, 'date', date, `calendar-day ${date === calendarDay ? 'current' : ''} ${date === day() ? 'today' : ''}`)
  }).join('')}</div></section><section><h2>${e(calendarDay)} 的約定</h2><div class="appointment-list">${scheduled.map(row => appointment(row, true)).join('') || empty('這一天沒有約定。')}</div></section>`
}
function stats() {
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = day(-7 * (7 - i), new Date(monday() + 'T12:00'))
    const end = day(6, new Date(start + 'T12:00'))
    const count = new Set(state.interactions.filter(row => row.date >= start && row.date <= end).map(row => row.contact_id)).size
    return { start, count }
  })
  const max = Math.max(state.settings.weekly_target, ...weeks.map(week => week.count))
  const current = weeks.at(-1)!.count
  return `<div class="page-heading"><div><span class="eyebrow">我的回訪</span><h1>統計</h1></div>${progress(current)}</div><section class="card"><h2>每週聯繫人數</h2><p>本週目標達成率 ${Math.round(100 * current / state.settings.weekly_target)}%</p><div class="chart">${weeks.map(({ start, count }) => `<div><strong>${count}</strong><span style="--height:${count / max * 100}%"></span><small>${start.slice(5)}</small></div>`).join('')}</div></section><div class="split">${distribution()}</div><section class="card"><h3>各校人數</h3><div class="chips">${schools.map(school => `<span class="chip">${school}・${state.contacts.filter(contact => contact.school === school).length} 位</span>`).join('')}</div></section>`
}
function render() {
  if (!state) return
  refreshTheme()
  $('#island').hidden = tab !== 'island'
  $('#page').hidden = tab === 'island'
  $('#island').classList.toggle('expanded', expanded)
  $('.sheet-handle').setAttribute('aria-expanded', String(expanded))
  $('.sheet-handle').setAttribute('aria-label', expanded ? '收合本週回訪' : '展開本週回訪')
  $('#scene-progress').innerHTML = progress()
  $('#overview').innerHTML = overview()
  if (tab !== 'island') $('#page').innerHTML = tab === 'contacts' ? contacts() : tab === 'calendar' ? calendar() : stats()
  filterPeople()
  document.querySelectorAll<HTMLButtonElement>('[data-action="tab"].nav-item').forEach(item => item.setAttribute('aria-current', item.dataset.value === tab ? 'page' : 'false'))
  scene?.update(state.contacts.map(contact => ({ contact, ...stateOf(contact) })), state.settings)
}
function toast(message: string) {
  const notice = $('#toast')
  const dialog = modal.open ? modal : detail.open ? detail : null
  const parent = dialog ?? $('#app')
  parent.append(notice)
  notice.textContent = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { notice.textContent = '' }, 5200)
}
let toastTimer = 0
function errorText(error: unknown) {
  return (typeof error === 'object' && error && 'message' in error) ? String(error.message) : '請稍後再試'
}
function setState(next: State) {
  cache(user, next)
  state = next
  render()
}
async function change<T extends { id: string }>(table: Table, row: T) {
  await saveRows(table, [row], user)
  const rows = state[table] as { id: string }[]
  setState({ ...state, [table]: [...rows.filter(item => item.id !== row.id), row] })
}
function show(title: string, body: string) {
  $('#app').append($('#toast'))
  modal.innerHTML = `<div class="dialog-head"><h2>${title}</h2>${button('✕', 'close', '', 'icon')}</div><div class="dialog-body">${body}</div>`
  modal.querySelector('[data-action="close"]')?.setAttribute('aria-label', '關閉')
  if (!modal.open) modal.showModal()
}
function form(handle: (data: FormData) => Promise<void> | void, root: ParentNode = modal) {
  const element = $<HTMLFormElement>('form', root)
  element.onsubmit = async event => {
    event.preventDefault()
    if (element.dataset.busy) return
    const data = new FormData(element)
    const submit = $<HTMLButtonElement>('button[type="submit"]', element)
    element.dataset.busy = 'true'
    submit.disabled = true
    try { await handle(data) }
    catch (error) { toast(`操作失敗：${errorText(error)}`) }
    finally { delete element.dataset.busy; submit.disabled = false }
  }
}
const submitButton = (label = '儲存') => `<button type="submit" class="primary form-submit">${label}</button>`
function editContact(contact?: Contact, goalOnly = false) {
  const value = contact ?? { id: id(), name: '', school: schools[0], department: '', grade: '', openness: 2, line_id: '', line_type: 'personal', instagram: '', introduction: '', notes: '', hair: 'short', shirt: '#72b6a1', last_contact: null, bible_progress: null, life_updates: '', ...readDefault(2) }
  show(goalOnly ? '調整回訪目標' : contact ? '編輯成員' : '新增成員', `<form>${goalOnly ? '' : `
  <div class="form-grid">${input('名字', 'name', value.name, 'required maxlength="80"')}${fields('學校', `<select name="school">${options(schools, value.school)}</select>`)}${input('科系', 'department', value.department, 'required')}${input('年級', 'grade', value.grade)}</div>
  ${fields('敞開程度', `<select name="openness">${levels.map((label, i) => `<option value="${i + 1}" ${selected(value.openness, i + 1)}>${label}</option>`).join('')}</select>`)}`}
  <div id="goal-fields">${targetFields(value)}</div>${goalOnly ? '' : `
  <div class="form-grid">${input('LINE ID', 'line_id', value.line_id)}${fields('LINE 類型', `<select name="line_type"><option value="personal" ${selected(value.line_type, 'personal')}>個人</option><option value="official" ${selected(value.line_type, 'official')}>官方</option></select>`)}${input('IG 使用者名稱', 'instagram', value.instagram)}${fields('髮型', `<select name="hair"><option value="short" ${selected(value.hair, 'short')}>短髮</option><option value="long" ${selected(value.hair, 'long')}>長髮</option></select>`)}${input('衣服顏色', 'shirt', value.shirt, 'type="color"')}</div>
  ${area('怎麼認識的', 'introduction', value.introduction)}${area('備註', 'notes', value.notes)}`}${submitButton()}</form>`)
  if (!contact) $<HTMLSelectElement>('[name="openness"]', modal).onchange = event => {
    const goal = readDefault(Number((event.target as HTMLSelectElement).value))
    $('#goal-fields', modal).innerHTML = targetFields(goal)
  }
  form(async data => {
    const updated: Contact = goalOnly ? { ...value, ...readGoal(data) } : {
      ...value, ...readGoal(data), name: get(data, 'name'), school: get(data, 'school'), department: get(data, 'department'), grade: get(data, 'grade'), openness: Number(get(data, 'openness')), line_id: get(data, 'line_id'), line_type: get(data, 'line_type'), instagram: get(data, 'instagram'), introduction: get(data, 'introduction'), notes: get(data, 'notes'), hair: get(data, 'hair'), shirt: get(data, 'shirt'),
    }
    if (!updated.name || !updated.department) throw new Error('請填寫名字和科系')
    await change('contacts', updated)
    modal.close()
    toast(contact ? '已更新成員' : '已新增成員')
    if (detailId) drawDetail()
  })
}
function readDefault(level: number) {
  return state.settings.defaults[level] ?? { frequency_mode: state.settings.frequency_mode, frequency_value: state.settings.frequency_value }
}
function appointmentFields(value?: Partial<Appointment>, required = false) {
  return `<div class="form-grid">${input('日期', 'date', value?.date ?? '', `type="date" ${required ? 'required' : ''}`)}${input('時間', 'time', value?.time?.slice(0, 5) ?? '', `type="time" ${required ? 'required' : ''}`)}</div>${input('地點', 'location', value?.location)}${input('經文', 'scripture', value?.scripture)}`
}
function readAppointment(data: FormData, contactId: string, appointmentId: string = id()): Appointment | null {
  const date = get(data, 'date'), time = get(data, 'time')
  if (!date && !time && !get(data, 'location') && !get(data, 'scripture')) return null
  if (!date || !time) throw new Error('請填寫約定日期和時間')
  return { id: appointmentId, contact_id: contactId, date, time, location: get(data, 'location'), scripture: get(data, 'scripture'), status: get(data, 'status') || 'planned' }
}
function editAppointment(row?: Appointment, contactId = detailId ?? '') {
  if (!state.contacts.length) { editContact(); return }
  show(row ? '編輯約定' : '新增約定', `<form>${fields('對象', `<select name="contact" required>${state.contacts.map(contact => `<option value="${contact.id}" ${selected(row?.contact_id ?? contactId, contact.id)}>${e(contact.name)}</option>`).join('')}</select>`)}${appointmentFields(row ?? { date: calendarDay }, true)}${fields('狀態', `<select name="status">${[['planned', '已安排'], ['done', '已完成'], ['cancelled', '已取消']].map(([key, title]) => `<option value="${key}" ${selected(row?.status, key)}>${title}</option>`).join('')}</select>`)}${submitButton()}</form>`)
  form(async data => {
    const next = readAppointment(data, get(data, 'contact'), row?.id)
    if (next) await change('appointments', next)
    modal.close()
    if (detailId) drawDetail()
    toast('約定已儲存')
  })
}
function interactionForm(contact: Contact) {
  show('新增互動紀錄', `<form><div class="form-grid">${input('聯繫日期', 'interaction_date', day(), `type="date" required max="${day()}"`)}${fields('方式', `<select name="method">${options(methods, '')}</select>`)}</div>${area('摘要', 'summary')}<details><summary>下次約定</summary>${appointmentFields()}</details>${submitButton('存進紀錄')}</form>`)
  form(async data => {
    const row: Interaction = { id: id(), contact_id: contact.id, date: get(data, 'interaction_date'), method: get(data, 'method'), summary: get(data, 'summary'), topics: [], ai: null, created_at: new Date().toISOString() }
    if (!row.summary) throw new Error('請填寫摘要')
    await record({ interaction: row, appointment: readAppointment(data, contact.id) })
    modal.close()
    drawDetail()
    toast('互動紀錄已儲存')
  })
}
type Bundle = { interaction: Interaction; appointment: Appointment | null; prayers?: Prayer[]; screenshots?: State['screenshots']; contact?: Contact }
async function record(bundle: Bundle) {
  const { interaction, appointment, prayers = [], screenshots = [] } = bundle
  const current = find(interaction.contact_id)
  if (!current || interaction.date > day()) throw new Error('請確認成員及聯繫日期')
  const contact = { ...(bundle.contact ?? current), last_contact: [current.last_contact ?? '', interaction.date].sort().at(-1)! }
  if (db) {
    const { error } = await db.rpc('record_interaction', { payload: { contact, interaction, appointment, prayers, screenshots } })
    if (error) throw error
  }
  setState({ ...state, contacts: state.contacts.map(row => row.id === contact.id ? contact : row), interactions: [...state.interactions, interaction], appointments: appointment ? [...state.appointments, appointment] : state.appointments, prayer_requests: [...state.prayer_requests, ...prayers], screenshots: [...state.screenshots, ...screenshots] })
}
function adviceText(advice: Advice) {
  return [ ...advice.topics, advice.remember, advice.care, advice.opener, advice.preparation ].filter(Boolean).join('\n')
}
function adviceCard(contact: Contact) {
  const suggestion = state.suggestions.find(row => row.contact_id === contact.id)
  const valid = suggestion && suggestion.interaction_id === (latest(state, contact.id)?.id ?? null)
  return `<section class="card advice"><div class="section-row">${heading('💡', '這次可以聊')}${button(valid ? '重新產生' : '產生建議', 'suggest', contact.id)}</div>${valid ? `<ol>${suggestion.content.topics.map(topic => `<li>${e(topic)}</li>`).join('')}</ol>${[
    ['要記得的事', suggestion.content.remember], ['關心一下', suggestion.content.care], ['輕鬆開場', suggestion.content.opener], ['約定準備', suggestion.content.preparation],
  ].map(([label, value]) => value ? `<p><strong>${label}</strong> ${e(value)}</p>` : '').join('')}<div class="actions">${button('複製建議', 'copy', suggestion.id)}${button(`👍${suggestion.feedback === 1 ? ' 已選' : ''}`, 'feedback', suggestion.id + ':1')}${button(`👎${suggestion.feedback === -1 ? ' 已選' : ''}`, 'feedback', suggestion.id + ':-1')}</div>` : empty(suggestion ? '有新的互動紀錄，可更新話題建議。' : '可以依照最近的互動產生建議。')}</section>`
}
async function suggest(contact: Contact) {
  const current = state.suggestions.find(row => row.contact_id === contact.id)
  const previous = latest(state, contact.id)
  const upcoming = nextAppointments(contact.id)
  const recent = state.interactions.filter(row => row.contact_id === contact.id).sort((a, b) => (b.date + b.created_at).localeCompare(a.date + a.created_at)).slice(0, 12)
  const result = db ? await invoke<Advice>('suggest-topics', {
    contact: { name: contact.name, bible_progress: contact.bible_progress, life_updates: contact.life_updates }, mood: moods[stateOf(contact).mood],
    interactions: recent.map(({ date, method, summary, topics, ai }) => ({ date, method, summary, topics, follow_ups: ai?.follow_ups ?? [] })),
    prayers: state.prayer_requests.filter(row => row.contact_id === contact.id).map(({ content, answered }) => ({ content, answered })), appointments: upcoming.slice(0, 3),
  }) : demoAdvice(contact.name, Boolean(upcoming.length))
  await change('suggestions', { id: current?.id ?? id(), contact_id: contact.id, content: result, interaction_id: previous?.id ?? null, generated_at: new Date().toISOString(), feedback: 0 })
  if (detailId === contact.id) drawDetail()
}
function openDetail(key: string) {
  if (!find(key)) return
  detailId = key
  drawDetail()
  if (!detail.open) {
    detail.showModal()
    scene.setCovered(true)
  }
}
function drawDetail() {
  const contact = detailId ? find(detailId) : undefined
  if (!contact) return
  detailScene?.dispose()
  for (const url of photoUrls) URL.revokeObjectURL(url)
  photoUrls.clear()
  const current = stateOf(contact)
  const history = state.interactions.filter(row => row.contact_id === contact.id).sort((a, b) => (b.date + b.created_at).localeCompare(a.date + a.created_at))
  const appointments = nextAppointments(contact.id)
  const prayers = state.prayer_requests.filter(row => row.contact_id === contact.id).sort((a, b) => b.date.localeCompare(a.date))
  const progressValue = contact.bible_progress
  $('#app').append($('#toast'))
  detail.innerHTML = `<div class="dialog-head"><span class="eyebrow">成員詳情</span>${button('✕', 'close-detail', '', 'icon')}</div><div class="dialog-body detail-body"><div class="detail-hero"><div id="mini-scene" class="scene"></div><div><h1>${e(contact.name)}</h1><p>${e(contact.school)}・${e(contact.department)} ${e(contact.grade)}</p>${openness(contact.openness)} <span class="chip">${faces[current.mood]} ${moods[current.mood]}</span></div>${button('編輯成員', 'edit', contact.id)}</div>
  <section class="card section-row"><div><h3>回訪目標</h3><p>${contact.frequency_mode === 'interval' ? `每 ${contact.frequency_value} 天一次，${lastText(current.elapsed)}` : `本週 ${current.count}/${contact.frequency_value} 次`}</p></div>${button('調整', 'goal', contact.id)}</section>
  ${adviceCard(contact)}
  <section class="card"><div class="section-row"><h3>約定事項</h3>${button('＋ 新增約定', 'new-appointment', contact.id)}</div>${appointments.map(row => appointment(row, true)).join('') || empty('目前沒有即將到來的約定。')}</section>
  <section class="card"><h3>最近聊天</h3><div class="actions">${button('＋ 新增互動紀錄', 'interaction', contact.id, 'primary')}${button('📷 上傳聊天截圖', 'upload', contact.id)}</div><div class="timeline">${history.map(row => `<article><strong>${e(row.date)}・${e(row.method)}</strong><p>${e(row.summary)}</p>${row.topics.length ? `<small>${row.topics.map(e).join('・')}</small>` : ''}${row.ai?.follow_ups.length ? `<p>待跟進：${row.ai.follow_ups.map(e).join('、')}</p>` : ''}${state.screenshots.some(photo => photo.interaction_id === row.id) ? `<details data-photos="${row.id}"><summary>查看原始截圖</summary><div class="photo-list"></div></details>` : ''}</article>`).join('') || empty('還沒有互動紀錄。')}</div></section>
  <section class="card"><div class="section-row"><h3>代禱事項</h3>${button('＋ 新增', 'prayer', contact.id)}</div>${prayers.map(row => `<div class="section-row prayer"><span>${e(row.content)}<small>${e(row.date)}</small></span>${button(row.answered ? '✓ 已蒙應允' : '標記已蒙應允', 'answer', row.id)}</div>`).join('') || empty('還沒有代禱事項。')}</section>
  <section class="card"><div class="section-row"><h3>讀經進度與生活近況</h3>${button('編輯', 'care', contact.id)}</div>${progressValue ? `<p>${e(progressValue.book)} 第 ${progressValue.chapter} / ${progressValue.total} 章</p><progress max="${progressValue.total}" value="${progressValue.chapter}"></progress>` : empty('還沒有讀經進度。')}<p>${e(contact.life_updates) || '還沒有生活近況。'}</p><h4>怎麼認識的</h4><p>${e(contact.introduction) || '尚未填寫'}</p><h4>備註</h4><p>${e(contact.notes) || '尚未填寫'}</p></section>
  <div class="detail-footer">${links(contact, true)}${button('刪除這位成員的所有資料', 'delete', contact.id, 'danger')}</div></div>`
  $('[data-action="close-detail"]', detail).setAttribute('aria-label', '關閉詳情')
  detailScene = mountIsland($('#mini-scene'), () => {}, true)
  detailScene?.period(period)
  detailScene?.update([{ contact, ...current }], state.settings)
  detail.querySelectorAll<HTMLDetailsElement>('[data-photos]').forEach(element => {
    element.ontoggle = async () => {
      if (!element.open || element.dataset.loaded) return
      element.dataset.loaded = 'true'
      const list = $('.photo-list', element)
      list.textContent = '載入中…'
      try {
        const photos = state.screenshots.filter(row => row.interaction_id === element.dataset.photos).sort((a, b) => a.position - b.position)
        const urls = await Promise.all(photos.map(row => imageUrl(row.storage_path)))
        urls.forEach(url => { if (url.startsWith('blob:')) { if (element.isConnected) photoUrls.add(url); else URL.revokeObjectURL(url) } })
        list.innerHTML = photos.map((photo, i) => `<figure><a href="${e(urls[i])}" target="_blank" rel="noopener noreferrer"><img src="${e(urls[i])}" alt="聊天截圖 ${i + 1}"></a>${button('刪除截圖', 'delete-photo', photo.id, 'danger')}</figure>`).join('')
      } catch (error) { delete element.dataset.loaded; list.textContent = `無法載入截圖：${errorText(error)}` }
    }
  })
}
detail.addEventListener('close', () => {
  scene.setCovered(false)
  detailId = null
  detailScene?.dispose()
  detailScene = null
  for (const url of photoUrls) URL.revokeObjectURL(url)
  photoUrls.clear()
})
function editPrayer(contact: Contact) {
  show('新增代禱事項', `<form>${area('代禱內容', 'content')}${submitButton()}</form>`)
  form(async data => {
    const content = get(data, 'content')
    if (!content) throw new Error('請填寫代禱內容')
    await change('prayer_requests', { id: id(), contact_id: contact.id, content, date: day(), answered: false })
    modal.close(); drawDetail()
  })
}
function editCare(contact: Contact) {
  show('讀經進度與生活近況', `<form>${input('書卷', 'book', contact.bible_progress?.book)}<div class="form-grid">${input('讀到第幾章', 'chapter', String(contact.bible_progress?.chapter ?? ''), 'type="number" min="0"')}${input('全書章數', 'total', String(contact.bible_progress?.total ?? ''), 'type="number" min="1"')}</div>${area('生活近況', 'life', contact.life_updates)}${submitButton()}</form>`)
  form(async data => {
    const book = get(data, 'book'), chapter = Number(get(data, 'chapter')), total = Number(get(data, 'total'))
    if (book && (!total || chapter > total)) throw new Error('請確認章數和全書章數')
    await change('contacts', { ...contact, bible_progress: book ? { book, chapter, total } : null, life_updates: get(data, 'life') })
    modal.close(); drawDetail()
  })
}
async function deleteContact(contact: Contact) {
  show('刪除成員資料', `<form><p>確定永久刪除 ${e(contact.name)} 的名單、互動、約定、代禱、建議與所有截圖？</p>${submitButton('確認刪除全部資料')}</form>`)
  form(async () => {
    if (db) await invoke('delete-contact', { contact_id: contact.id })
    else await removeImages(state.screenshots.filter(row => row.contact_id === contact.id).map(row => row.storage_path))
    setState({ ...state, contacts: state.contacts.filter(row => row.id !== contact.id), interactions: state.interactions.filter(row => row.contact_id !== contact.id), appointments: state.appointments.filter(row => row.contact_id !== contact.id), prayer_requests: state.prayer_requests.filter(row => row.contact_id !== contact.id), screenshots: state.screenshots.filter(row => row.contact_id !== contact.id), suggestions: state.suggestions.filter(row => row.contact_id !== contact.id) })
    modal.close(); detail.close(); toast('已刪除成員及相關資料')
  })
}
function settings() {
  const prefs = state.settings
  show('設定', `<form><h3>本週與回訪目標</h3>${input('本週預計聯繫人數', 'weekly_target', String(prefs.weekly_target), 'type="number" required min="1" max="10000"')}${targetFields(prefs)}
  <details><summary>依敞開程度設定預設</summary>${levels.map((label, i) => `<div class="level-default"><label class="check"><input name="use${i + 1}" type="checkbox" ${checked(Boolean(prefs.defaults[i + 1]))}>${label}使用自訂預設</label>${targetFields(readDefault(i + 1), 'level' + (i + 1))}</div>`).join('')}</details>
  <h3>島嶼提醒</h3><label class="check"><input type="checkbox" name="attention" ${checked(prefs.attention)}>求關注動畫</label>
  ${fields('求關注頻率', `<select name="pace">${[[.65, '舒緩'], [1, '一般'], [1.4, '頻繁']].map(([value, label]) => `<option value="${value}" ${selected(prefs.pace, value)}>${label}</option>`).join('')}</select>`)}
  <label class="check"><input type="checkbox" name="vibration" ${checked(prefs.vibration)}>有沮喪小人時，開站輕震一次</label>
  <label class="check"><input type="checkbox" name="notifications" ${checked(prefs.notifications)}>早上提醒今天的約與近期需要關心的人</label>
  <h3>個人資料</h3><p>${db ? '上傳後按下分析時，打碼後的截圖會傳至 OpenAI。產生建議時會傳送所需的摘要、代禱、讀經與近況。' : '示範模式使用本機資料和示範 AI 結果。'}</p><p>請妥善保管匯出檔，它包含個人資料及聊天截圖。</p><div class="actions">${button('匯出我的資料', 'export')}${db ? button('登出', 'logout') : ''}</div>${submitButton('儲存設定')}</form>`)
  form(async data => {
    let notifications = data.has('notifications')
    if (notifications) {
      notifications = 'Notification' in window && (Notification.permission === 'granted' || await Notification.requestPermission() === 'granted')
      if (!notifications) toast('瀏覽器尚未允許通知')
    }
    const newDefaults: Settings['defaults'] = {}
    levels.forEach((_, i) => { if (data.has('use' + (i + 1))) newDefaults[i + 1] = readGoal(data, 'level' + (i + 1)) })
    const preferences = { ...readGoal(data), weekly_target: Number(get(data, 'weekly_target')), defaults: newDefaults, attention: data.has('attention'), pace: Number(get(data, 'pace')), vibration: data.has('vibration'), notifications }
    if (db) {
      const { error } = await db.from('settings').upsert({ user_id: user, preferences })
      if (error) throw error
    }
    setState({ ...state, settings: preferences })
    modal.close()
    await remind()
  })
}
async function remind() {
  if (!state.settings.notifications || !('Notification' in window) || Notification.permission !== 'granted' || new Date().getHours() < 7) return
  const key = `shepherdiland:reminder:${user}:${day()}`
  if (localStorage.getItem(key)) return
  const appointments = todayRows()
  const people = state.contacts.filter(contact => stateOf(contact).mood >= 2)
  if (!appointments.length && !people.length) return
  const url = new URL(location.pathname, location.origin)
  const contact = people[0]?.id ?? appointments[0]?.contact_id
  if (contact) url.searchParams.set('contact', contact)
  const registration = await navigator.serviceWorker?.getRegistration()
  const body = [appointments.length ? `今天有 ${appointments.length} 個約定` : '', people.length ? `想想 ${people.map(person => person.name).join('、')}` : ''].filter(Boolean).join('。')
  if (registration) await registration.showNotification('我的回訪', { body, data: { url: url.href }, icon: import.meta.env.BASE_URL + 'icon.svg' })
  else {
    const notification = new Notification('我的回訪', { body })
    notification.onclick = () => { window.focus(); if (contact) openDetail(contact) }
  }
  localStorage.setItem(key, 'yes')
}
async function exportData() {
  if (!confirm('匯出的檔案含個人資料與截圖，請妥善保管。繼續匯出？')) return
  const base = { ...state, screenshots: await Promise.all(state.screenshots.map(async row => {
    const url = await imageUrl(row.storage_path)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('無法匯出截圖')
      const blob = await response.blob()
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
      return { ...row, data }
    } finally { if (url.startsWith('blob:')) URL.revokeObjectURL(url) }
  })) }
  const url = URL.createObjectURL(new Blob([JSON.stringify(base, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = `shepherdiland-${day()}.json`; anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function deletePhoto(photoId: string) {
  const row = state.screenshots.find(photo => photo.id === photoId)
  if (!row || !confirm('確定永久刪除這張截圖？')) return
  await removeImages([row.storage_path])
  if (db) {
    const { error } = await db.from('screenshots').delete().eq('id', row.id)
    if (error) throw error
  }
  setState({ ...state, screenshots: state.screenshots.filter(photo => photo.id !== photoId) })
  drawDetail()
}
function tabTo(value: string) {
  if (value !== 'island') scene.reset()
  tab = value
  render()
  window.scrollTo(0, 0)
}
function toggleSheet(value = !expanded) { scene.reset(); expanded = value; render(); window.scrollTo(0, 0) }
let swipe: number | null = null
$('.sheet-handle').addEventListener('pointerdown', event => { swipe = event.clientY; $('.sheet-handle').setPointerCapture(event.pointerId) })
$('.sheet-handle').addEventListener('pointerup', event => {
  if (swipe !== null && Math.abs(event.clientY - swipe) > 18) {
    event.preventDefault()
    toggleSheet(event.clientY < swipe)
    suppressClick = true
    window.setTimeout(() => { suppressClick = false }, 320)
  }
  swipe = null
})
let suppressClick = false
$('.sheet-handle').onclick = () => { if (!suppressClick) toggleSheet() }
document.addEventListener('input', event => {
  const element = event.target as HTMLInputElement
  if (element.id !== 'search') return
  filters.search = element.value
  filterPeople()
})
document.addEventListener('change', event => {
  const element = event.target as HTMLSelectElement
  const key = element.dataset.filter as keyof typeof filters | undefined
  if (key) { filters[key] = element.value; filterPeople() }
})
document.addEventListener('click', async event => {
  const element = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]')
  if (!element || !state) return
  const { action, value = '' } = element.dataset
  const contact = find(value)
  try {
    switch (action) {
      case 'tab': tabTo(value); break
      case 'expand': toggleSheet(true); break
      case 'reset': scene?.reset(); break
      case 'period': period = period === null ? 0 : period === 3 ? null : period + 1; refreshTheme(); break
      case 'settings': settings(); break
      case 'close': if (!modal.querySelector('form[data-busy]')) modal.close(); break
      case 'close-detail': detail.close(); break
      case 'detail': scene.reset(); openDetail(value); break
      case 'add': editContact(); break
      case 'edit': if (contact) editContact(contact); break
      case 'goal': if (contact) editContact(contact, true); break
      case 'interaction': if (contact) interactionForm(contact); break
      case 'upload': if (contact) chatUpload({ contact, user, modal, show, form, toast, record, done: drawDetail, readAppointment }); break
      case 'prayer': if (contact) editPrayer(contact); break
      case 'care': if (contact) editCare(contact); break
      case 'delete': if (contact) await deleteContact(contact); break
      case 'delete-photo': await deletePhoto(value); break
      case 'suggest':
        if (contact) { element.disabled = true; element.textContent = '產生中…'; await suggest(contact) }
        break
      case 'copy': {
        const row = state.suggestions.find(item => item.id === value)
        if (row) { await navigator.clipboard.writeText(adviceText(row.content)); toast('已複製話題建議') }
        break
      }
      case 'feedback': {
        const [key, score] = value.split(':')
        const row = state.suggestions.find(item => item.id === key)
        if (row) { await change('suggestions', { ...row, feedback: row.feedback === Number(score) ? 0 : Number(score) }); drawDetail() }
        break
      }
      case 'answer': {
        const row = state.prayer_requests.find(item => item.id === value)
        if (row) { await change('prayer_requests', { ...row, answered: !row.answered }); drawDetail() }
        break
      }
      case 'new-appointment': editAppointment(undefined, value || detailId || ''); break
      case 'appointment': editAppointment(state.appointments.find(row => row.id === value)); break
      case 'month': month = new Date(month.getFullYear(), month.getMonth() + Number(value), 1); calendarDay = day(0, month); render(); break
      case 'date': calendarDay = value; render(); break
      case 'export': element.disabled = true; await exportData(); element.disabled = false; break
      case 'logout': {
        const { error } = await db!.auth.signOut()
        if (error) throw error
        break
      }
    }
  } catch (error) {
    element.disabled = false
    if (action === 'suggest') element.textContent = '重新產生'
    toast(`操作失敗：${errorText(error)}`)
  }
})
modal.addEventListener('cancel', event => { if (modal.querySelector('form[data-busy]')) event.preventDefault() })
function signIn() {
  $('#workspace').hidden = true
  $('.settings-button').hidden = true
  $('#auth').hidden = false
  $('#auth').innerHTML = `<section class="card login"><span class="mark">🌱</span><h1>我的回訪</h1><p>登入 Shepherdiland 管理校園回訪。</p><form>${input('電子郵件', 'email', '', 'type="email" required autocomplete="email"')}${submitButton('寄出登入連結')}</form></section>`
  form(async data => {
    const { error } = await db!.auth.signInWithOtp({ email: get(data, 'email'), options: { emailRedirectTo: new URL(location.pathname, location.origin).href } })
    if (error) throw error
    toast('登入連結已寄出，請查看信箱。')
  }, $('#auth'))
}
async function start(userId: string) {
  const session = ++sessionToken
  if (user === userId && state) return
  try {
    const loaded = await load(userId)
    if (session !== sessionToken) return
    user = userId
    setState(loaded)
    $('#auth').hidden = true
    $('#workspace').hidden = false
    $('.settings-button').hidden = false
    if (state.settings.vibration && state.contacts.some(contact => stateOf(contact).mood === 2)) navigator.vibrate?.(40)
    const key = new URLSearchParams(location.search).get('contact')
    if (key) openDetail(key)
    lastRefresh = refreshKey()
    void remind().catch(() => {})
  } catch (error) {
    if (session !== sessionToken) return
    $('#auth').hidden = false
    $('#auth').innerHTML = `<section class="card login"><h2>資料載入失敗</h2><p>${e(errorText(error))}</p><button class="primary" id="reload">重試</button></section>`
    $('#reload').onclick = () => void start(userId)
  }
}
function refreshKey() { const now = new Date(); return day(0, now) + ':' + now.getHours() }
function tick() {
  if (!state || !user || lastRefresh === refreshKey()) return
  lastRefresh = refreshKey()
  render()
  if (detailId && !modal.open) drawDetail()
  void remind().catch(() => {})
}
window.setInterval(tick, 15000)
document.addEventListener('visibilitychange', tick)
window.addEventListener('online', () => {
  if (!db || !user || modal.open) return
  const active = user
  void load(active).then(next => { if (user === active && !modal.open) setState(next) }).catch(() => {})
})
$('#mode').textContent = db ? '' : '示範模式'
$('.settings-button').hidden = Boolean(db)
if (db) {
  db.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => {
      if (session) void start(session.user.id)
      else {
        sessionToken++
        if (user) localStorage.removeItem(`shepherdiland:${user}`)
        user = ''
        state = undefined as unknown as State
        modal.close(); detail.close()
        scene?.update([], defaults)
        $('#app').append($('#toast'))
        $('#overview').replaceChildren(); $('#page').replaceChildren(); detail.replaceChildren()
        signIn()
      }
    }, 0)
  })
} else void start('demo')
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {}) })
}
