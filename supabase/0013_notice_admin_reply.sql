-- 공지 및 건의함: 운영자만 다는 답글 + 이 브라우저를 운영자로 등록하는 코드(2026-09-22 사용자 지시).
--
-- 요구: "공지 및 건의함에 관리자만 달 수 있는 댓글(답글). 내 컴퓨터 환경에 나만 인식되는 코드를 꽂아넣고,
--        그 환경에서 접속하면 답글을 달 수 있게. 같은 IP·같은 환경 다 필요 없이 지금 이 크롬에서만."
-- 설계:
--  · '이 브라우저' = 기기에 귀속된 익명 세션의 uid. 그 uid 를 plaza_admins 에 넣으면 **그 브라우저만** 운영자다.
--    localStorage 플래그 같은 건 클라이언트가 스스로 정하는 값이라 누구나 켤 수 있다 → 권한은 RLS 로 서버가 막는다.
--  · 등록 코드 값은 **DB 안에만** 둔다(앱 번들·저장소에 넣지 않는다). 주소창에 ?admin=<코드> 로 한 번 들어오면
--    plaza_admin_claim 이 그 세션의 uid 를 운영자로 올린다. 코드 표에는 읽기 정책이 없어 아무도 조회할 수 없다.
--  · 브라우저 데이터를 지우면 uid 가 바뀌므로 같은 코드로 다시 등록한다(코드는 재사용 가능, 필요하면 disabled_at 로 폐기).

-- ════════ public ════════
-- ① 답글 — 같은 표의 parent_id 로 한 단계만(광장 댓글 plaza_comments 와 같은 방식).
alter table public.plaza_notice_comments add column if not exists parent_id uuid references public.plaza_notice_comments(id) on delete cascade;
create index if not exists plaza_notice_cmt_parent_idx on public.plaza_notice_comments(parent_id) where parent_id is not null;

-- ② 답글은 운영자만 단다. 일반 건의·신고(parent_id is null)는 예전 그대로 누구나.
drop policy if exists plaza_notice_cmt_insert on public.plaza_notice_comments;
create policy plaza_notice_cmt_insert on public.plaza_notice_comments for insert
  with check (auth.uid() = owner and (parent_id is null or exists (select 1 from public.plaza_admins a where a.uid = auth.uid())));

-- 운영자는 어떤 댓글이든 지운다(부적절한 글 정리). 그 외는 자기 글만.
drop policy if exists plaza_notice_cmt_delete on public.plaza_notice_comments;
create policy plaza_notice_cmt_delete on public.plaza_notice_comments for delete
  using (auth.uid() = owner or exists (select 1 from public.plaza_admins a where a.uid = auth.uid()));

-- ③ 등록 코드 — 값은 여기에만 있다. RLS 켜고 정책을 두지 않아 어떤 키로도 읽히지 않는다(RPC 안에서만 본다).
create table if not exists public.plaza_admin_codes (
  code text primary key,
  note text,
  created_at timestamptz not null default now(),
  disabled_at timestamptz
);
alter table public.plaza_admin_codes enable row level security;

create or replace function public.plaza_admin_claim(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or coalesce(p_code, '') = '' then return false; end if;
  if not exists (select 1 from plaza_admin_codes c where c.code = p_code and c.disabled_at is null) then return false; end if;
  insert into plaza_admins(uid) values (v_uid) on conflict do nothing;
  return true;
end $$;
revoke all on function public.plaza_admin_claim(text) from public;
grant execute on function public.plaza_admin_claim(text) to anon, authenticated;

-- ════════ plaza_dev ════════
alter table plaza_dev.plaza_notice_comments add column if not exists parent_id uuid references plaza_dev.plaza_notice_comments(id) on delete cascade;
create index if not exists plaza_notice_cmt_parent_idx on plaza_dev.plaza_notice_comments(parent_id) where parent_id is not null;

drop policy if exists plaza_notice_cmt_insert on plaza_dev.plaza_notice_comments;
create policy plaza_notice_cmt_insert on plaza_dev.plaza_notice_comments for insert
  with check (auth.uid() = owner and (parent_id is null or exists (select 1 from plaza_dev.plaza_admins a where a.uid = auth.uid())));

drop policy if exists plaza_notice_cmt_delete on plaza_dev.plaza_notice_comments;
create policy plaza_notice_cmt_delete on plaza_dev.plaza_notice_comments for delete
  using (auth.uid() = owner or exists (select 1 from plaza_dev.plaza_admins a where a.uid = auth.uid()));

-- 코드 표는 public 것을 함께 쓴다(같은 코드로 dev·운영 각각 한 번씩 등록하면 된다).
create or replace function plaza_dev.plaza_admin_claim(p_code text) returns boolean
language plpgsql security definer set search_path = plaza_dev, public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or coalesce(p_code, '') = '' then return false; end if;
  if not exists (select 1 from public.plaza_admin_codes c where c.code = p_code and c.disabled_at is null) then return false; end if;
  insert into plaza_dev.plaza_admins(uid) values (v_uid) on conflict do nothing;
  return true;
end $$;
revoke all on function plaza_dev.plaza_admin_claim(text) from public;
grant execute on function plaza_dev.plaza_admin_claim(text) to anon, authenticated;
