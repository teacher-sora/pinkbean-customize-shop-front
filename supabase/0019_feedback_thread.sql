-- 건의 · 오류 글에 댓글과 답글을 단다. 누구나(사용자 · 운영자) 글에 댓글을, 댓글에 답글을 달 수 있다.
--  · depth: 원글 0, 댓글 1, 답글 2 · 3(댓글부터 세 단까지). root_id = 원글(원글은 비워 둔다).
--    깊이 · 원글 · 종류 · 공지는 앱이 보내지 않고 트리거가 부모에서 정한다(앱이 깊이를 속일 수 없게).
--  · op: 운영자 글. 운영자 화면(/suggestion)의 plaza_op_reply 로만 켜진다 — 앱에서 오는 글은 op = false 만 받는다(사칭 방지).
--    예전 답변(parent_id 가 있는 글)은 앱에서 달 수 없었으므로 모두 운영자 글이다.
--  · deleted: 답글이 달린 글을 지우면 자리만 남긴다(본문을 비우고 '지운 글'로 보인다). 답글이 없으면 그냥 지운다.
--    지운 글의 마지막 답글까지 없어지면 그 자리도 함께 없앤다(plaza_fb_remove).

do $do$
declare s text;
begin
  foreach s in array array['public', 'plaza_dev'] loop
    execute format($f$
      alter table %1$I.plaza_notice_comments add column if not exists op boolean not null default false;
      alter table %1$I.plaza_notice_comments add column if not exists deleted boolean not null default false;
      alter table %1$I.plaza_notice_comments add column if not exists depth smallint not null default 0;
      alter table %1$I.plaza_notice_comments add column if not exists root_id uuid references %1$I.plaza_notice_comments(id) on delete cascade;
      create index if not exists plaza_notice_cmt_root_idx on %1$I.plaza_notice_comments(root_id, created_at) where root_id is not null;

      update %1$I.plaza_notice_comments set op = true, depth = 1, root_id = parent_id where parent_id is not null and root_id is null;

      alter table %1$I.plaza_notice_comments drop constraint if exists plaza_notice_cmt_depth;
      alter table %1$I.plaza_notice_comments add constraint plaza_notice_cmt_depth check (depth between 0 and 3);

      create or replace function %1$I.plaza_fb_thread() returns trigger
      language plpgsql set search_path = '' as $$
      declare par record;
      begin
        if new.parent_id is null then new.depth := 0; new.root_id := null; return new; end if;
        select id, depth, root_id, kind, notice_id, deleted into par from %1$I.plaza_notice_comments where id = new.parent_id;
        if par.id is null or par.deleted then raise exception 'bad parent'; end if;
        if par.depth >= 3 then raise exception 'too deep'; end if;
        new.depth := par.depth + 1;
        new.root_id := coalesce(par.root_id, par.id);
        new.kind := par.kind;
        new.notice_id := par.notice_id;
        new.deleted := false;
        return new;
      end $$;
      drop trigger if exists plaza_notice_comments_thread on %1$I.plaza_notice_comments;
      create trigger plaza_notice_comments_thread before insert on %1$I.plaza_notice_comments
        for each row execute function %1$I.plaza_fb_thread();

      drop policy if exists plaza_notice_cmt_insert on %1$I.plaza_notice_comments;
      create policy plaza_notice_cmt_insert on %1$I.plaza_notice_comments for insert
        with check (auth.uid() = owner and op = false and deleted = false);

      -- 자기 글 지우기. 답글이 있으면 자리만 남기고, 없으면 지운 뒤 비어 버린 '지운 글' 자리도 위로 올라가며 없앤다.
      create or replace function %1$I.plaza_fb_remove(p_id uuid) returns boolean
      language plpgsql security definer set search_path = '' as $$
      declare cur uuid := p_id; par uuid;
      begin
        if not exists (select 1 from %1$I.plaza_notice_comments where id = p_id and owner = auth.uid() and not deleted) then return false; end if;
        if exists (select 1 from %1$I.plaza_notice_comments where parent_id = p_id) then
          update %1$I.plaza_notice_comments set deleted = true, body = '-' where id = p_id;
          return true;
        end if;
        loop
          select parent_id into par from %1$I.plaza_notice_comments where id = cur;
          delete from %1$I.plaza_notice_comments where id = cur;
          exit when par is null;
          exit when not exists (select 1 from %1$I.plaza_notice_comments where id = par and deleted)
            or exists (select 1 from %1$I.plaza_notice_comments where parent_id = par);
          cur := par;
        end loop;
        return true;
      end $$;
      revoke all on function %1$I.plaza_fb_remove(uuid) from public;
      grant execute on function %1$I.plaza_fb_remove(uuid) to authenticated;

      -- 운영자 댓글 · 답글. 원글이든 댓글이든 단다(깊이는 트리거가 막는다).
      create or replace function %1$I.plaza_op_reply(p_id text, p_pw text, p_parent uuid, p_body text) returns uuid
      language plpgsql security definer set search_path = '' as $$
      declare par record; op uuid; nid uuid;
      begin
        if not plaza_priv.op_ok(p_id, p_pw) then return null; end if;
        select id, owner into par from %1$I.plaza_notice_comments where id = p_parent;
        if par.id is null then raise exception 'bad parent'; end if;
        select uid into op from plaza_priv.op_account where login = p_id;
        insert into %1$I.plaza_notice_comments(owner, body, parent_id, op)
          values (coalesce(op, par.owner), btrim(p_body), par.id, true) returning id into nid;
        return nid;
      end $$;
      revoke all on function %1$I.plaza_op_reply(text, text, uuid, text) from public;
      grant execute on function %1$I.plaza_op_reply(text, text, uuid, text) to anon, authenticated;
    $f$, s);
  end loop;
end $do$;
