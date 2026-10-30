-- 운영자 화면(/dashboard, 2026-10-30 사용자 지시): 공지 쓰기 · 고치기와 하루 방문자 수.
--
--  · 공지 함수는 건의함 함수와 같은 방식이다 — security definer 이고 맞는 아이디 · 비밀번호(plaza_priv.op_ok) 없이는 아무 일도 하지 않는다.
--  · 방문자: 브라우저마다 만든 무작위 id 를 한국 날짜와 함께 한 줄 적는다(같은 날 같은 id 는 한 줄). 닉네임 · IP 는 적지 않는다.
--    표는 앱에서 읽을 수 없고, 적기는 plaza_visit, 읽기는 운영자 로그인이 필요한 plaza_op_visits 뿐이다. 400일 지난 줄은 읽을 때 지운다.

do $do$
declare s text;
begin
  foreach s in array array['public', 'plaza_dev'] loop
    execute format($f$
      create table if not exists %1$I.plaza_visits (day date not null, vid uuid not null, primary key (day, vid));
      alter table %1$I.plaza_visits enable row level security;
      revoke all on %1$I.plaza_visits from anon, authenticated;

      create or replace function %1$I.plaza_visit(p_vid uuid) returns void
      language sql security definer set search_path = '' as $$
        insert into %1$I.plaza_visits(day, vid) values ((now() at time zone 'Asia/Seoul')::date, p_vid) on conflict do nothing
      $$;

      -- 돌려주는 값: { days: [{ d, n }] (최신이 위, 30일), week, month } — 주 · 달은 그 기간의 고유 브라우저 수. 로그인이 틀리면 null
      create or replace function %1$I.plaza_op_visits(p_id text, p_pw text) returns jsonb
      language plpgsql security definer set search_path = '' as $$
      declare today date := (now() at time zone 'Asia/Seoul')::date; out_days jsonb;
      begin
        if not plaza_priv.op_ok(p_id, p_pw) then return null; end if;
        delete from %1$I.plaza_visits where day < today - 400;
        select coalesce(jsonb_agg(jsonb_build_object('d', g.d, 'n', g.n) order by g.d desc), '[]'::jsonb) into out_days
          from (select day as d, count(*) as n from %1$I.plaza_visits where day > today - 30 group by day) g;
        return jsonb_build_object('days', out_days,
          'week', (select count(distinct vid) from %1$I.plaza_visits where day > today - 7),
          'month', (select count(distinct vid) from %1$I.plaza_visits where day > today - 30));
      end $$;

      -- 공지 쓰기(p_notice 가 null) · 고치기. 돌려주는 값: 공지 id, 로그인이 틀리면 null
      create or replace function %1$I.plaza_op_notice_save(p_id text, p_pw text, p_notice uuid, p_title text, p_body text, p_pinned boolean) returns uuid
      language plpgsql security definer set search_path = '' as $$
      declare nid uuid;
      begin
        if not plaza_priv.op_ok(p_id, p_pw) then return null; end if;
        if p_notice is null then
          insert into %1$I.plaza_notices(title, body, pinned) values (btrim(p_title), p_body, p_pinned) returning id into nid;
        else
          update %1$I.plaza_notices set title = btrim(p_title), body = p_body, pinned = p_pinned where id = p_notice returning id into nid;
          if nid is null then raise exception 'no notice'; end if;
        end if;
        return nid;
      end $$;

      revoke all on function %1$I.plaza_visit(uuid), %1$I.plaza_op_visits(text, text), %1$I.plaza_op_notice_save(text, text, uuid, text, text, boolean) from public;
      grant execute on function %1$I.plaza_visit(uuid), %1$I.plaza_op_visits(text, text), %1$I.plaza_op_notice_save(text, text, uuid, text, text, boolean) to anon, authenticated;
    $f$, s);
  end loop;
end $do$;
