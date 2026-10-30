#!/usr/bin/env node
// Supabase 에서 **운영 데이터가 아닌 것**을 지운다. main 에 병합할 때마다 돌린다(CLAUDE.md '시험 데이터').
//
//   node scripts/clean-test-data.mjs            무엇이 얼마나 있는지만 센다(아무것도 지우지 않는다)
//   node scripts/clean-test-data.mjs --apply    지운다. 끝나면 다시 세어 0 인지 보여 준다
//
// 지우는 것은 셋이다.
//   1) dev 사이트의 광장 데이터 — `plaza_dev` 스키마의 모든 표(글 · 댓글 · 좋아요 · 대회 · 공지 · 관리자 · 익명 이름)
//   2) dev 사이트가 올린 그림 — 저장소 버킷 `plaza-dev` 의 모든 파일
//   3) 자동화로 생긴 익명 계정 — 접속 기록이 **전부** 자동화인 계정만:
//        화면 없는 브라우저(HeadlessChrome) · 스크립트 요청(python · curl) ·
//        자동화 도구의 휴대폰 흉내("Android 14; Pixel 7" — 실제 크롬은 이렇게 보내지 않는다. 위 자동화와 같은 접속 주소일 때만)
//      일반 브라우저 접속이 한 번이라도 섞인 계정, 광장에 글 · 댓글 · 좋아요 · 관리자 권한이 있는 계정은 건드리지 않는다.
// 건드리지 않는 것: `public` 스키마(운영 광장), 버킷 `plaza`, 실제 방문자의 계정, 검색엔진 봇이 만든 계정.
//
// 키: 환경변수 SUPABASE_TOKEN(Supabase 계정의 관리 토큰 — 대시보드 Account → Access Tokens). 없으면 front/.env.local 에서 읽는다.
// 값은 출력하지 않는다. 관리 API 의 응답은 필요한 숫자만 골라 낸다.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REF = 'vymkoklwautdxzgzccef'           // Supabase 프로젝트 pinkbean-customize
const DEV_SCHEMA = 'plaza_dev', DEV_BUCKET = 'plaza-dev'
// 자식 표부터 지운다(외래키)
const DEV_TABLES = ['plaza_alias', 'plaza_notice_comments', 'plaza_comments', 'plaza_likes', 'plaza_like_keys', 'plaza_post_keys', 'plaza_contest_entries', 'plaza_awards', 'plaza_posts', 'plaza_notices', 'plaza_admins', 'plaza_visits']
const OWNED = [['plaza_posts', 'owner'], ['plaza_comments', 'owner'], ['plaza_likes', 'owner'], ['plaza_like_keys', 'owner'], ['plaza_notice_comments', 'owner'], ['plaza_admins', 'uid']]

const apply = process.argv.includes('--apply')
const here = dirname(fileURLToPath(import.meta.url))
function key(name) {
  if (process.env[name]) return process.env[name]
  const f = join(here, '..', '.env.local')
  if (!existsSync(f)) return ''
  const m = readFileSync(f, 'utf8').split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).find((x) => x && x[1] === name)
  return m ? m[2].trim() : ''
}
const token = key('SUPABASE_TOKEN')
if (!token) { console.log('✗ SUPABASE_TOKEN 이 없다(환경변수 또는 front/.env.local)'); process.exit(1) }

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ query }) })
  const j = await r.json().catch(() => null)
  if (!r.ok || !Array.isArray(j)) throw new Error(`SQL 실패(${r.status}) ${JSON.stringify(j).slice(0, 200)}`)
  return j
}

// 자동화 계정: 접속 기록이 전부 자동화이고, 광장 어디에도 흔적이 없다
const AUTO_IP = `(select distinct ip from auth.sessions where user_agent ilike '%HeadlessChrome%')`
const AUTO = `(s.user_agent ilike '%HeadlessChrome%' or s.user_agent ~* '^(python|curl)' or (s.user_agent like '%Android 14; Pixel 7)%' and s.ip in ${AUTO_IP}))`
const NO_DATA = ['public', DEV_SCHEMA].flatMap((sc) => OWNED.map(([t, c]) => `not exists (select 1 from ${sc}.${t} x where x.${c}::text = u.id::text)`)).join(' and ')
const AUTO_USERS = `select u.id from auth.users u where u.is_anonymous
  and exists (select 1 from auth.sessions s where s.user_id = u.id)
  and not exists (select 1 from auth.sessions s where s.user_id = u.id and not ${AUTO})
  and ${NO_DATA}`

async function count() {
  const [row] = await sql(`select ${DEV_TABLES.map((t) => `(select count(*) from ${DEV_SCHEMA}.${t}) as ${t}`).join(', ')},
    (select count(*) from storage.objects where bucket_id = '${DEV_BUCKET}') as files,
    (select count(*) from (${AUTO_USERS}) t) as auto_users,
    (select count(*) from auth.users) as users_total, (select count(*) from public.plaza_posts) as prod_posts`)
  const rows = DEV_TABLES.reduce((n, t) => n + Number(row[t]), 0)
  console.log(`  dev 광장 행 ${rows}` + (rows ? ` (${DEV_TABLES.filter((t) => Number(row[t])).map((t) => `${t.replace('plaza_', '')} ${row[t]}`).join(' · ')})` : ''))
  console.log(`  dev 그림 파일 ${row.files}`)
  console.log(`  자동화 익명 계정 ${row.auto_users}`)
  console.log(`  (그대로 두는 것) 전체 계정 ${row.users_total} · 운영 광장 글 ${row.prod_posts}`)
  return { rows, files: Number(row.files), auto: Number(row.auto_users) }
}

// 저장소 파일은 표에서 지우면 실제 파일이 남는다 → 저장소 API 로 지운다(서비스 키는 관리 API 에서 받아 이 실행 동안만 쓴다)
async function removeFiles() {
  const names = (await sql(`select name from storage.objects where bucket_id = '${DEV_BUCKET}'`)).map((r) => r.name)
  if (!names.length) return 0
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, { headers: { Authorization: 'Bearer ' + token } })
  const keys = await r.json().catch(() => [])
  const service = (Array.isArray(keys) ? keys : []).find((k) => k.name === 'service_role')?.api_key
  if (!service) throw new Error('서비스 키를 받지 못했다 — 대시보드의 Storage 에서 버킷 plaza-dev 를 비운다')
  for (let i = 0; i < names.length; i += 100) {
    const d = await fetch(`https://${REF}.supabase.co/storage/v1/object/${DEV_BUCKET}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + service, apikey: service, 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: names.slice(i, i + 100) }) })
    if (!d.ok) throw new Error(`파일 삭제 실패(${d.status})`)
  }
  return names.length
}

console.log(apply ? '[지우기 전]' : '[세기만 한다 — 지우려면 --apply]')
const before = await count()
if (!apply) process.exit(0)
if (before.rows) for (const t of DEV_TABLES) await sql(`delete from ${DEV_SCHEMA}.${t}`)
if (before.files) await removeFiles()
if (before.auto) await sql(`with t as (${AUTO_USERS}), d as (delete from auth.users where id in (select id from t) returning 1) select count(*) as n from d`)
console.log('[지운 뒤]')
const after = await count()
if (after.rows || after.files || after.auto) { console.log('✗ 남은 것이 있다'); process.exit(1) }
console.log('· dev 데이터와 자동화 계정이 남아 있지 않다.')
