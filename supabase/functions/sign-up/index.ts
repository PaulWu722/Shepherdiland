import { createClient } from 'npm:@supabase/supabase-js@2.119.2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
// Must match accountEmail() in src/main.ts.
async function accountEmail(name: string) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(name)))
  return `u${Array.from(hash.slice(0, 16), b => b.toString(16).padStart(2, '0')).join('')}@shepherdiland.app`
}
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
  const json = (value: unknown, status = 200) => Response.json(value, { status, headers: cors })
  if (request.method !== 'POST') return json({ error: '僅支援 POST' }, 405)
  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!name || name.length > 30) return json({ error: '請輸入 1–30 字的姓名' }, 400)
  if (!/^\d{6}$/.test(password)) return json({ error: '密碼需為 6 位數字' }, 400)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { error } = await admin.auth.admin.createUser({ email: await accountEmail(name), password, email_confirm: true, user_metadata: { name } })
  if (error) return /already|registered|exists/i.test(error.message) ? json({ error: '密碼錯誤' }, 409) : json({ error: '建立帳號失敗，請稍後再試' }, 500)
  return json({ ok: true })
})
