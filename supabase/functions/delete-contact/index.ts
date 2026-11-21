import { HttpError, serve } from '../_shared/http.ts'

serve(async (body, db, owner) => {
  const contact = body.contact_id
  if (typeof contact !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(contact)) throw new HttpError('成員識別碼無效', 400)
  const existing = await db.from('contacts').select('id').eq('id', contact).eq('user_id', owner).maybeSingle()
  if (existing.error) throw existing.error
  const storage = db.storage.from('chat-screenshots')
  const prefix = `${owner}/${contact}`
  for (;;) {
    const { data, error } = await storage.list(prefix, { limit: 100 })
    if (error) throw error
    if (!data.length) break
    const paths = data.map(item => `${prefix}/${item.name}`)
    const removed = await storage.remove(paths)
    if (removed.error || !removed.data.length) throw new HttpError('暫時無法刪除截圖，請重試', 502)
  }
  if (existing.data) {
    const { error } = await db.from('contacts').delete().eq('id', contact).eq('user_id', owner)
    if (error) throw error
  }
  return { deleted: true }
})
