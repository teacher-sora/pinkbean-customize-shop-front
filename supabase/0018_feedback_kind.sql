-- 건의함을 공지 · 건의 · 오류 · 질문으로 나눈다. 건의와 오류는 같은 표(plaza_notice_comments)에 종류(kind)로 나눠 담는다.
--  · kind = 'idea'(건의) | 'bug'(오류). 기본값은 'idea' — 종류를 보내지 않는 옛 화면(배포 전에 열어 둔 탭)의 글도 받아 둔다.
--  · 건의 · 오류 글은 공지에 매달지 않는다(notice_id 를 비운다). 예전 글은 공지에 매달린 채로 종류만 붙인다.
--  · 운영자 답변은 원글의 종류를 그대로 물려받는다(plaza_op_reply).
-- 앱에서 오는 글은 여전히 원글만 허용한다(답변을 사칭할 수 없게) — 정책은 0013 그대로다.

do $do$
declare s text;
begin
  foreach s in array array['public', 'plaza_dev'] loop
    execute format($f$
      alter table %1$I.plaza_notice_comments add column if not exists kind text not null default 'idea';
      alter table %1$I.plaza_notice_comments drop constraint if exists plaza_notice_cmt_kind;
      alter table %1$I.plaza_notice_comments add constraint plaza_notice_cmt_kind check (kind in ('idea', 'bug'));
      alter table %1$I.plaza_notice_comments alter column notice_id drop not null;
      create index if not exists plaza_notice_cmt_kind_idx on %1$I.plaza_notice_comments(kind, created_at desc) where parent_id is null;

      create or replace function %1$I.plaza_op_reply(p_id text, p_pw text, p_parent uuid, p_body text) returns uuid
      language plpgsql security definer set search_path = '' as $$
      declare par record; op uuid; nid uuid;
      begin
        if not plaza_priv.op_ok(p_id, p_pw) then return null; end if;
        select id, notice_id, owner, parent_id, kind into par from %1$I.plaza_notice_comments where id = p_parent;
        if par.id is null or par.parent_id is not null then raise exception 'bad parent'; end if;
        select uid into op from plaza_priv.op_account where login = p_id;
        insert into %1$I.plaza_notice_comments(notice_id, owner, body, parent_id, kind)
          values (par.notice_id, coalesce(op, par.owner), btrim(p_body), par.id, par.kind) returning id into nid;
        return nid;
      end $$;
      revoke all on function %1$I.plaza_op_reply(text, text, uuid, text) from public;
      grant execute on function %1$I.plaza_op_reply(text, text, uuid, text) to anon, authenticated;
    $f$, s);
  end loop;
end $do$;

-- 운영의 예전 글(공지 '오류는 이곳에 댓글로 작성해주세요' 아래에 섞여 있던 것) 가운데 오류 보고를 'bug' 로 옮긴다.
-- 나머지(기능 건의 · 사용 질문 · 운영자 안내)는 기본값 'idea' 그대로다. 답변은 원글을 따른다.
update public.plaza_notice_comments set kind = 'bug' where id in (
  'a86a92cc-7ae6-4367-8300-d08ec86410cb', '5f0452a1-4843-4f40-b42a-4a4cf73d72e1', 'ffb826fe-650d-4c84-8dd3-33f2e19fb8e1',
  '8a6ab9a8-dcba-419b-b497-0bebb0d6ffb1', 'd6eef0e6-e79c-4424-86a6-5eee6bb8067f', '31e9c0fc-6614-40d1-9aa4-0f90f0c8553f',
  '90a6d8c3-7ea1-43e8-ab57-76fdd490e95b', '098e3d2d-9473-420e-bfe0-25f8e62b9111', '7351a35d-ecf7-4fe6-8f18-2640e8be94ac',
  '7f3abd7b-9443-422a-b8fc-d0139f5e7bb6', '247eb398-e23c-4360-a8d5-8cddbb32238a', '726db26a-3544-46f3-827a-1347f2ca172e',
  '85d1982d-2225-4db0-805c-e3a652a999cc'
);
update public.plaza_notice_comments r set kind = p.kind from public.plaza_notice_comments p where r.parent_id = p.id and r.kind <> p.kind;
