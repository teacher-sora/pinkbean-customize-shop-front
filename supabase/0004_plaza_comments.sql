-- 코디 광장 댓글 — 2026-09-20.
-- 운영(public)과 dev(plaza_dev) 두 스키마에 같은 모양으로 만든다(0003 과 같은 규칙).
--  · 계정이 없으므로 이름은 저장하지 않는다. 화면에서 글쓴이/나/익명N 으로만 구분한다(owner uuid 기준).
--  · 지우기는 **본인 + 그 글의 주인** 둘 다 허용한다. 신고 화면이 없는 동안 글 주인이 자기 글을 정리할 수 있어야 한다.
--  · 길이 제한은 DB 에서도 건다(화면 제한만 믿지 않는다).

-- ── 운영(public) ──
create table if not exists public.plaza_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.plaza_posts(id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 200),
  created_at timestamptz not null default now()
  -- parent_id(답글)는 0005_plaza_comment_replies.sql 에서 붙인다.
);
create index if not exists plaza_comments_post_idx on public.plaza_comments (post_id, created_at);

alter table public.plaza_comments enable row level security;
drop policy if exists plaza_comments_read on public.plaza_comments;
drop policy if exists plaza_comments_insert on public.plaza_comments;
drop policy if exists plaza_comments_delete on public.plaza_comments;
create policy plaza_comments_read   on public.plaza_comments for select using (true);
create policy plaza_comments_insert on public.plaza_comments for insert to authenticated with check (auth.uid() = owner);
create policy plaza_comments_delete on public.plaza_comments for delete to authenticated using (
  auth.uid() = owner
  or exists (select 1 from public.plaza_posts p where p.id = post_id and p.owner = auth.uid())
);
grant select, insert, delete on public.plaza_comments to anon, authenticated;

-- ── dev(plaza_dev) ──
create table if not exists plaza_dev.plaza_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references plaza_dev.plaza_posts(id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 200),
  created_at timestamptz not null default now()
  -- parent_id(답글)는 0005_plaza_comment_replies.sql 에서 붙인다.
);
create index if not exists plaza_comments_post_idx on plaza_dev.plaza_comments (post_id, created_at);

alter table plaza_dev.plaza_comments enable row level security;
drop policy if exists plaza_comments_read on plaza_dev.plaza_comments;
drop policy if exists plaza_comments_insert on plaza_dev.plaza_comments;
drop policy if exists plaza_comments_delete on plaza_dev.plaza_comments;
create policy plaza_comments_read   on plaza_dev.plaza_comments for select using (true);
create policy plaza_comments_insert on plaza_dev.plaza_comments for insert to authenticated with check (auth.uid() = owner);
create policy plaza_comments_delete on plaza_dev.plaza_comments for delete to authenticated using (
  auth.uid() = owner
  or exists (select 1 from plaza_dev.plaza_posts p where p.id = post_id and p.owner = auth.uid())
);
grant select, insert, delete on plaza_dev.plaza_comments to anon, authenticated;
