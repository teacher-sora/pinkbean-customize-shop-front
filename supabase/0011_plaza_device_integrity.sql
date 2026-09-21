-- 코디 광장 운영 전 정비 — 2026-09-21 (사용자 지시: 인벤 공개 대회 전 최종 점검 결과 반영).
--
-- ① 기기 = 기기(브라우저·시크릿 창과 무관). 좋아요 1번 · 대회 출품 3개(삭제 후 재등록은 허용)는 **기기** 기준이다.
--    익명 로그인 uid 는 브라우저 저장소에 묶여 시크릿 창을 열 때마다 새로 생긴다(실측: 새 세션 3개로 좋아요 +3).
--    그래서 uid 와 별개로 '기기 키' = HMAC(비밀 솔트, 접속 네트워크 | 기기 특징)을 만든다.
--      · 접속 네트워크 = Cloudflare 가 붙이는 cf-connecting-ip(클라이언트가 위조해 보내면 403 — 실측). IPv6 는 /64(한 회선).
--      · 기기 특징 = 브라우저가 달라도 같은 값(OS · 터치 · 화면 크기 · 시간대 · GPU 제조사) — lib/plazaDevice.ts.
--      · 네트워크를 넣은 이유: 같은 기종(예: 같은 아이폰)은 기기 특징이 전부 같다 — 특징만 쓰면 전국의 같은 기종이 한 기기가 된다.
--    한계: 같은 네트워크의 같은 사양 기기는 한 기기로 묶이고, 네트워크를 바꾸면 다른 기기로 본다
--    (평소 창에서는 uid 도 함께 보므로 같은 브라우저로는 네트워크를 바꿔도 다시 누를 수 없다).
--    키는 비공개 표(plaza_like_keys · plaza_post_keys)에만 두고 클라이언트는 읽을 수 없다(솔트 HMAC — IP 역추적 불가).
-- ② 좋아요 수 · 작성 시각 · 대회 순번은 클라이언트가 못 바꾼다(실측: 본인 글 like_count 99999 · created_at 2030 으로 수정됐다).
--    글 수정 기능이 없으므로 UPDATE 권한 자체를 없앤다. 등록 · 좋아요는 RPC(plaza_submit · plaza_toggle_like)로만.
-- ③ 대회 마감: 2026-10-01 23:59(KST) 이후 대회 출품 · 대회 출품작 좋아요(누르기·취소)를 막는다(plaza_contest_deadline).
-- ④ 대회 출품은 이메일과 **한 트랜잭션**(이메일 없는 출품작이 생기지 않는다).
-- ⑤ 참고 이미지 버킷: 5MB · 이미지 형식만.
-- ⑥ 공지 및 건의함(간이): 공지는 운영자가 대시보드(Table Editor → plaza_notices)에서 쓰고, 댓글로 신고·건의를 받는다.

-- ── 공용 ──
create table if not exists public.plaza_secret (k text not null);
alter table public.plaza_secret enable row level security;
revoke all on public.plaza_secret from anon, authenticated;
insert into public.plaza_secret select encode(extensions.gen_random_bytes(32), 'hex') where not exists (select 1 from public.plaza_secret);

-- 이 시각부터 막힌다(= 10월 1일 오후 11시 59분까지). 바꿀 땐 이 함수만 다시 만든다.
create or replace function public.plaza_contest_deadline() returns timestamptz
language sql immutable as $$ select timestamptz '2026-10-02 00:00:00+09' $$;
grant execute on function public.plaza_contest_deadline() to anon, authenticated;

-- 요청한 기기의 키. fp = 기기 특징 문자열(클라이언트). 네트워크를 못 읽으면(대시보드 SQL 등) 'none'.
create or replace function public.plaza_device_key(fp text) returns text
language plpgsql stable security definer set search_path = public as $$
declare ip text; net text;
begin
  if fp is null or char_length(fp) < 8 or char_length(fp) > 300 then raise exception '기기 정보를 확인하지 못했어요'; end if;
  ip := nullif(current_setting('request.headers', true)::json->>'cf-connecting-ip', '');
  begin
    net := case when ip is null then 'none' when position(':' in ip) > 0 then network(set_masklen(ip::inet, 64))::text else host(ip::inet) end;
  exception when others then net := 'bad';
  end;
  return encode(extensions.hmac(net || '|' || fp, (select k from public.plaza_secret limit 1), 'sha256'), 'hex');
end $$;
revoke all on function public.plaza_device_key(text) from public, anon, authenticated;

-- 버킷 제한
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  where id in ('plaza', 'plaza-dev');

-- ════════ public ════════
-- 기기 키(비공개)
create table if not exists public.plaza_like_keys (
  post_id uuid not null references public.plaza_posts(id) on delete cascade,
  owner uuid not null,
  key text not null,
  primary key (post_id, key)
);
create index if not exists plaza_like_keys_owner_idx on public.plaza_like_keys (post_id, owner);
create table if not exists public.plaza_post_keys (
  post_id uuid primary key references public.plaza_posts(id) on delete cascade,
  key text not null
);
create index if not exists plaza_post_keys_key_idx on public.plaza_post_keys (key);
alter table public.plaza_like_keys enable row level security;
alter table public.plaza_post_keys enable row level security;
revoke all on public.plaza_like_keys, public.plaza_post_keys from anon, authenticated;

-- 직접 쓰기 권한 회수: 글은 지우기만, 좋아요·출품 이메일은 RPC 로만. (TRUNCATE 등 쓰지 않는 권한도 걷는다)
revoke all on public.plaza_posts, public.plaza_likes, public.plaza_contest_entries, public.plaza_comments from anon, authenticated;
grant select, delete on public.plaza_posts to anon, authenticated;
grant select on public.plaza_likes to anon, authenticated;
grant select, insert, delete on public.plaza_comments to anon, authenticated;
drop policy if exists plaza_posts_insert on public.plaza_posts;
drop policy if exists plaza_posts_update on public.plaza_posts;
drop policy if exists plaza_likes_insert on public.plaza_likes;
drop policy if exists plaza_likes_delete on public.plaza_likes;
drop policy if exists plaza_contest_insert on public.plaza_contest_entries;

-- 서버가 정하는 값(RPC 를 거치지 않는 경로가 생겨도 지켜지게 트리거로도 건다 — 이름 'aa' 로 가장 먼저 돈다).
create or replace function public.plaza_post_force() returns trigger
language plpgsql as $$
begin
  new.created_at := now(); new.like_count := 0; new.contest_no := null;
  return new;
end $$;
drop trigger if exists plaza_posts_aa_force on public.plaza_posts;
create trigger plaza_posts_aa_force before insert on public.plaza_posts for each row execute function public.plaza_post_force();

-- 등록(자유·대회). p = { name, description, tags[], snapshot, share_code, image_path, image_view, contest }.
create or replace function public.plaza_submit(p jsonb, email text, fp text) returns public.plaza_posts
language plpgsql security definer set search_path = public, public as $$
declare uid uuid := auth.uid(); k text; is_contest boolean := coalesce((p->>'contest')::boolean, false); n int; r public.plaza_posts; img text := nullif(p->>'image_path', '');
begin
  if uid is null then raise exception '로그인 정보를 확인하지 못했어요'; end if;
  k := public.plaza_device_key(fp);
  if img is not null and img not like uid::text || '/%' then raise exception '이미지 경로가 올바르지 않아요'; end if;
  if is_contest then
    if now() >= public.plaza_contest_deadline() then raise exception '대회 출품이 마감됐어요'; end if;
    if email is null or email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception '이메일을 확인해 주세요'; end if;
    perform pg_advisory_xact_lock(hashtext('plaza_contest:public'));
    select count(*) into n from public.plaza_posts q
      where q.contest and (q.owner = uid or exists (select 1 from public.plaza_post_keys pk where pk.post_id = q.id and pk.key = k));
    if n >= 3 then raise exception '대회에는 기기당 3개까지 올릴 수 있어요' using errcode = '23514'; end if;
  end if;
  insert into public.plaza_posts (owner, name, description, tags, snapshot, share_code, image_path, image_view, contest)
  values (uid, p->>'name', coalesce(p->>'description', ''),
          coalesce((select array_agg(t) from jsonb_array_elements_text(coalesce(p->'tags', '[]'::jsonb)) t), '{}'),
          p->'snapshot', nullif(p->>'share_code', ''), img, case when img is null then null else p->'image_view' end, is_contest)
  returning * into r;
  insert into public.plaza_post_keys (post_id, key) values (r.id, k);
  if is_contest then insert into public.plaza_contest_entries (post_id, email) values (r.id, btrim(email)); end if;
  return r;
end $$;

-- 좋아요 누르기/취소. 이 기기(키) 또는 이 브라우저(uid)가 이미 눌렀으면 취소, 아니면 누른다.
create or replace function public.plaza_toggle_like(pid uuid, fp text) returns jsonb
language plpgsql security definer set search_path = public, public as $$
declare uid uuid := auth.uid(); k text; c boolean; had boolean; n int;
begin
  if uid is null then raise exception '로그인 정보를 확인하지 못했어요'; end if;
  k := public.plaza_device_key(fp);
  select contest into c from public.plaza_posts where id = pid;
  if not found then raise exception '내려간 코디예요'; end if;
  if c and now() >= public.plaza_contest_deadline() then raise exception '대회 투표가 마감됐어요'; end if;
  perform pg_advisory_xact_lock(hashtext('plaza_like:' || pid::text || ':' || k));
  had := exists (select 1 from public.plaza_likes l where l.post_id = pid and l.owner = uid)
      or exists (select 1 from public.plaza_like_keys lk where lk.post_id = pid and lk.key = k);
  if had then
    delete from public.plaza_likes l where l.post_id = pid
      and (l.owner = uid or l.owner in (select lk.owner from public.plaza_like_keys lk where lk.post_id = pid and lk.key = k));
    delete from public.plaza_like_keys lk where lk.post_id = pid and (lk.owner = uid or lk.key = k);
  else
    insert into public.plaza_likes (post_id, owner) values (pid, uid);
    insert into public.plaza_like_keys (post_id, owner, key) values (pid, uid, k);
  end if;
  select like_count into n from public.plaza_posts where id = pid;
  return jsonb_build_object('liked', not had, 'likes', n);
end $$;

-- 내 상태: 이 기기·브라우저가 좋아요한 글, 이 기기가 올린 대회 출품 수.
create or replace function public.plaza_me(fp text) returns jsonb
language plpgsql stable security definer set search_path = public, public as $$
declare uid uuid := auth.uid(); k text := public.plaza_device_key(fp);
begin
  return jsonb_build_object(
    'liked', coalesce((select jsonb_agg(x) from (
      select post_id x from public.plaza_likes where owner = uid
      union select post_id from public.plaza_like_keys where key = k) t), '[]'::jsonb),
    'contest', (select count(*) from public.plaza_posts q where q.contest
                 and (q.owner = uid or exists (select 1 from public.plaza_post_keys pk where pk.post_id = q.id and pk.key = k))));
end $$;

revoke all on function public.plaza_submit(jsonb, text, text), public.plaza_toggle_like(uuid, text), public.plaza_me(text) from public, anon;
grant execute on function public.plaza_submit(jsonb, text, text), public.plaza_toggle_like(uuid, text), public.plaza_me(text) to authenticated;

-- 공지 및 건의함(간이). 공지는 운영자만(대시보드) — 클라이언트 쓰기 권한 없음. 댓글은 익명 누구나(본인 것만 지우기).
create table if not exists public.plaza_notices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '',
  pinned boolean not null default false
);
create table if not exists public.plaza_notice_comments (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.plaza_notices(id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists plaza_notice_comments_idx on public.plaza_notice_comments (notice_id, created_at desc);
-- 운영자 표시(댓글에 '운영자'). uid 는 운영자가 알려 주면 넣는다.
create table if not exists public.plaza_admins (uid uuid primary key);
alter table public.plaza_notices enable row level security;
alter table public.plaza_notice_comments enable row level security;
alter table public.plaza_admins enable row level security;
revoke all on public.plaza_notices, public.plaza_notice_comments, public.plaza_admins from anon, authenticated;
grant select on public.plaza_notices, public.plaza_admins to anon, authenticated;
grant select, insert, delete on public.plaza_notice_comments to anon, authenticated;
drop policy if exists plaza_notices_read on public.plaza_notices;
drop policy if exists plaza_admins_read on public.plaza_admins;
drop policy if exists plaza_notice_cmt_read on public.plaza_notice_comments;
drop policy if exists plaza_notice_cmt_insert on public.plaza_notice_comments;
drop policy if exists plaza_notice_cmt_delete on public.plaza_notice_comments;
create policy plaza_notices_read on public.plaza_notices for select using (true);
create policy plaza_admins_read on public.plaza_admins for select using (true);
create policy plaza_notice_cmt_read on public.plaza_notice_comments for select using (true);
create policy plaza_notice_cmt_insert on public.plaza_notice_comments for insert to authenticated with check (auth.uid() = owner);
create policy plaza_notice_cmt_delete on public.plaza_notice_comments for delete to authenticated using (auth.uid() = owner);

-- ════════ plaza_dev ════════
-- 기기 키(비공개)
create table if not exists plaza_dev.plaza_like_keys (
  post_id uuid not null references plaza_dev.plaza_posts(id) on delete cascade,
  owner uuid not null,
  key text not null,
  primary key (post_id, key)
);
create index if not exists plaza_like_keys_owner_idx on plaza_dev.plaza_like_keys (post_id, owner);
create table if not exists plaza_dev.plaza_post_keys (
  post_id uuid primary key references plaza_dev.plaza_posts(id) on delete cascade,
  key text not null
);
create index if not exists plaza_post_keys_key_idx on plaza_dev.plaza_post_keys (key);
alter table plaza_dev.plaza_like_keys enable row level security;
alter table plaza_dev.plaza_post_keys enable row level security;
revoke all on plaza_dev.plaza_like_keys, plaza_dev.plaza_post_keys from anon, authenticated;

-- 직접 쓰기 권한 회수: 글은 지우기만, 좋아요·출품 이메일은 RPC 로만. (TRUNCATE 등 쓰지 않는 권한도 걷는다)
revoke all on plaza_dev.plaza_posts, plaza_dev.plaza_likes, plaza_dev.plaza_contest_entries, plaza_dev.plaza_comments from anon, authenticated;
grant select, delete on plaza_dev.plaza_posts to anon, authenticated;
grant select on plaza_dev.plaza_likes to anon, authenticated;
grant select, insert, delete on plaza_dev.plaza_comments to anon, authenticated;
drop policy if exists plaza_posts_insert on plaza_dev.plaza_posts;
drop policy if exists plaza_posts_update on plaza_dev.plaza_posts;
drop policy if exists plaza_likes_insert on plaza_dev.plaza_likes;
drop policy if exists plaza_likes_delete on plaza_dev.plaza_likes;
drop policy if exists plaza_contest_insert on plaza_dev.plaza_contest_entries;

-- 서버가 정하는 값(RPC 를 거치지 않는 경로가 생겨도 지켜지게 트리거로도 건다 — 이름 'aa' 로 가장 먼저 돈다).
create or replace function plaza_dev.plaza_post_force() returns trigger
language plpgsql as $$
begin
  new.created_at := now(); new.like_count := 0; new.contest_no := null;
  return new;
end $$;
drop trigger if exists plaza_posts_aa_force on plaza_dev.plaza_posts;
create trigger plaza_posts_aa_force before insert on plaza_dev.plaza_posts for each row execute function plaza_dev.plaza_post_force();

-- 등록(자유·대회). p = { name, description, tags[], snapshot, share_code, image_path, image_view, contest }.
create or replace function plaza_dev.plaza_submit(p jsonb, email text, fp text) returns plaza_dev.plaza_posts
language plpgsql security definer set search_path = plaza_dev, public as $$
declare uid uuid := auth.uid(); k text; is_contest boolean := coalesce((p->>'contest')::boolean, false); n int; r plaza_dev.plaza_posts; img text := nullif(p->>'image_path', '');
begin
  if uid is null then raise exception '로그인 정보를 확인하지 못했어요'; end if;
  k := public.plaza_device_key(fp);
  if img is not null and img not like uid::text || '/%' then raise exception '이미지 경로가 올바르지 않아요'; end if;
  if is_contest then
    if now() >= public.plaza_contest_deadline() then raise exception '대회 출품이 마감됐어요'; end if;
    if email is null or email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception '이메일을 확인해 주세요'; end if;
    perform pg_advisory_xact_lock(hashtext('plaza_contest:plaza_dev'));
    select count(*) into n from plaza_dev.plaza_posts q
      where q.contest and (q.owner = uid or exists (select 1 from plaza_dev.plaza_post_keys pk where pk.post_id = q.id and pk.key = k));
    if n >= 3 then raise exception '대회에는 기기당 3개까지 올릴 수 있어요' using errcode = '23514'; end if;
  end if;
  insert into plaza_dev.plaza_posts (owner, name, description, tags, snapshot, share_code, image_path, image_view, contest)
  values (uid, p->>'name', coalesce(p->>'description', ''),
          coalesce((select array_agg(t) from jsonb_array_elements_text(coalesce(p->'tags', '[]'::jsonb)) t), '{}'),
          p->'snapshot', nullif(p->>'share_code', ''), img, case when img is null then null else p->'image_view' end, is_contest)
  returning * into r;
  insert into plaza_dev.plaza_post_keys (post_id, key) values (r.id, k);
  if is_contest then insert into plaza_dev.plaza_contest_entries (post_id, email) values (r.id, btrim(email)); end if;
  return r;
end $$;

-- 좋아요 누르기/취소. 이 기기(키) 또는 이 브라우저(uid)가 이미 눌렀으면 취소, 아니면 누른다.
create or replace function plaza_dev.plaza_toggle_like(pid uuid, fp text) returns jsonb
language plpgsql security definer set search_path = plaza_dev, public as $$
declare uid uuid := auth.uid(); k text; c boolean; had boolean; n int;
begin
  if uid is null then raise exception '로그인 정보를 확인하지 못했어요'; end if;
  k := public.plaza_device_key(fp);
  select contest into c from plaza_dev.plaza_posts where id = pid;
  if not found then raise exception '내려간 코디예요'; end if;
  if c and now() >= public.plaza_contest_deadline() then raise exception '대회 투표가 마감됐어요'; end if;
  perform pg_advisory_xact_lock(hashtext('plaza_like:' || pid::text || ':' || k));
  had := exists (select 1 from plaza_dev.plaza_likes l where l.post_id = pid and l.owner = uid)
      or exists (select 1 from plaza_dev.plaza_like_keys lk where lk.post_id = pid and lk.key = k);
  if had then
    delete from plaza_dev.plaza_likes l where l.post_id = pid
      and (l.owner = uid or l.owner in (select lk.owner from plaza_dev.plaza_like_keys lk where lk.post_id = pid and lk.key = k));
    delete from plaza_dev.plaza_like_keys lk where lk.post_id = pid and (lk.owner = uid or lk.key = k);
  else
    insert into plaza_dev.plaza_likes (post_id, owner) values (pid, uid);
    insert into plaza_dev.plaza_like_keys (post_id, owner, key) values (pid, uid, k);
  end if;
  select like_count into n from plaza_dev.plaza_posts where id = pid;
  return jsonb_build_object('liked', not had, 'likes', n);
end $$;

-- 내 상태: 이 기기·브라우저가 좋아요한 글, 이 기기가 올린 대회 출품 수.
create or replace function plaza_dev.plaza_me(fp text) returns jsonb
language plpgsql stable security definer set search_path = plaza_dev, public as $$
declare uid uuid := auth.uid(); k text := public.plaza_device_key(fp);
begin
  return jsonb_build_object(
    'liked', coalesce((select jsonb_agg(x) from (
      select post_id x from plaza_dev.plaza_likes where owner = uid
      union select post_id from plaza_dev.plaza_like_keys where key = k) t), '[]'::jsonb),
    'contest', (select count(*) from plaza_dev.plaza_posts q where q.contest
                 and (q.owner = uid or exists (select 1 from plaza_dev.plaza_post_keys pk where pk.post_id = q.id and pk.key = k))));
end $$;

revoke all on function plaza_dev.plaza_submit(jsonb, text, text), plaza_dev.plaza_toggle_like(uuid, text), plaza_dev.plaza_me(text) from public, anon;
grant execute on function plaza_dev.plaza_submit(jsonb, text, text), plaza_dev.plaza_toggle_like(uuid, text), plaza_dev.plaza_me(text) to authenticated;

-- 공지 및 건의함(간이). 공지는 운영자만(대시보드) — 클라이언트 쓰기 권한 없음. 댓글은 익명 누구나(본인 것만 지우기).
create table if not exists plaza_dev.plaza_notices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '',
  pinned boolean not null default false
);
create table if not exists plaza_dev.plaza_notice_comments (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references plaza_dev.plaza_notices(id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists plaza_notice_comments_idx on plaza_dev.plaza_notice_comments (notice_id, created_at desc);
-- 운영자 표시(댓글에 '운영자'). uid 는 운영자가 알려 주면 넣는다.
create table if not exists plaza_dev.plaza_admins (uid uuid primary key);
alter table plaza_dev.plaza_notices enable row level security;
alter table plaza_dev.plaza_notice_comments enable row level security;
alter table plaza_dev.plaza_admins enable row level security;
revoke all on plaza_dev.plaza_notices, plaza_dev.plaza_notice_comments, plaza_dev.plaza_admins from anon, authenticated;
grant select on plaza_dev.plaza_notices, plaza_dev.plaza_admins to anon, authenticated;
grant select, insert, delete on plaza_dev.plaza_notice_comments to anon, authenticated;
drop policy if exists plaza_notices_read on plaza_dev.plaza_notices;
drop policy if exists plaza_admins_read on plaza_dev.plaza_admins;
drop policy if exists plaza_notice_cmt_read on plaza_dev.plaza_notice_comments;
drop policy if exists plaza_notice_cmt_insert on plaza_dev.plaza_notice_comments;
drop policy if exists plaza_notice_cmt_delete on plaza_dev.plaza_notice_comments;
create policy plaza_notices_read on plaza_dev.plaza_notices for select using (true);
create policy plaza_admins_read on plaza_dev.plaza_admins for select using (true);
create policy plaza_notice_cmt_read on plaza_dev.plaza_notice_comments for select using (true);
create policy plaza_notice_cmt_insert on plaza_dev.plaza_notice_comments for insert to authenticated with check (auth.uid() = owner);
create policy plaza_notice_cmt_delete on plaza_dev.plaza_notice_comments for delete to authenticated using (auth.uid() = owner);

notify pgrst, 'reload schema';
