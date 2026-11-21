import { HttpError } from './http.ts'

export async function model(instructions: string, text: string, images: string[] = []) {
  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key) throw new HttpError('尚未設定 AI 服務金鑰', 503)
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_MODEL') || 'gpt-4o',
      store: false,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: [{ type: 'text', text }, ...images.map(url => ({ type: 'image_url', image_url: { url, detail: 'high' } }))] },
      ],
    }),
    signal: AbortSignal.timeout(55000),
  })
  if (!response.ok) throw new HttpError('AI 服務暫時無法處理，請稍後重試', 502)
  try {
    const data = await response.json()
    const result = JSON.parse(data.choices[0].message.content)
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error()
    return result as Record<string, unknown>
  } catch { throw new HttpError('AI 回傳格式有誤，請重新產生', 502) }
}
export const string = (value: unknown, limit = 2000) => typeof value === 'string' ? value.trim().slice(0, limit) : ''
export const strings = (value: unknown, limit = 15) => Array.isArray(value) ? value.map(item => string(item, 500)).filter(Boolean).slice(0, limit) : []
export const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
export const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
