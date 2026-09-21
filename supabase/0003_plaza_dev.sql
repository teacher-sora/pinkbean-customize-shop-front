-- 코디 광장 dev 분리 — 2026-09-20.
-- 무료 플랜은 조직당 프로젝트 2개까지라(이미 kotama-music-bot + pinkbean-customize) 프로젝트를 더 만들 수 없다.
-- 대신 같은 프로젝트 안에서 **스키마와 버킷**을 나눈다. 테이블 이름·구조는 public 과 완전히 같고,
-- 웹은 호스트로 고른다(운영 도메인 → public/plaza, 그 외 전부 → plaza_dev/plaza-dev).
--   · 인증(익명 로그인)은 프로젝트 공용이라 나누지 않는다. auth.uid() 는 양쪽에서 같은 사람이다.
--   · PostgREST 노출 스키마에 plaza_dev 를 추가해야 한다(Management API: postgrest.db_schema).

create schema if not exists plaza_dev;
grant usage on schema plaza_dev to anon, authenticated, service_role;

create table if not exists plaza_dev.plaza_posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  description text not null default '' check (char_length(description) <= 300),
  tags text[] not null default '{}' check (coalesce(array_length(tags, 1), 0) <= 5),
  snapshot jsonb not null,
  share_code text,
  image_path text,                  -- storage 'plaza-dev' 버킷의 경로
  contest boolean not null default false,
  like_count integer not null default 0
);
create index if not exists plaza_posts_created_idx on plaza_dev.plaza_posts (created_at desc);
create index if not exists plaza_posts_likes_idx on plaza_dev.plaza_posts (like_count desc, created_at desc);
create index if not exists plaza_posts_owner_idx on plaza_dev.plaza_posts (owner);

create table if not exists plaza_dev.plaza_likes (
  post_id uuid not null references plaza_dev.plaza_posts(id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, owner)
);

create table if not exists plaza_dev.plaza_contest_entries (
  post_id uuid primary key references plaza_dev.plaza_posts(id) on delete cascade,
  email text not null check (email ~ '^.+@.+\..+$'),
  created_at timestamptz not null default now()
);

create or replace function plaza_dev.plaza_like_count() returns trigger
language plpgsql security definer set search_path = plaza_dev as $$
begin
  if tg_op = 'INSERT' then
    update plaza_dev.plaza_posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update plaza_dev.plaza_posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
  end if;
  return null;
end $$;
drop trigger if exists plaza_likes_count on plaza_dev.plaza_likes;
create trigger plaza_likes_count after insert or delete on plaza_dev.plaza_likes
  for each row execute function plaza_dev.plaza_like_count();

alter table plaza_dev.plaza_posts enable row level security;
alter table plaza_dev.plaza_likes enable row level security;
alter table plaza_dev.plaza_contest_entries enable row level security;

drop policy if exists plaza_posts_read on plaza_dev.plaza_posts;
drop policy if exists plaza_posts_insert on plaza_dev.plaza_posts;
drop policy if exists plaza_posts_update on plaza_dev.plaza_posts;
drop policy if exists plaza_posts_delete on plaza_dev.plaza_posts;
create policy plaza_posts_read   on plaza_dev.plaza_posts for select using (true);
create policy plaza_posts_insert on plaza_dev.plaza_posts for insert to authenticated with check (auth.uid() = owner);
create policy plaza_posts_update on plaza_dev.plaza_posts for update to authenticated using (auth.uid() = owner) with check (auth.uid() = owner);
create policy plaza_posts_delete on plaza_dev.plaza_posts for delete to authenticated using (auth.uid() = owner);

drop policy if exists plaza_likes_read on plaza_dev.plaza_likes;
drop policy if exists plaza_likes_insert on plaza_dev.plaza_likes;
drop policy if exists plaza_likes_delete on plaza_dev.plaza_likes;
create policy plaza_likes_read   on plaza_dev.plaza_likes for select using (true);
create policy plaza_likes_insert on plaza_dev.plaza_likes for insert to authenticated with check (auth.uid() = owner);
create policy plaza_likes_delete on plaza_dev.plaza_likes for delete to authenticated using (auth.uid() = owner);

drop policy if exists plaza_contest_insert on plaza_dev.plaza_contest_entries;
create policy plaza_contest_insert on plaza_dev.plaza_contest_entries for insert to authenticated
  with check (exists (select 1 from plaza_dev.plaza_posts p where p.id = post_id and p.owner = auth.uid()));

grant select, insert, update, delete on all tables in schema plaza_dev to anon, authenticated;
alter default privileges in schema plaza_dev grant select, insert, update, delete on tables to anon, authenticated;

-- dev 전용 이미지 버킷
insert into storage.buckets (id, name, public) values ('plaza-dev', 'plaza-dev', true) on conflict (id) do nothing;
drop policy if exists plaza_dev_img_read on storage.objects;
drop policy if exists plaza_dev_img_insert on storage.objects;
drop policy if exists plaza_dev_img_delete on storage.objects;
create policy plaza_dev_img_read   on storage.objects for select using (bucket_id = 'plaza-dev');
create policy plaza_dev_img_insert on storage.objects for insert to authenticated with check (bucket_id = 'plaza-dev' and owner = auth.uid());
create policy plaza_dev_img_delete on storage.objects for delete to authenticated using (bucket_id = 'plaza-dev' and owner = auth.uid());
