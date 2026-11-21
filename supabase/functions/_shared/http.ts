import { createClient } from 'npm:@supabase/supabase-js@2.119.2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
export class HttpError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}
function authenticatedClient(bearer: string) {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: bearer } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
type Client = ReturnType<typeof authenticatedClient>
export function serve(handler: (body: Record<string, unknown>, db: Client, owner: string) => Promise<unknown>) {
  Deno.serve(async request => {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
    const json = (value: unknown, status = 200) => Response.json(value, { status, headers: cors })
    if (request.method !== 'POST') return json({ error: '僅支援 POST' }, 405)
    try {
      const bearer = request.headers.get('Authorization')
      if (!bearer?.startsWith('Bearer ')) throw new HttpError('請先登入', 401)
      const db = authenticatedClient(bearer)
      const { data, error } = await db.auth.getUser(bearer.slice(7))
      if (error || !data.user) throw new HttpError('登入已失效，請重新登入', 401)
      const raw = await request.text()
      if (raw.length > 18_000_000) throw new HttpError('資料過大，請減少截圖張數', 413)
      let body: Record<string, unknown>
      try {
        body = JSON.parse(raw)
        if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error()
      } catch { throw new HttpError('無法讀取請求內容', 400) }
      return json(await handler(body, db, data.user.id))
    } catch (error) {
      return error instanceof HttpError ? json({ error: error.message }, error.status) : json({ error: '伺服器操作失敗，請稍後再試' }, 500)
    }
  })
}
