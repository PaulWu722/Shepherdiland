import { createClient } from '@supabase/supabase-js'
import { defaults, seed } from './model'
import type { State, Settings } from './model'

const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = import.meta.env
export const db = VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY ? createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) : null

const tables = ['contacts', 'interactions', 'appointments', 'prayer_requests', 'screenshots', 'suggestions'] as const
export type Table = typeof tables[number]
export async function load(user: string): Promise<State> {
  const key = `shepherdiland:${user}`
  const saved = localStorage.getItem(key)
  if (!db) return saved ? JSON.parse(saved) : seed()
  try {
    const results = await Promise.all([...tables.map(table => db.from(table).select('*')), db.from('settings').select('preferences').maybeSingle()])
    for (const result of results) if (result.error) throw result.error
    return { ...Object.fromEntries(tables.map((table, i) => [table, results[i].data])), settings: { ...defaults, ...(results[6].data as { preferences?: Settings } | null)?.preferences } } as State
  } catch (error) {
    if (!navigator.onLine && saved) return JSON.parse(saved)
    throw error
  }
}
export function cache(user: string, state: State) {
  try { localStorage.setItem(`shepherdiland:${user}`, JSON.stringify(state)) }
  catch (error) { if (!db) throw error }
}
export async function saveRows(table: Table, rows: { id: string }[], user: string) {
  if (!db || !rows.length) return
  const { error } = await db.from(table).upsert(rows.map(row => ({ ...row, user_id: user })))
  if (error) throw error
}
function demoImages() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('shepherdiland-demo-images', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('images')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function imageTransaction(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest) {
  const database = await demoImages()
  return new Promise<Blob | undefined>((resolve, reject) => {
    const transaction = database.transaction('images', mode)
    const request = action(transaction.objectStore('images'))
    transaction.oncomplete = () => { database.close(); resolve(request.result) }
    transaction.onabort = () => { database.close(); reject(transaction.error) }
  })
}
export async function putImage(path: string, blob: Blob) {
  if (!db) { await imageTransaction('readwrite', store => store.put(blob, path)); return }
  const { error } = await db.storage.from('chat-screenshots').upload(path, blob, { contentType: 'image/webp' })
  if (error) throw error
}
export async function imageUrl(path: string) {
  if (!db) {
    const blob = await imageTransaction('readonly', store => store.get(path))
    if (!blob) throw new Error('找不到截圖')
    return URL.createObjectURL(blob)
  }
  const { data, error } = await db.storage.from('chat-screenshots').createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}
export async function removeImages(paths: string[]) {
  if (!paths.length) return
  if (!db) {
    await Promise.all(paths.map(path => imageTransaction('readwrite', store => store.delete(path))))
    return
  }
  const { error } = await db.storage.from('chat-screenshots').remove(paths)
  if (error) throw error
}
export async function invoke<T>(name: string, body: object): Promise<T> {
  if (!db) throw new Error('尚未設定 Supabase')
  const { data, error } = await db.functions.invoke<T>(name, { body })
  if (error) {
    const details = error.context instanceof Response ? await error.context.json().catch(() => null) : null
    throw new Error(details?.error || error.message)
  }
  if (!data) throw new Error('伺服器沒有回傳資料')
  return data
}
