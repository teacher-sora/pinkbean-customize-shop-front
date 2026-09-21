-- 대회 같은 조합: 정규화 + 좁은 안전망 — 2026-09-21 (0008 의 허용 오차 규칙을 대체).
--
-- 0008 이 뚫린 이유(사용자 제보): 팔레트의 '고른 색'(A·B)을 뼈대로 먼저 걸러, 결과가 같은 색인데도 다른 조합이 됐다.
--   예) 헤어 A=검정·B=검정·비율 100(결과 = 검정) ≠ 염색 안 한 검정 헤어, (A,B,r) ≠ (B,A,100−r).
--   숨긴 부위·염색을 끈 부위도 값이 남아 있으면 다른 조합이 됐다(화면에서는 없는 것·염색 없는 것과 같다).
--
-- 이제 판정은 두 겹이다(클라이언트 lib/plazaLook.ts · lib/plazaLookPixels.ts).
--   ① 정규화(여기와 plazaLook.normLook 이 같은 규칙):
--      숨긴 부위 = 미착용, 염색 끈 부위 = 염색 없음, 팔레트 = 결과 색 비율 분포 {색: 비율}(A=B 면 한 색, 비율 0/100 이면 한 색,
--      (A,B,r)=(B,A,100−r)), 염색 안 한 헤어·성형 = 착용 아이템 자신의 색 100%, HSB 셋 다 0 = 염색 없음(t 무시).
--   ② 결과 비교: 브라우저가 실제 스프라이트에 게임 염색 공식을 적용해 같은 위치 픽셀의 색 차이(ΔE)로 판정한다.
--      DB 는 스프라이트가 없어 픽셀을 못 보므로 **좁은 안전망**만 둔다: 착용·피부가 같고, 팔레트 분포 차 ≤ 10%,
--      HSB 수치 차 ≤ 2(색 계열 같음). 이 범위는 픽셀 판정에서도 반드시 '같다'로 나오므로(색조 1~5 → ΔE15 이상 0%,
--      분포 10% → 최대 ΔE ≈ 8), 브라우저가 통과시킨 등록을 DB 가 잘못 막는 일은 없다.
-- 검사 시점: 0008 까지는 UPDATE 마다(좋아요 수 갱신 포함) 돌았다 → 새 등록 · 조합 변경 · 대회로 옮길 때만.
-- look_key = 정규화된 '착용·피부'(md5) — 비교 대상을 거르는 색인 용도로만 쓴다.

-- 이 파일이 쓰는 열·제약·트리거(원래 0007·0008 에서 만들었다 — 두 파일은 2026-09-21 레거시로 지웠고 필요한 것만 여기로 옮겼다).
alter table public.plaza_posts add column if not exists look_key text, add column if not exists contest_no int, add column if not exists image_view jsonb;
alter table plaza_dev.plaza_posts add column if not exists look_key text, add column if not exists contest_no int, add column if not exists image_view jsonb;
alter table public.plaza_posts drop constraint if exists plaza_posts_tags_check;
alter table public.plaza_posts add constraint plaza_posts_tags_check check (coalesce(array_length(tags, 1), 0) <= 10);
alter table plaza_dev.plaza_posts drop constraint if exists plaza_posts_tags_check;
alter table plaza_dev.plaza_posts add constraint plaza_posts_tags_check check (coalesce(array_length(tags, 1), 0) <= 10);

create or replace function public.plaza_hsb_norm(h jsonb) returns jsonb
language plpgsql immutable as $$
declare hh int; s int; b int;
begin
  if h is null or jsonb_typeof(h) <> 'object' then return null; end if;
  hh := ((round(coalesce((h->>'h')::numeric, 0))::int % 360) + 360) % 360;
  s := round(coalesce((h->>'s')::numeric, 0))::int;
  b := round(coalesce((h->>'b')::numeric, 0))::int;
  if hh = 0 and s = 0 and b = 0 then return null; end if;
  return jsonb_build_object('h', hh, 's', s, 'b', b, 't', coalesce((h->>'t')::int, 0));
end $$;

-- 팔레트 → 결과 색 분포. 믹스는 픽셀마다 base→mix 로 ratio% 섞는다.
create or replace function public.plaza_pal_dist(p jsonb, own int) returns jsonb
language plpgsql immutable as $$
declare base int; mix int; r numeric; o jsonb := '{}'::jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return jsonb_build_object(own::text, 1); end if;
  base := coalesce((p->>'baseColor')::int, own);
  mix := (p->>'mixColor')::int;
  r := case when mix is not null and mix <> base then greatest(0, least(100, coalesce((p->>'ratio')::numeric, 0))) / 100 else 0 end;
  if 1 - r > 0 then o := o || jsonb_build_object(base::text, 1 - r); end if;
  if r > 0 then o := o || jsonb_build_object(mix::text, coalesce((o->>mix::text)::numeric, 0) + r); end if;
  return o;
end $$;

create or replace function public.plaza_look_norm(s jsonb) returns jsonb
language plpgsql immutable as $$
declare k text; v text; slots jsonb := '{}'::jsonb; off boolean; idn bigint;
begin
  for k, v in select key, value from jsonb_each_text(coalesce(s->'equipped', '{}'::jsonb)) loop
    if v is null or v = '' or k = 'skin' or coalesce(s->'hidden'->>k, 'false') = 'true' then continue; end if;
    off := coalesce(s->'dyeOff'->>k, 'false') = 'true';
    if k in ('hair', 'face') then
      idn := v::bigint;
      slots := slots || jsonb_build_object(k, jsonb_build_object('id', v,
        'pal', public.plaza_pal_dist(case when off then null else s->'dyePalette'->k end,
                                     (case when k = 'face' then (idn / 100) % 10 else idn % 10 end)::int)));
    else
      slots := slots || jsonb_build_object(k, jsonb_build_object('id', v,
        'hsb', case when off then null else public.plaza_hsb_norm(s->'dyeHsb'->k) end));
    end if;
  end loop;
  return jsonb_build_object('tone', coalesce((s->>'tone')::int, 0),
    'skin', case when coalesce(s->'dyeOff'->>'skin', 'false') = 'true' then null else public.plaza_hsb_norm(s->'dyeHsb'->'skin') end,
    'slots', slots);
end $$;

-- 착용·피부 지문(plazaLook.lookItems 와 같은 문자열의 md5).
create or replace function public.plaza_look_items(n jsonb) returns text
language sql immutable as $$
  select md5((n->>'tone') || '|' || coalesce((select string_agg(key || ':' || (value->>'id'), ',' order by key)
                                              from jsonb_each(n->'slots')), ''))
$$;

create or replace function public.plaza_hsb_near(a jsonb, b jsonb) returns boolean
language plpgsql immutable as $$
declare d int;
begin
  -- 한쪽이 염색 없음이면 다른 쪽 수치를 0 과 비교한다(색 계열은 무관 — 수치가 0 에 가까우면 어느 계열이든 거의 그대로다).
  if a is null or jsonb_typeof(a) <> 'object' then a := null; end if;
  if b is null or jsonb_typeof(b) <> 'object' then b := null; end if;
  if a is null and b is null then return true; end if;
  if a is null then a := jsonb_build_object('h', 0, 's', 0, 'b', 0, 't', b->'t'); end if;
  if b is null then b := jsonb_build_object('h', 0, 's', 0, 'b', 0, 't', a->'t'); end if;
  if (a->>'t')::int <> (b->>'t')::int then return false; end if;
  d := abs((a->>'h')::int - (b->>'h')::int) % 360;
  return least(d, 360 - d) <= 2 and abs((a->>'s')::int - (b->>'s')::int) <= 2 and abs((a->>'b')::int - (b->>'b')::int) <= 2;
end $$;

create or replace function public.plaza_pal_gap(a jsonb, b jsonb) returns numeric
language sql immutable as $$
  select coalesce(sum(abs(coalesce((a->>k)::numeric, 0) - coalesce((b->>k)::numeric, 0))), 0) / 2
  from (select jsonb_object_keys(coalesce(a, '{}'::jsonb)) k union select jsonb_object_keys(coalesce(b, '{}'::jsonb))) x
$$;

-- 좁은 안전망(plazaLook.paramSame 과 같은 규칙). a·b 는 plaza_look_norm 결과, 착용이 같다는 전제.
create or replace function public.plaza_look_param_same(a jsonb, b jsonb) returns boolean
language plpgsql immutable as $$
declare k text; x jsonb; y jsonb;
begin
  if public.plaza_look_items(a) <> public.plaza_look_items(b) then return false; end if;
  if not public.plaza_hsb_near(a->'skin', b->'skin') then return false; end if;
  for k in select jsonb_object_keys(a->'slots') loop
    x := a->'slots'->k; y := b->'slots'->k;
    if x ? 'pal' then
      if public.plaza_pal_gap(x->'pal', y->'pal') > 0.1 then return false; end if;
    elsif not public.plaza_hsb_near(x->'hsb', y->'hsb') then return false; end if;
  end loop;
  return true;
end $$;

-- ── public ──
create or replace function public.plaza_set_look_key() returns trigger
language plpgsql security definer set search_path = public as $$
declare o record; n jsonb;
begin
  n := public.plaza_look_norm(new.snapshot);
  new.look_key := public.plaza_look_items(n);
  -- 중복 검사는 새 등록 · 조합 변경 · 대회로 옮길 때만. 좋아요 수 같은 다른 UPDATE 에서 돌면, 이미 있는 출품작끼리
  -- 규칙상 겹칠 때(규칙이 바뀌기 전에 올라온 것) 좋아요가 실패한다 — 먼저 올라온 출품작은 그대로 둔다.
  if new.contest and (tg_op = 'INSERT' or not old.contest or new.snapshot is distinct from old.snapshot) then
    -- 대회 등록은 스키마 안에서 한 줄로 세운다(중복 검사와 순번이 동시에 엇갈리지 않게).
    perform pg_advisory_xact_lock(hashtext('plaza_contest:public'));
    for o in select snapshot from public.plaza_posts p
             where p.contest and p.look_key = new.look_key and p.id <> new.id loop
      if public.plaza_look_param_same(public.plaza_look_norm(o.snapshot), n) then
        raise exception '같은 조합이 이미 대회에 출품돼 있어요';
      end if;
    end loop;
    if new.contest_no is null then
      select coalesce(max(contest_no), 0) + 1 into new.contest_no from public.plaza_posts where contest;
    end if;
  end if;
  return new;
end $$;
update public.plaza_posts set look_key = public.plaza_look_items(public.plaza_look_norm(snapshot));
create or replace trigger plaza_posts_look_key before insert or update of snapshot, contest on public.plaza_posts
  for each row execute function public.plaza_set_look_key();

-- ── plaza_dev ──
create or replace function plaza_dev.plaza_set_look_key() returns trigger
language plpgsql security definer set search_path = plaza_dev as $$
declare o record; n jsonb;
begin
  n := public.plaza_look_norm(new.snapshot);
  new.look_key := public.plaza_look_items(n);
  -- 중복 검사는 새 등록 · 조합 변경 · 대회로 옮길 때만. 좋아요 수 같은 다른 UPDATE 에서 돌면, 이미 있는 출품작끼리
  -- 규칙상 겹칠 때(규칙이 바뀌기 전에 올라온 것) 좋아요가 실패한다 — 먼저 올라온 출품작은 그대로 둔다.
  if new.contest and (tg_op = 'INSERT' or not old.contest or new.snapshot is distinct from old.snapshot) then
    perform pg_advisory_xact_lock(hashtext('plaza_contest:plaza_dev'));
    for o in select snapshot from plaza_dev.plaza_posts p
             where p.contest and p.look_key = new.look_key and p.id <> new.id loop
      if public.plaza_look_param_same(public.plaza_look_norm(o.snapshot), n) then
        raise exception '같은 조합이 이미 대회에 출품돼 있어요';
      end if;
    end loop;
    if new.contest_no is null then
      select coalesce(max(contest_no), 0) + 1 into new.contest_no from plaza_dev.plaza_posts where contest;
    end if;
  end if;
  return new;
end $$;
update plaza_dev.plaza_posts set look_key = public.plaza_look_items(public.plaza_look_norm(snapshot));
create or replace trigger plaza_posts_look_key before insert or update of snapshot, contest on plaza_dev.plaza_posts
  for each row execute function plaza_dev.plaza_set_look_key();

-- 옛 허용 오차 규칙(0007·0008)은 더 쓰지 않는다.
drop function if exists public.plaza_look_similar(jsonb, jsonb);
drop function if exists public.plaza_look_key(jsonb);
