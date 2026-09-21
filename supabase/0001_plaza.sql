-- 코디 광장(handoff_v2_plaza) — 2026-09-20 임시 구축용 스키마.
-- (옛 정리용 0002_plaza_drop.sql 은 2026-09-21 운영 준비로 지웠다 — 대회 데이터를 통째로 날릴 수 있는 파일이라.)
-- 사용자 구분 = Supabase 익명 로그인(auth.uid()). 계정 없이도 '내 등록'·좋아요·내리기 권한을 RLS 로 막는다.

create table if not exists public.plaza_posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  description text not null default '' check (char_length(description) <= 300),
  tags text[] not null default '{}' check (coalesce(array_length(tags, 1), 0) <= 5),
  snapshot jsonb not null,          -- 코디 스냅샷(프리셋과 같은 모양) → 카드·상세·가져오기에 그대로 사용
  share_code text,                  -- 기존 R2 공유 코드(PB-xxxxxxxx) — 링크 복사·카톡 카드 재사용
  image_path text,                  -- storage 'plaza' 버킷의 경로(참조 이미지 1장, 선택)
  contest boolean not null default false,
  like_count integer not null default 0
);
create index if not exists plaza_posts_created_idx on public.plaza_posts (created_at desc);
create index if not exists plaza_posts_likes_idx on public.plaza_posts (like_count desc, created_at desc);
create index if not exists plaza_posts_owner_idx on public.plaza_posts (owner);

create table if not exists public.plaza_likes (
  post_id uuid not null references public.plaza_posts(id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, owner)
);

-- 대회 응모 이메일: 읽기 정책이 없어 공개 조회가 불가능하다(등록만 가능).
create table if not exists public.plaza_contest_entries (
  post_id uuid primary key references public.plaza_posts(id) on delete cascade,
  email text not null check (email ~ '^.+@.+\..+$'),
  created_at timestamptz not null default now()
);

-- 좋아요 수는 집계 쿼리 대신 열로 유지(목록 정렬이 인기순이라 매번 세면 느리다).
create or replace function public.plaza_like_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.plaza_posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.plaza_posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
  end if;
  return null;
end $$;
drop trigger if exists plaza_likes_count on public.plaza_likes;
create trigger plaza_likes_count after insert or delete on public.plaza_likes
  for each row execute function public.plaza_like_count();

alter table public.plaza_posts enable row level security;
alter table public.plaza_likes enable row level security;
alter table public.plaza_contest_entries enable row level security;

drop policy if exists plaza_posts_read on public.plaza_posts;
drop policy if exists plaza_posts_insert on public.plaza_posts;
drop policy if exists plaza_posts_update on public.plaza_posts;
drop policy if exists plaza_posts_delete on public.plaza_posts;
create policy plaza_posts_read   on public.plaza_posts for select using (true);
create policy plaza_posts_insert on public.plaza_posts for insert to authenticated with check (auth.uid() = owner);
create policy plaza_posts_update on public.plaza_posts for update to authenticated using (auth.uid() = owner) with check (auth.uid() = owner);
create policy plaza_posts_delete on public.plaza_posts for delete to authenticated using (auth.uid() = owner);

drop policy if exists plaza_likes_read on public.plaza_likes;
drop policy if exists plaza_likes_insert on public.plaza_likes;
drop policy if exists plaza_likes_delete on public.plaza_likes;
create policy plaza_likes_read   on public.plaza_likes for select using (true);
create policy plaza_likes_insert on public.plaza_likes for insert to authenticated with check (auth.uid() = owner);
create policy plaza_likes_delete on public.plaza_likes for delete to authenticated using (auth.uid() = owner);

drop policy if exists plaza_contest_insert on public.plaza_contest_entries;
create policy plaza_contest_insert on public.plaza_contest_entries for insert to authenticated
  with check (exists (select 1 from public.plaza_posts p where p.id = post_id and p.owner = auth.uid()));

-- 참조 이미지 버킷(공개 읽기, 본인 파일만 쓰기·삭제)
insert into storage.buckets (id, name, public) values ('plaza', 'plaza', true) on conflict (id) do nothing;
drop policy if exists plaza_img_read on storage.objects;
drop policy if exists plaza_img_insert on storage.objects;
drop policy if exists plaza_img_delete on storage.objects;
create policy plaza_img_read   on storage.objects for select using (bucket_id = 'plaza');
create policy plaza_img_insert on storage.objects for insert to authenticated with check (bucket_id = 'plaza' and owner = auth.uid());
create policy plaza_img_delete on storage.objects for delete to authenticated using (bucket_id = 'plaza' and owner = auth.uid());
