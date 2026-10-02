-- 대회 출품작 좋아요 다시 열기 — 2026-10-02 (사용자 지시: 대회가 끝났으니 등록만 막고 좋아요는 누를 수 있게).
-- 0011 은 마감 뒤 대회 출품작의 좋아요(누르기·취소)까지 막았다 — 투표가 끝난 뒤 순위가 흔들리지 않게 하려던 것.
-- 이제 순위는 plaza_awards(0014)로 **고정**돼 있어 좋아요 수가 바뀌어도 맨 앞 순서가 달라지지 않는다 → 막을 이유가 없다.
--  · 바뀌는 것: plaza_toggle_like 에서 마감 검사 한 줄을 뺐다(기기당 1번 규칙·잠금은 그대로).
--  · 그대로인 것: plaza_submit 의 마감 검사 — 대회 **출품은 계속 막힌다**(plaza_contest_deadline).

-- ════════ public ════════
create or replace function public.plaza_toggle_like(pid uuid, fp text) returns jsonb
language plpgsql security definer set search_path = public, public as $$
declare uid uuid := auth.uid(); k text; had boolean; n int;
begin
  if uid is null then raise exception '로그인 정보를 확인하지 못했어요'; end if;
  k := public.plaza_device_key(fp);
  perform 1 from public.plaza_posts where id = pid;
  if not found then raise exception '내려간 코디예요'; end if;
  perform pg_advisory_xact_lock(hashtext('plaza_like:' || pid::text || ':' || k));
  had := exists (select 1 from public.plaza_likes l where l.post_id = pid and l.owner = uid)
      or exists (select 1 from public.plaza_like_keys lk where lk.post_id = pid and lk.key = k);
  if had then
    delete from public.plaza_likes l where l.post_id = pid
      and (l.owner = uid or l.owner in (select lk.owner from public.plaza_like_keys lk where lk.post_id = pid and lk.key = k));
    delete from public.plaza_like_keys lk where lk.post_id = pid and (lk.owner = uid or lk.key = k);
  else
    insert into public.plaza_likes (post_id, owner) values (pid, uid);
    insert into public.plaza_like_keys (post_id, owner, key) values (pid, uid, k);
  end if;
  select like_count into n from public.plaza_posts where id = pid;
  return jsonb_build_object('liked', not had, 'likes', n);
end $$;

-- ════════ plaza_dev ════════
create or replace function plaza_dev.plaza_toggle_like(pid uuid, fp text) returns jsonb
language plpgsql security definer set search_path = plaza_dev, public as $$
declare uid uuid := auth.uid(); k text; had boolean; n int;
begin
  if uid is null then raise exception '로그인 정보를 확인하지 못했어요'; end if;
  k := public.plaza_device_key(fp);
  perform 1 from plaza_dev.plaza_posts where id = pid;
  if not found then raise exception '내려간 코디예요'; end if;
  perform pg_advisory_xact_lock(hashtext('plaza_like:' || pid::text || ':' || k));
  had := exists (select 1 from plaza_dev.plaza_likes l where l.post_id = pid and l.owner = uid)
      or exists (select 1 from plaza_dev.plaza_like_keys lk where lk.post_id = pid and lk.key = k);
  if had then
    delete from plaza_dev.plaza_likes l where l.post_id = pid
      and (l.owner = uid or l.owner in (select lk.owner from plaza_dev.plaza_like_keys lk where lk.post_id = pid and lk.key = k));
    delete from plaza_dev.plaza_like_keys lk where lk.post_id = pid and (lk.owner = uid or lk.key = k);
  else
    insert into plaza_dev.plaza_likes (post_id, owner) values (pid, uid);
    insert into plaza_dev.plaza_like_keys (post_id, owner, key) values (pid, uid, k);
  end if;
  select like_count into n from plaza_dev.plaza_posts where id = pid;
  return jsonb_build_object('liked', not had, 'likes', n);
end $$;
