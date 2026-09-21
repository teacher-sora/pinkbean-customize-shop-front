-- 대회 같은 조합: 염색 허용 오차 · 등록 순번 · 참고 이미지 첫 화면 — 2026-09-21.
--
-- ① 0007 은 '완전히 같은' 조합만 막았다. 염색을 한 칸만 돌려도 다른 조합이 됐는데, 그런 차이는 눈으로 거의 구분되지 않는다.
--    그래서 두 단계로 본다(클라이언트 lib/plazaLook.ts 와 같은 규칙).
--      뼈대(look_key): 착용 · 피부 · 숨김 · 염색 끔 · 팔레트의 '고른 색'(기본색·믹스색) — 다르면 다른 조합.
--      염색 수치: 뼈대가 같으면 HSB 색조 ±20°(순환) · 채도 ±20 · 명도 ±20 · 팔레트 믹스 비율 ±20 안이면 **같은 조합**.
--    허용 오차가 있으면 유일 인덱스로는 막을 수 없다 → 0007 의 인덱스를 지우고, 트리거가 스키마별 잠금을 잡은 채
--    기존 출품작과 하나씩 비교한다(동시에 두 요청이 와도 차례로 검사돼 둘 다 통과하는 일이 없다).
-- ② contest_no: 대회 등록 순번(1, 2, 3 …). 같은 잠금 안에서 매긴다 — 누가 먼저 올렸는지 화면에 보인다.
--    지워진 출품작의 번호는 다시 쓰지 않는다(max + 1).
-- ③ image_view: 참고 이미지를 **처음 열었을 때 보일 자리**(올린 사람이 등록 때 고른다). 원본은 자르지 않는다.
--    { "fx": 0~1, "fy": 0~1, "zc": 배율 } — 그림에서 칸 가운데에 올 점과, 칸을 꽉 채우는 배율(cover) 대비 배율.

create or replace function public.plaza_look_key(s jsonb) returns text
language sql immutable as $$
  select md5(jsonb_build_object(
    'e', coalesce(s->'equipped', '{}'::jsonb),
    't', coalesce(s->'tone', 'null'::jsonb),
    'o', coalesce((select jsonb_object_agg(k, v) from jsonb_each(coalesce(s->'dyeOff', '{}'::jsonb)) as x(k, v) where v = 'true'::jsonb), '{}'::jsonb),
    'x', coalesce((select jsonb_object_agg(k, v) from jsonb_each(coalesce(s->'hidden', '{}'::jsonb)) as x(k, v) where v = 'true'::jsonb), '{}'::jsonb),
    'p', coalesce((select jsonb_object_agg(k, jsonb_build_object('b', v->'baseColor', 'm', coalesce(v->'mixColor', 'null'::jsonb)))
                   from jsonb_each(coalesce(s->'dyePalette', '{}'::jsonb)) as x(k, v)), '{}'::jsonb)
  )::text)
$$;

create or replace function public.plaza_look_similar(a jsonb, b jsonb) returns boolean
language plpgsql immutable as $$
declare k text; x jsonb; y jsonb; d numeric;
begin
  for k in select jsonb_object_keys(coalesce(a->'dyeHsb', '{}'::jsonb)) union select jsonb_object_keys(coalesce(b->'dyeHsb', '{}'::jsonb)) loop
    x := coalesce(a->'dyeHsb'->k, '{}'::jsonb); y := coalesce(b->'dyeHsb'->k, '{}'::jsonb);
    if coalesce((x->>'t')::numeric, 0) <> coalesce((y->>'t')::numeric, 0) then return false; end if;
    d := abs(coalesce((x->>'h')::numeric, 0) - coalesce((y->>'h')::numeric, 0)) % 360;
    if least(d, 360 - d) > 20 then return false; end if;
    if abs(coalesce((x->>'s')::numeric, 0) - coalesce((y->>'s')::numeric, 0)) > 20 then return false; end if;
    if abs(coalesce((x->>'b')::numeric, 0) - coalesce((y->>'b')::numeric, 0)) > 20 then return false; end if;
  end loop;
  for k in select jsonb_object_keys(coalesce(a->'dyePalette', '{}'::jsonb)) loop
    x := a->'dyePalette'->k; y := b->'dyePalette'->k;
    if y is null then return false; end if;
    if (x->>'mixColor') is not null and abs(coalesce((x->>'ratio')::numeric, 0) - coalesce((y->>'ratio')::numeric, 0)) > 20 then return false; end if;
  end loop;
  return true;
end $$;

-- ── public ──
drop index if exists public.plaza_posts_contest_look_uq;
alter table public.plaza_posts add column if not exists contest_no int;
alter table public.plaza_posts add column if not exists image_view jsonb;
update public.plaza_posts set look_key = public.plaza_look_key(snapshot);
update public.plaza_posts p set contest_no = n.rn
  from (select id, row_number() over (order by created_at, id) rn from public.plaza_posts where contest) n
  where p.id = n.id and p.contest_no is null;

create or replace function public.plaza_set_look_key() returns trigger
language plpgsql security definer set search_path = public as $$
declare o record;
begin
  new.look_key := public.plaza_look_key(new.snapshot);
  if new.contest then
    -- 대회 등록은 스키마 안에서 한 줄로 세운다(중복 검사와 순번이 동시에 엇갈리지 않게).
    perform pg_advisory_xact_lock(hashtext('plaza_contest:public'));
    for o in select snapshot from public.plaza_posts p
             where p.contest and p.look_key = new.look_key and p.id <> new.id loop
      if public.plaza_look_similar(o.snapshot, new.snapshot) then
        raise exception '같은 조합이 이미 대회에 출품돼 있어요';
      end if;
    end loop;
    if new.contest_no is null then
      select coalesce(max(contest_no), 0) + 1 into new.contest_no from public.plaza_posts where contest;
    end if;
  end if;
  return new;
end $$;

-- ── plaza_dev ──
drop index if exists plaza_dev.plaza_posts_contest_look_uq;
alter table plaza_dev.plaza_posts add column if not exists contest_no int;
alter table plaza_dev.plaza_posts add column if not exists image_view jsonb;
update plaza_dev.plaza_posts set look_key = public.plaza_look_key(snapshot);
update plaza_dev.plaza_posts p set contest_no = n.rn
  from (select id, row_number() over (order by created_at, id) rn from plaza_dev.plaza_posts where contest) n
  where p.id = n.id and p.contest_no is null;

create or replace function plaza_dev.plaza_set_look_key() returns trigger
language plpgsql security definer set search_path = plaza_dev as $$
declare o record;
begin
  new.look_key := public.plaza_look_key(new.snapshot);
  if new.contest then
    -- 대회 등록은 스키마 안에서 한 줄로 세운다(중복 검사와 순번이 동시에 엇갈리지 않게).
    perform pg_advisory_xact_lock(hashtext('plaza_contest:plaza_dev'));
    for o in select snapshot from plaza_dev.plaza_posts p
             where p.contest and p.look_key = new.look_key and p.id <> new.id loop
      if public.plaza_look_similar(o.snapshot, new.snapshot) then
        raise exception '같은 조합이 이미 대회에 출품돼 있어요';
      end if;
    end loop;
    if new.contest_no is null then
      select coalesce(max(contest_no), 0) + 1 into new.contest_no from plaza_dev.plaza_posts where contest;
    end if;
  end if;
  return new;
end $$;
