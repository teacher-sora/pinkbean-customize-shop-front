// Cloudflare R2(S3 호환) 서버 전용 최소 클라이언트 — AWS SigV4(region=auto)를 의존성 없이 서명한다.
// 필요한 환경변수: R2_ENDPOINT(https://<account>.r2.cloudflarestorage.com), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET(선택).
import { createHash, createHmac } from 'crypto'

const ENDPOINT = (process.env.R2_ENDPOINT || '').replace(/\/+$/, '')
const KEY_ID = process.env.R2_ACCESS_KEY_ID || ''
const SECRET = process.env.R2_SECRET_ACCESS_KEY || ''
const BUCKET = process.env.R2_BUCKET || 'pinkbean-customize-shop'

export const sha256 = (d: string | Buffer) => createHash('sha256').update(d).digest('hex')
const hmac = (k: Buffer | string, d: string) => createHmac('sha256', k).update(d).digest()

export async function r2(method: 'GET' | 'HEAD' | 'PUT', key: string, body?: string | Buffer, contentType = 'text/plain; charset=utf-8'): Promise<Response> {
  const url = new URL(`${ENDPOINT}/${BUCKET}/${key}`)
  const now = new Date()
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '')
  const day = amzDate.slice(0, 8)
  const payloadHash = sha256(body ?? '')
  const headers: Record<string, string> = { host: url.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate }
  if (method === 'PUT') {
    headers['content-type'] = contentType
    headers['cache-control'] = 'public, max-age=31536000, immutable'
  }
  const names = Object.keys(headers).sort()
  const canonical = [method, url.pathname, '', ...names.map((n) => `${n}:${headers[n]}`), '', names.join(';'), payloadHash].join('\n')
  const scope = `${day}/auto/s3/aws4_request`
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n')
  const kSign = hmac(hmac(hmac(hmac('AWS4' + SECRET, day), 'auto'), 's3'), 'aws4_request')
  const auth = `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${scope}, SignedHeaders=${names.join(';')}, Signature=${createHmac('sha256', kSign).update(toSign).digest('hex')}`
  const { host: _host, ...send } = headers
  return fetch(url, { method, headers: { ...send, authorization: auth }, body: body as BodyInit | undefined, cache: 'no-store' })
}

export const r2Configured = () => !!(ENDPOINT && KEY_ID && SECRET)
