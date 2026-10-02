-- 대회 수상 표시 — 2026-10-02 (사용자 지시: 블아 코디 대회 당첨 안내).
-- 대회 칸 맨 앞에 수상작을 고정하고 카드 왼쪽 위에 배지를 붙인다. 순서 = 1위 · 2위 · 3위 · 픽 · 픽 · 추첨.
--  · 글(plaza_posts)에 열을 더하지 않고 **따로 둔 표**다 — 누가 받았는지는 운영자만 정한다.
--    클라이언트는 읽기만 한다(쓰기 권한·정책이 아예 없다). 운영자가 대시보드(Table Editor → plaza_awards)나 SQL 로 넣는다.
--  · post_id 가 기본키라 글 하나에 수상은 하나, 목록 조회에 1:1 로 딸려 온다(app/api/plaza/shared.ts 의 plaza_awards(kind,seq)).
--  · 글이 내려가면 수상 행도 같이 사라진다(cascade).
--  · seq = 맨 앞에 놓이는 순서(1부터). 같은 kind(픽 둘) 사이의 순서도 이 값이 정한다.

-- ════════ public ════════
create table if not exists public.plaza_awards (
  post_id uuid primary key references public.plaza_posts(id) on delete cascade,
  kind text not null check (kind in ('rank1', 'rank2', 'rank3', 'pick', 'lucky')),
  seq smallint not null unique
);
alter table public.plaza_awards enable row level security;
revoke all on public.plaza_awards from anon, authenticated;
grant select on public.plaza_awards to anon, authenticated;
drop policy if exists plaza_awards_read on public.plaza_awards;
create policy plaza_awards_read on public.plaza_awards for select using (true);

-- ════════ plaza_dev ════════
create table if not exists plaza_dev.plaza_awards (
  post_id uuid primary key references plaza_dev.plaza_posts(id) on delete cascade,
  kind text not null check (kind in ('rank1', 'rank2', 'rank3', 'pick', 'lucky')),
  seq smallint not null unique
);
alter table plaza_dev.plaza_awards enable row level security;
revoke all on plaza_dev.plaza_awards from anon, authenticated;
grant select on plaza_dev.plaza_awards to anon, authenticated;
drop policy if exists plaza_awards_read on plaza_dev.plaza_awards;
create policy plaza_awards_read on plaza_dev.plaza_awards for select using (true);

notify pgrst, 'reload schema';
