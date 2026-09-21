-- 대회 '같은 조합' 선점 + 태그 10개 — 2026-09-21.
--
-- 대회에는 **완전히 같은 조합을 한 번만** 받는다. 같은 조합이 여러 번 올라오면 좋아요가 나뉘어,
-- 먼저 가장 어울리는 코디를 올린 사람이 존중받지 못한다(사용자 지시 — '가장 어울리는 코디 선착순 대회').
-- 본인 출품작끼리만이 아니라 **대회에 올라온 전체 출품작**과 대조한다.
--
-- 조합 = 착용 아이템 · 피부 · 염색(팔레트/HSB/끔) · 숨김. 점 위치와 연출(액션·표정·이펙트)은 보지 않는다
-- — 점을 1px 옮기거나 표정만 바꿔 같은 코디를 다시 올리는 걸 막으려는 것이다.
-- 클라이언트의 lookKey(ShopContext)는 이 규칙을 따라 한 **안내용**이고, 실제로 막는 건 아래 트리거 + 유일 인덱스다.
-- 트리거는 읽기 쉬운 안내 문구를 내고, 동시에 두 요청이 들어오는 경쟁은 유일 인덱스가 막는다.

create or replace function public.plaza_look_key(s jsonb) returns text
language sql immutable as $$
  select md5(jsonb_build_object(
    'e', coalesce(s->'equipped', '{}'::jsonb),
    't', coalesce(s->'tone', 'null'::jsonb),
    'p', coalesce(s->'dyePalette', '{}'::jsonb),
    'h', coalesce(s->'dyeHsb', '{}'::jsonb),
    -- 끔/숨김은 true 인 것만 의미가 있다({"hair": false} 와 {} 를 같게 본다)
    'o', coalesce((select jsonb_object_agg(k, v) from jsonb_each(coalesce(s->'dyeOff', '{}'::jsonb)) as x(k, v) where v = 'true'::jsonb), '{}'::jsonb),
    'x', coalesce((select jsonb_object_agg(k, v) from jsonb_each(coalesce(s->'hidden', '{}'::jsonb)) as x(k, v) where v = 'true'::jsonb), '{}'::jsonb)
  )::text)
$$;

-- ── public ──
alter table public.plaza_posts add column if not exists look_key text;
update public.plaza_posts set look_key = public.plaza_look_key(snapshot) where look_key is null;

create or replace function public.plaza_set_look_key() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.look_key := public.plaza_look_key(new.snapshot);
  if new.contest and exists (
    select 1 from public.plaza_posts p where p.contest and p.look_key = new.look_key and p.id <> new.id
  ) then
    raise exception '같은 조합이 이미 대회에 출품돼 있어요';
  end if;
  return new;
end $$;
drop trigger if exists plaza_posts_look_key on public.plaza_posts;
create trigger plaza_posts_look_key before insert or update of snapshot, contest on public.plaza_posts
  for each row execute function public.plaza_set_look_key();
create unique index if not exists plaza_posts_contest_look_uq on public.plaza_posts (look_key) where contest;

alter table public.plaza_posts drop constraint if exists plaza_posts_tags_check;
alter table public.plaza_posts add constraint plaza_posts_tags_check check (coalesce(array_length(tags, 1), 0) <= 10);

-- ── plaza_dev ──
alter table plaza_dev.plaza_posts add column if not exists look_key text;
update plaza_dev.plaza_posts set look_key = public.plaza_look_key(snapshot) where look_key is null;

create or replace function plaza_dev.plaza_set_look_key() returns trigger
language plpgsql security definer set search_path = plaza_dev as $$
begin
  new.look_key := public.plaza_look_key(new.snapshot);
  if new.contest and exists (
    select 1 from plaza_dev.plaza_posts p where p.contest and p.look_key = new.look_key and p.id <> new.id
  ) then
    raise exception '같은 조합이 이미 대회에 출품돼 있어요';
  end if;
  return new;
end $$;
drop trigger if exists plaza_posts_look_key on plaza_dev.plaza_posts;
create trigger plaza_posts_look_key before insert or update of snapshot, contest on plaza_dev.plaza_posts
  for each row execute function plaza_dev.plaza_set_look_key();
create unique index if not exists plaza_posts_contest_look_uq on plaza_dev.plaza_posts (look_key) where contest;

alter table plaza_dev.plaza_posts drop constraint if exists plaza_posts_tags_check;
alter table plaza_dev.plaza_posts add constraint plaza_posts_tags_check check (coalesce(array_length(tags, 1), 0) <= 10);
