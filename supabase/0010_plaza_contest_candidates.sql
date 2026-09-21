-- 대회 같은 조합 — 비교 대상만 골라 주는 함수 + 색인 — 2026-09-21.
--
-- 등록 폼은 지금까지 대회 출품작 **전부**의 스냅샷을 받아 브라우저에서 걸렀다(최대 5000개). 출품작이 수만 개가 되면
-- 확인 한 번에 수십 MB 를 받게 된다. 착용·피부가 다르면 어차피 다른 조합이므로, 같은 지문(look_key = 정규화한
-- 착용·피부의 md5, 0009)인 출품작만 DB 가 색인으로 골라 준다. 브라우저는 그 몇 개만 픽셀로 비교한다.
-- 트리거(0009)의 비교도 같은 색인을 탄다.

create index if not exists plaza_posts_contest_look_idx on public.plaza_posts (look_key) where contest;
create index if not exists plaza_posts_contest_look_idx on plaza_dev.plaza_posts (look_key) where contest;

create or replace function public.plaza_contest_candidates(s jsonb) returns table (id uuid, name text, snapshot jsonb)
language sql stable as $$
  select p.id, p.name, p.snapshot from public.plaza_posts p
  where p.contest and p.look_key = public.plaza_look_items(public.plaza_look_norm(s))
$$;
create or replace function plaza_dev.plaza_contest_candidates(s jsonb) returns table (id uuid, name text, snapshot jsonb)
language sql stable as $$
  select p.id, p.name, p.snapshot from plaza_dev.plaza_posts p
  where p.contest and p.look_key = public.plaza_look_items(public.plaza_look_norm(s))
$$;
grant execute on function public.plaza_contest_candidates(jsonb) to anon, authenticated;
grant execute on function plaza_dev.plaza_contest_candidates(jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
