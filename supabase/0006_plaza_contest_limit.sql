-- 대회 출품 제한 — 2026-09-20.
-- "기기당 3개까지"(사용자 지시). **화면이 아니라 DB 가 막는다** — 화면 제한은 개발자 도구로 지나칠 수 있다.
-- 여기서 말하는 '기기'는 익명 세션(auth.uid())이다. 로그인 화면은 없고, 브라우저마다 서명된 uuid 를 하나 갖는다.
--  · 저장소를 지우면 새 기기가 된다 — 실수·가벼운 중복은 막지만 작정한 반복은 막지 못한다.
--    대회 심사 때 plaza_contest_entries.email 로 한 번 더 거르는 것을 전제로 한다.
--  · 일반 광장 등록은 제한하지 않는다(대회 출품작만 센다).

create or replace function public.plaza_contest_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if new.contest and (tg_op = 'INSERT' or not old.contest) then
    select count(*) into n from public.plaza_posts where owner = new.owner and contest;
    if n >= 3 then
      raise exception '대회에는 기기당 3개까지 올릴 수 있어요' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists plaza_posts_contest_limit on public.plaza_posts;
create trigger plaza_posts_contest_limit before insert or update on public.plaza_posts
  for each row execute function public.plaza_contest_limit();

create or replace function plaza_dev.plaza_contest_limit() returns trigger
language plpgsql security definer set search_path = plaza_dev as $$
declare n int;
begin
  if new.contest and (tg_op = 'INSERT' or not old.contest) then
    select count(*) into n from plaza_dev.plaza_posts where owner = new.owner and contest;
    if n >= 3 then
      raise exception '대회에는 기기당 3개까지 올릴 수 있어요' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists plaza_posts_contest_limit on plaza_dev.plaza_posts;
create trigger plaza_posts_contest_limit before insert or update on plaza_dev.plaza_posts
  for each row execute function plaza_dev.plaza_contest_limit();
