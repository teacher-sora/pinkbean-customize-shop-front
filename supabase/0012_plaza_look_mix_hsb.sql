-- 헤어·성형도 커스텀 염색(HSB)을 받는다(2026-09-21 사용자 지시) → 대회 '같은 조합' 판정도 그 색을 봐야 한다.
--
-- 왜 필요한가: 예전엔 헤어·성형을 **발색표 색(pal)** 으로만 구분했다. 커스텀이 생기면, 발색표는 같고 색조만 다른
-- 두 코디가 DB 눈에는 완전히 같은 조합으로 보여 **두 번째 사람이 잘못 막힌다**(대회는 같은 조합을 한 번만 받는다).
--
-- ⚠️ 정규화 JSON 모양은 **커스텀을 쓴 글에서만** 늘어난다. HSB 가 없으면 'hsb' 키를 아예 넣지 않는다 —
--    넣으면 예전에 저장된 look_key(= 정규화 결과의 지문)와 달라져 기존 출품작의 중복 색인이 어긋난다.
--    지금 운영에 있는 글은 전부 커스텀이 없으므로 look_key 가 하나도 바뀌지 않는다(적용 후 실측으로 확인할 것).
-- ⚠️ front/src/lib/plazaLook.ts 의 normLook · paramSame 과 **같은 규칙**이어야 한다.

-- ════════ public ════════
create or replace function public.plaza_look_norm(s jsonb) returns jsonb
language plpgsql immutable as $$
declare k text; v text; slots jsonb := '{}'::jsonb; off boolean; idn bigint; h jsonb; mix jsonb;
begin
  for k, v in select key, value from jsonb_each_text(coalesce(s->'equipped', '{}'::jsonb)) loop
    if v is null or v = '' or k = 'skin' or coalesce(s->'hidden'->>k, 'false') = 'true' then continue; end if;
    off := coalesce(s->'dyeOff'->>k, 'false') = 'true';
    if k in ('hair', 'face') then
      idn := v::bigint;
      h := case when off then null else public.plaza_hsb_norm(s->'dyeHsb'->k) end;
      mix := jsonb_build_object('id', v,
        'pal', public.plaza_pal_dist(case when off then null else s->'dyePalette'->k end,
                                     (case when k = 'face' then (idn / 100) % 10 else idn % 10 end)::int));
      -- 커스텀을 쓴 글만 'hsb' 가 붙는다(위 주석 — 옛 look_key 를 흔들지 않기 위해).
      if h is not null and jsonb_typeof(h) = 'object' then mix := mix || jsonb_build_object('hsb', h); end if;
      slots := slots || jsonb_build_object(k, mix);
    else
      slots := slots || jsonb_build_object(k, jsonb_build_object('id', v,
        'hsb', case when off then null else public.plaza_hsb_norm(s->'dyeHsb'->k) end));
    end if;
  end loop;
  return jsonb_build_object('tone', coalesce((s->>'tone')::int, 0),
    'skin', case when coalesce(s->'dyeOff'->>'skin', 'false') = 'true' then null else public.plaza_hsb_norm(s->'dyeHsb'->'skin') end,
    'slots', slots);
end $$;

create or replace function public.plaza_look_param_same(a jsonb, b jsonb) returns boolean
language plpgsql immutable as $$
declare k text; x jsonb; y jsonb;
begin
  if public.plaza_look_items(a) <> public.plaza_look_items(b) then return false; end if;
  if not public.plaza_hsb_near(a->'skin', b->'skin') then return false; end if;
  for k in select jsonb_object_keys(a->'slots') loop
    x := a->'slots'->k; y := b->'slots'->k;
    -- 헤어·성형은 발색표 색(pal)과 커스텀(hsb)을 **둘 다** 본다. 그 외는 hsb 만(pal 이 없다).
    if x ? 'pal' and public.plaza_pal_gap(x->'pal', y->'pal') > 0.1 then return false; end if;
    if not public.plaza_hsb_near(x->'hsb', y->'hsb') then return false; end if;
  end loop;
  return true;
end $$;

-- ════════ plaza_dev ════════
-- ⚠️ 헬퍼(plaza_hsb_norm·plaza_pal_dist·plaza_hsb_near·plaza_pal_gap·plaza_look_items)는 public 에만 있다(0009).
--    plaza_dev 쪽 함수도 그 헬퍼를 그대로 부른다 — 스키마만 바꿔 쓰면 '함수가 없다'로 깨진다.
create or replace function plaza_dev.plaza_look_norm(s jsonb) returns jsonb
language plpgsql immutable as $$
declare k text; v text; slots jsonb := '{}'::jsonb; off boolean; idn bigint; h jsonb; mix jsonb;
begin
  for k, v in select key, value from jsonb_each_text(coalesce(s->'equipped', '{}'::jsonb)) loop
    if v is null or v = '' or k = 'skin' or coalesce(s->'hidden'->>k, 'false') = 'true' then continue; end if;
    off := coalesce(s->'dyeOff'->>k, 'false') = 'true';
    if k in ('hair', 'face') then
      idn := v::bigint;
      h := case when off then null else public.plaza_hsb_norm(s->'dyeHsb'->k) end;
      mix := jsonb_build_object('id', v,
        'pal', public.plaza_pal_dist(case when off then null else s->'dyePalette'->k end,
                                        (case when k = 'face' then (idn / 100) % 10 else idn % 10 end)::int));
      if h is not null and jsonb_typeof(h) = 'object' then mix := mix || jsonb_build_object('hsb', h); end if;
      slots := slots || jsonb_build_object(k, mix);
    else
      slots := slots || jsonb_build_object(k, jsonb_build_object('id', v,
        'hsb', case when off then null else public.plaza_hsb_norm(s->'dyeHsb'->k) end));
    end if;
  end loop;
  return jsonb_build_object('tone', coalesce((s->>'tone')::int, 0),
    'skin', case when coalesce(s->'dyeOff'->>'skin', 'false') = 'true' then null else public.plaza_hsb_norm(s->'dyeHsb'->'skin') end,
    'slots', slots);
end $$;

create or replace function plaza_dev.plaza_look_param_same(a jsonb, b jsonb) returns boolean
language plpgsql immutable as $$
declare k text; x jsonb; y jsonb;
begin
  if public.plaza_look_items(a) <> public.plaza_look_items(b) then return false; end if;
  if not public.plaza_hsb_near(a->'skin', b->'skin') then return false; end if;
  for k in select jsonb_object_keys(a->'slots') loop
    x := a->'slots'->k; y := b->'slots'->k;
    if x ? 'pal' and public.plaza_pal_gap(x->'pal', y->'pal') > 0.1 then return false; end if;
    if not public.plaza_hsb_near(x->'hsb', y->'hsb') then return false; end if;
  end loop;
  return true;
end $$;
