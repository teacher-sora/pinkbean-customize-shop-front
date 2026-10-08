-- 운영자용 건의함 화면(/suggestion, 2026-10-08 사용자 지시): 운영자가 아이디·비밀번호로 들어가 건의글에 답변을 달고 글을 지운다.
--
-- 서비스 키를 앱(Vercel)에 두지 않는다. 대신 **DB 안에서 비밀번호를 확인하는 함수**만 연다 —
-- 함수는 security definer 라 RLS 를 넘지만, 맞는 아이디·비밀번호 없이는 아무 일도 하지 않는다.
--  · 비밀번호는 bcrypt 해시로만 둔다(plaza_priv 는 API 로 노출하지 않는 스키마다). 평문은 저장소에도 DB 에도 없다.
--  · 틀린 시도는 적어 두고, 10분 안에 10번 틀리면 그동안은 맞는 비밀번호도 받지 않는다(무차별 대입 방지).
--  · 답변의 작성자(owner)는 계정에 적어 둔 uid(기존 답변과 같은 사람), 없으면 건의글의 작성자.
-- 계정은 맨 끝의 insert 로 넣는다 — <비밀번호> 자리를 바꿔 **SQL 편집기에서 직접** 실행한다(이 파일에는 적지 않는다).

create schema if not exists plaza_priv;
revoke all on schema plaza_priv from public, anon, authenticated;
create table if not exists plaza_priv.op_account (login text primary key, hash text not null, uid uuid);
create table if not exists plaza_priv.op_fail (at timestamptz not null default now());

-- 틀리면 예외가 아니라 false 를 돌려준다(예외를 던지면 '틀린 시도' 기록까지 되돌려진다).
create or replace function plaza_priv.op_ok(p_id text, p_pw text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare h text; n int;
begin
  delete from plaza_priv.op_fail where at < now() - interval '1 day';
  select count(*) into n from plaza_priv.op_fail where at > now() - interval '10 minutes';
  if n >= 10 then return false; end if;
  select hash into h from plaza_priv.op_account where login = p_id;
  if h is not null and h = extensions.crypt(p_pw, h) then return true; end if;
  insert into plaza_priv.op_fail default values;
  return false;
end $$;
revoke all on function plaza_priv.op_ok(text, text) from public, anon, authenticated;

do $do$
declare s text;
begin
  foreach s in array array['public', 'plaza_dev'] loop
    execute format($f$
      create or replace function %1$I.plaza_op_login(p_id text, p_pw text) returns boolean
      language sql security definer set search_path = '' as $$ select plaza_priv.op_ok(p_id, p_pw) $$;

      -- 답변 달기. 돌려주는 값: 새 답변의 id, 로그인이 틀리면 null
      create or replace function %1$I.plaza_op_reply(p_id text, p_pw text, p_parent uuid, p_body text) returns uuid
      language plpgsql security definer set search_path = '' as $$
      declare par record; op uuid; nid uuid;
      begin
        if not plaza_priv.op_ok(p_id, p_pw) then return null; end if;
        select id, notice_id, owner, parent_id into par from %1$I.plaza_notice_comments where id = p_parent;
        if par.id is null or par.parent_id is not null then raise exception 'bad parent'; end if;
        select uid into op from plaza_priv.op_account where login = p_id;
        insert into %1$I.plaza_notice_comments(notice_id, owner, body, parent_id)
          values (par.notice_id, coalesce(op, par.owner), btrim(p_body), par.id) returning id into nid;
        return nid;
      end $$;

      -- 글 지우기(건의글이면 딸린 답변도 함께 지워진다). 돌려주는 값: 지웠으면 true, 없는 글이면 false, 로그인이 틀리면 null
      create or replace function %1$I.plaza_op_delete(p_id text, p_pw text, p_comment uuid) returns boolean
      language plpgsql security definer set search_path = '' as $$
      begin
        if not plaza_priv.op_ok(p_id, p_pw) then return null; end if;
        delete from %1$I.plaza_notice_comments where id = p_comment;
        return found;
      end $$;

      revoke all on function %1$I.plaza_op_login(text, text), %1$I.plaza_op_reply(text, text, uuid, text), %1$I.plaza_op_delete(text, text, uuid) from public;
      grant execute on function %1$I.plaza_op_login(text, text), %1$I.plaza_op_reply(text, text, uuid, text), %1$I.plaza_op_delete(text, text, uuid) to anon, authenticated;
    $f$, s);
  end loop;
end $do$;

-- 계정(SQL 편집기에서 <비밀번호> 를 바꿔 실행):
-- insert into plaza_priv.op_account(login, hash, uid) values ('pinkbean', extensions.crypt('<비밀번호>', extensions.gen_salt('bf', 10)),
--   (select owner from public.plaza_notice_comments where parent_id is not null group by owner order by count(*) desc limit 1))
--   on conflict (login) do update set hash = excluded.hash, uid = coalesce(excluded.uid, plaza_priv.op_account.uid);
