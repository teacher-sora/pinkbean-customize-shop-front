-- 익명 이름: 몬스터(뒤 낱말)가 지금 쓰는 사람과 겹치지 않는 것을 먼저 고른다(2026-10-23 사용자 지시 — '수식어는 겹쳐도 되지만
-- 핵심인 몬스터 이름은 우선 겹치지 않게').
--  · 아무도 쓰지 않는 몬스터(보스) 가운데서 뽑는다. 다 쓰였을 때만(약 1천 명 넘게) 예전처럼 전부에서 뽑는다.
--  · 수식어는 그대로 무작위다. 이름 전체가 겹치지 않는 것(alias unique)도 그대로다.
--  · 해제된 이름(바꿔서 아무도 안 쓰는 것)의 몬스터는 다시 쓸 수 있다 — 지금 쓰는 이름만 본다.
--  · 이미 정해진 이름은 바꾸지 않는다(예전 방식으로 겹친 이름도 그대로 둔다).
--  · 낱말에는 띄어쓰기가 없다 → 이름의 첫 띄어쓰기 뒤가 몬스터다.
-- 0020 의 plaza_alias_ensure 를 이 규칙으로 다시 쓴다(같은 사람으로 묶인 uid · want 처리는 그대로).

do $do$
declare s text;
begin
  foreach s in array array['public', 'plaza_dev'] loop
    execute format($f$
      -- 지금 쓰는 사람이 없는 몬스터(보스). 다 쓰였으면 전부.
      create or replace function %1$I.plaza_alias_free(words text[]) returns text[]
      language sql stable security definer set search_path = '' as $$
        select coalesce(nullif(array(
          select w from unnest(words) w
          where not exists (select 1 from %1$I.plaza_alias a where substr(a.alias, strpos(a.alias, ' ') + 1) = w)
        ), '{}'), words)
      $$;
      revoke all on function %1$I.plaza_alias_free(text[]) from public, anon, authenticated;

      create or replace function %1$I.plaza_alias_ensure(u uuid, want text default null) returns text
      language plpgsql security definer set search_path = '' as $$
      declare a text; adj text[] := plaza_priv.alias_adj(); noun text[]; boss text[]; i int;
      begin
        if u is null then return null; end if;
        select alias into a from %1$I.plaza_alias where owner = u;
        if a is not null then return a; end if;
        if want is not null and not exists (select 1 from %1$I.plaza_alias where alias = want) then
          insert into %1$I.plaza_alias(owner, alias, person) values (u, want, u) on conflict do nothing returning alias into a;
          if a is not null then return a; end if;
        end if;
        noun := %1$I.plaza_alias_free(plaza_priv.alias_noun());
        boss := %1$I.plaza_alias_free(plaza_priv.alias_boss());
        for i in 1..200 loop
          if random() < 0.005 then   -- 보스 이스터에그
            a := adj[1 + floor(random() * array_length(adj, 1))::int] || ' ' || boss[1 + floor(random() * array_length(boss, 1))::int];
          else
            a := adj[1 + floor(random() * array_length(adj, 1))::int] || ' ' || noun[1 + floor(random() * array_length(noun, 1))::int];
          end if;
          if not exists (select 1 from %1$I.plaza_alias where alias = a) then
            insert into %1$I.plaza_alias(owner, alias, person) values (u, a, u) on conflict do nothing returning alias into a;
            if a is not null then return a; end if;
          end if;
          select alias into a from %1$I.plaza_alias where owner = u;   -- 같은 사람이 동시에 들어온 경우
          if a is not null then return a; end if;
        end loop;
        raise exception 'plaza alias: 빈 이름을 찾지 못했다(낱말을 늘릴 때)';
      end $$;
      revoke all on function %1$I.plaza_alias_ensure(uuid, text) from public, anon, authenticated;

      -- 운영자가 한 사람의 이름만 다시 뽑을 때(대시보드 · 관리 API). 지금 이름을 빼고 같은 규칙으로 정한다.
      create or replace function %1$I.plaza_alias_reroll(u uuid) returns text
      language plpgsql security definer set search_path = '' as $$
      -- 묶인 사람(person)과 처음 이름을 받은 때(created_at — 같은 브라우저의 '첫 이름'을 가리는 기준)는 그대로 둔다.
      declare p uuid; t timestamptz;
      begin
        select person, created_at into p, t from %1$I.plaza_alias where owner = u;
        if p is null then return null; end if;
        delete from %1$I.plaza_alias where owner = u;
        perform %1$I.plaza_alias_ensure(u);
        update %1$I.plaza_alias set person = p, created_at = t where owner = u;
        return (select alias from %1$I.plaza_alias where owner = u);
      end $$;
      revoke all on function %1$I.plaza_alias_reroll(uuid) from public, anon, authenticated;
    $f$, s);
  end loop;
end $do$;
