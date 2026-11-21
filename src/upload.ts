import { db, invoke, putImage, removeImages } from './data'
import { day, id, levels } from './model'
import type { Analysis, Appointment, Contact, Interaction, Prayer, Screenshot } from './model'
import { escape as e } from './html'

type Options = {
  contact: Contact
  user: string
  modal: HTMLDialogElement
  show: (title: string, body: string) => void
  form: (handler: (data: FormData) => Promise<void>) => void
  toast: (message: string) => void
  record: (bundle: { interaction: Interaction; appointment: Appointment | null; prayers: Prayer[]; screenshots: Screenshot[]; contact: Contact }) => Promise<void>
  done: () => void
  readAppointment: (data: FormData, contact: string) => Appointment | null
}
async function canvasFor(file: File) {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')!
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    canvas.setAttribute('aria-label', '在截圖上塗抹以遮住個資')
    canvas.className = 'redact'
    let last: { x: number; y: number } | null = null
    const paint = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const point = { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }
      context.strokeStyle = '#181818'
      context.lineWidth = 21 * canvas.width / rect.width
      context.lineCap = 'round'
      context.beginPath()
      context.moveTo(last?.x ?? point.x - .1, last?.y ?? point.y)
      context.lineTo(point.x, point.y)
      context.stroke()
      last = point
    }
    canvas.onpointerdown = event => { canvas.setPointerCapture(event.pointerId); paint(event) }
    canvas.onpointermove = event => { if (last) paint(event) }
    canvas.onpointerup = canvas.onpointercancel = () => { last = null }
    return canvas
  } finally { URL.revokeObjectURL(url) }
}
const webp = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => {
  if (blob?.type === 'image/webp') resolve(blob)
  else reject(new Error('此瀏覽器無法輸出 WebP 截圖'))
}, 'image/webp', .82))
const asDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(blob)
})
const mock = (): Analysis => ({ summary: '示範分析：聊了最近的課業，也提到想一起讀經。', topics: ['課業', '讀經'], appointment: { date: day(1), time: '16:00', location: '學校圖書館', scripture: '約翰福音 3:16' }, prayer_requests: ['為本週的課業和作息禱告'], bible_progress: { book: '約翰福音', chapter: 3, total: 21 }, life_updates: '最近在準備課堂報告。', openness_hint: { level: 4, reason: '示範資料中有提到想一起讀經。' }, follow_ups: ['先確認對方可讀經的時間'], chat_date: day() })
const lines = (text: string) => text.split('\n').map(line => line.trim()).filter(Boolean)
const field = (label: string, name: string, value = '', attrs = '') => `<label><span>${label}</span><input name="${name}" value="${e(value)}" ${attrs}></label>`
const area = (label: string, name: string, value = '') => `<label><span>${label}</span><textarea name="${name}" rows="2">${e(value)}</textarea></label>`
const valueOf = (data: FormData, key: string) => String(data.get(key) ?? '').trim()

export function chatUpload({ contact, user, modal, show, form, toast, record, done, readAppointment }: Options) {
  const photos: HTMLCanvasElement[] = []
  let app = 'LINE'
  let speaker = 'right'
  let processing = 0
  function picker() {
    show('上傳聊天截圖', `<form><p>截圖可能含有對方個資，請妥善保管，只供個人關懷使用</p><p>建議先在下方截圖用手指塗抹打碼。可拖曳排序，或使用上移、下移。</p>${db ? '<p>按下分析截圖後，打碼後的圖片會傳給 OpenAI。</p>' : ''}
      <div class="form-grid"><label><span>選擇相簿圖片</span><input type="file" id="album" accept="image/*" multiple></label><label><span>拍照</span><input type="file" id="camera" accept="image/*" capture="environment"></label></div>
      <div class="form-grid"><label><span>聊天方式</span><select name="app"><option>LINE</option><option ${app === 'IG' ? 'selected' : ''}>IG</option></select></label><label><span>我的對話泡泡</span><select name="speaker"><option value="right">右邊</option><option value="left" ${speaker === 'left' ? 'selected' : ''}>左邊</option></select></label></div><div id="uploads"></div><button type="submit" class="primary form-submit">分析截圖</button></form>`)
    const list = modal.querySelector('#uploads')!
    const submit = modal.querySelector<HTMLButtonElement>('button[type=submit]')!
    const sync = () => { submit.disabled = processing > 0 || photos.length === 0 }
    function draw() {
      list.replaceChildren()
      photos.forEach((photo, index) => {
        const wrapper = document.createElement('article')
        wrapper.className = 'upload-item'
        const header = document.createElement('div')
        header.className = 'actions'
        const handle = document.createElement('span')
        handle.textContent = `⠿ 截圖 ${index + 1}`
        handle.draggable = true
        handle.ondragstart = event => event.dataTransfer?.setData('text/plain', String(index))
        wrapper.ondragover = event => event.preventDefault()
        wrapper.ondrop = event => {
          event.preventDefault()
          const value = event.dataTransfer?.getData('text/plain')
          if (!value || !/^\d+$/.test(value) || Number(value) >= photos.length) return
          reorder(Number(value), index)
        }
        header.append(handle)
        const control = (label: string, action: () => void, disabled = false) => {
          const button = document.createElement('button')
          button.type = 'button'
          button.className = 'soft'
          button.textContent = label
          button.disabled = disabled
          button.onclick = action
          header.append(button)
        }
        control('上移', () => reorder(index, index - 1), index === 0)
        control('下移', () => reorder(index, index + 1), index === photos.length - 1)
        control('移除', () => { photos.splice(index, 1); draw() })
        wrapper.append(header, photo)
        list.append(wrapper)
      })
      sync()
    }
    function reorder(from: number, to: number) {
      const [photo] = photos.splice(from, 1)
      photos.splice(to, 0, photo)
      draw()
    }
    for (const input of modal.querySelectorAll<HTMLInputElement>('input[type=file]')) {
      input.onchange = async () => {
        const files = [...(input.files ?? [])]
        input.value = ''
        if (photos.length + files.length + processing > 8) { toast('每次最多選擇 8 張截圖'); return }
        processing += files.length
        sync()
        const results = await Promise.allSettled(files.map(canvasFor))
        processing -= files.length
        results.forEach(result => {
          if (result.status === 'fulfilled') photos.push(result.value)
          else toast('有圖片無法讀取，請改用 JPG、PNG 或 WebP。')
        })
        draw()
      }
    }
    draw()
    form(async data => {
      if (!photos.length || processing) return
      app = valueOf(data, 'app')
      speaker = valueOf(data, 'speaker')
      const wait = document.createElement('div')
      wait.className = 'analysis-wait'
      wait.setAttribute('role', 'status')
      wait.innerHTML = '<span>🧑🏻‍🌾📱</span><p>小人正在看聊天紀錄…</p>'
      const uploadForm = modal.querySelector('form')!
      uploadForm.append(wait)
      uploadForm.inert = true
      try {
        const blobs = await Promise.all(photos.map(webp))
        const result = db ? await invoke<Analysis>('analyze-chat', { images: await Promise.all(blobs.map(asDataUrl)), reference_date: day(), own_side: speaker, app }) : await new Promise<Analysis>(resolve => window.setTimeout(() => resolve(mock()), 750))
        review(result, blobs)
      } finally { uploadForm.inert = false; wait.remove() }
    })
  }
  function review(result: Analysis, blobs: Blob[]) {
    const appointment = result.appointment
    const bible = result.bible_progress
    const hint = result.openness_hint
    show('確認分析結果', `<form><p>請核對日期、對話內容與辨識結果，再存進紀錄。</p>
      ${field('聯繫日期', 'chat_date', result.chat_date || day(), `type="date" required max="${day()}"`)}
      ${area('聊天摘要', 'summary', result.summary)}${area('話題（每行一項）', 'topics', result.topics.join('\n'))}
      <details ${appointment ? 'open' : ''}><summary>下次約定</summary><div class="form-grid">${field('日期', 'date', appointment?.date, 'type="date"')}${field('時間', 'time', appointment?.time, 'type="time"')}</div>${field('地點', 'location', appointment?.location)}${field('經文', 'scripture', appointment?.scripture)}</details>
      ${area('代禱事項（每行一項）', 'prayers', result.prayer_requests.join('\n'))}
      <details ${bible ? 'open' : ''}><summary>讀經進度</summary>${field('書卷', 'book', bible?.book)}<div class="form-grid">${field('章數', 'chapter', String(bible?.chapter ?? ''), 'type="number" min="0"')}${field('全書章數', 'total', String(bible?.total ?? ''), 'type="number" min="1"')}</div></details>
      ${area('生活近況', 'life', result.life_updates)}${area('待跟進的事（每行一項）', 'follow_ups', result.follow_ups.join('\n'))}
      ${hint ? `<p>敞開程度建議：${levels[hint.level - 1] ?? '未確定'}。 ${e(hint.reason)}</p><label class="check"><input type="checkbox" name="accept">採用建議</label>` : ''}
      <div class="actions"><button class="soft" type="button" id="back">返回截圖</button><button type="submit" class="primary">存進紀錄</button></div></form>`)
    modal.querySelector<HTMLButtonElement>('#back')!.onclick = picker
    form(async data => {
      const get = (key: string) => valueOf(data, key)
      const date = get('chat_date')
      const nextAppointment = readAppointment(data, contact.id)
      const book = get('book'), chapter = Number(get('chapter')), total = Number(get('total'))
      if (book && (!total || chapter > total)) throw new Error('請確認讀經進度')
      const analysis: Analysis = { summary: get('summary'), topics: lines(get('topics')), appointment: nextAppointment, prayer_requests: lines(get('prayers')), bible_progress: book ? { book, chapter, total } : null, life_updates: get('life'), follow_ups: lines(get('follow_ups')), openness_hint: hint, chat_date: date }
      if (!analysis.summary) throw new Error('請填寫聊天摘要')
      const now = new Date().toISOString()
      const interaction: Interaction = { id: id(), contact_id: contact.id, date, method: app, summary: analysis.summary, topics: analysis.topics, ai: analysis, created_at: now }
      const screenshots = blobs.map((_, i) => ({ id: id(), contact_id: contact.id, interaction_id: interaction.id, storage_path: `${user}/${contact.id}/${date}-${interaction.id}_${i + 1}.webp`, uploaded_at: now, position: i }))
      const uploaded: string[] = []
      try {
        for (const [i, photo] of screenshots.entries()) {
          await putImage(photo.storage_path, blobs[i])
          uploaded.push(photo.storage_path)
        }
        await record({ interaction, appointment: nextAppointment, screenshots, prayers: analysis.prayer_requests.map(content => ({ id: id(), contact_id: contact.id, content, date, answered: false })), contact: { ...contact, bible_progress: analysis.bible_progress ?? contact.bible_progress, life_updates: analysis.life_updates || contact.life_updates, openness: data.has('accept') && hint && hint.level >= 1 && hint.level <= 5 ? hint.level : contact.openness } })
      } catch (error) {
        try {
          if (db) {
            const { data: saved, error: checkError } = await db.from('interactions').select('id').eq('id', interaction.id).maybeSingle()
            if (checkError || saved) throw new Error('先確認紀錄狀態')
          }
          await removeImages(uploaded)
        } catch { toast('請重新載入以確認紀錄及截圖狀態。') }
        throw error
      }
      modal.close()
      done()
      toast('聊天紀錄已儲存')
    })
  }
  picker()
}
