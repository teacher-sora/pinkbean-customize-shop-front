-- 광장 익명 이름을 **사람(기기)마다 하나로** 묶는다 — 2026-10-22 사용자 지시("작성할 때마다 바뀌지 않고 유저마다 하나로 고정").
--
-- 왜 바뀌었나: 이름은 익명 로그인 uid 마다 정했다(0017). uid 는 브라우저 저장소에 묶여 있어서, 저장소가 지워지면(사파리는 7일 동안
-- 들르지 않으면 스스로 지운다, 시크릿 창, 다른 브라우저) 같은 사람이 새 uid → 새 이름을 받았다.
-- 지금: 기기 키(0011 plaza_device_key — 접속 네트워크 | 기기 특징의 HMAC, 좋아요 · 출품 수를 세는 그 값)로 uid 들을 한 사람으로 묶고,
-- 그 사람의 **가장 먼저 정해진 이름** 하나를 모든 uid 가 함께 쓴다.
--  · plaza_alias 의 행은 uid 마다 그대로 있고(화면은 지금처럼 owner → alias 로 읽는다), person = 그 사람의 첫 uid 다.
--    이름이 겹치지 않는 규칙은 사람 사이에만 건다(person 행끼리 unique). 같은 사람의 uid 들은 같은 이름을 나눠 쓴다.
--  · 묶는 때: 화면이 로그인 뒤 한 번 plaza_alias_link(fp) 를 부른다. 기기 키가 이미 어떤 사람에 묶여 있으면 이 uid 도 그 사람이 되고,
--    이 uid 가 이미 다른 사람이면 두 사람을 합친다 — 먼저 이름을 받은 쪽이 남는다(사용자 지시: 초기 닉네임 하나로).
--  · 기기 키에는 접속 네트워크가 들어 있어, 같은 기기라도 처음 보는 네트워크에서는 그 순간 묶이지 않는다. 그 네트워크에서 새 이름을 받기 전에
--    아는 네트워크로 한 번이라도 들르면 그때 합쳐진다(먼저 받은 이름으로).
--  · 기존 자료: 좋아요 · 출품에 남은 기기 키(plaza_like_keys · plaza_post_keys)로 이미 갈라진 사람들을 같은 규칙으로 합친다(맨 아래).

do $do$
declare s text;
begin
  foreach s in array array['public', 'plaza_dev'] loop
    execute format($f$
      alter table %1$I.plaza_alias add column if not exists person uuid;
      update %1$I.plaza_alias set person = owner where person is null;
      alter table %1$I.plaza_alias alter column person set not null;
      alter table %1$I.plaza_alias drop constraint if exists plaza_alias_alias_key;
      create unique index if not exists plaza_alias_person_alias on %1$I.plaza_alias (alias) where owner = person;
      create index if not exists plaza_alias_person_idx on %1$I.plaza_alias (person);

      -- 기기 키 → 사람(비공개 — 화면은 읽지 못한다)
      create table if not exists %1$I.plaza_alias_keys (
        key text primary key,
        person uuid not null,
        created_at timestamptz not null default now()
      );
      alter table %1$I.plaza_alias_keys enable row level security;
      revoke all on %1$I.plaza_alias_keys from anon, authenticated;

      -- 두 사람을 하나로: 먼저 이름을 받은 사람(keep)이 남는다
      create or replace function %1$I.plaza_alias_merge(a uuid, b uuid) returns uuid
      language plpgsql security definer set search_path = '' as $$
      declare keep uuid; drop_ uuid; ka timestamptz; kb timestamptz; name text;
      begin
        if a is null or b is null or a = b then return coalesce(a, b); end if;
        select created_at into ka from %1$I.plaza_alias where owner = a and person = a;
        select created_at into kb from %1$I.plaza_alias where owner = b and person = b;
        if kb is not null and (ka is null or kb < ka or (kb = ka and b < a)) then keep := b; drop_ := a; else keep := a; drop_ := b; end if;
        select alias into name from %1$I.plaza_alias where owner = keep and person = keep;
        update %1$I.plaza_alias set person = keep, alias = name where person = drop_;
        update %1$I.plaza_alias_keys set person = keep where person = drop_;
        return keep;
      end $$;
      revoke all on function %1$I.plaza_alias_merge(uuid, uuid) from public, anon, authenticated;

      -- 이 uid 와 이 기기 키를 같은 사람으로 묶는다. 이름이 아직 없는 uid 는 그 사람의 이름을 받는다(첫 댓글 전에 묶이면 새 이름을 만들지 않는다).
      create or replace function %1$I.plaza_alias_bind(u uuid, k text) returns void
      language plpgsql security definer set search_path = '' as $$
      declare pk uuid; pm uuid; name text;
      begin
        if u is null or k is null then return; end if;
        select person into pk from %1$I.plaza_alias_keys where key = k;
        select person into pm from %1$I.plaza_alias where owner = u;
        if pm is null and pk is null then return; end if;   -- 이름도 기기도 처음 — 첫 댓글 때 이름이 생기고 다음 묶기에서 기기 키가 붙는다
        if pm is null then
          select alias into name from %1$I.plaza_alias where owner = pk and person = pk;
          insert into %1$I.plaza_alias(owner, alias, person) values (u, name, pk) on conflict (owner) do nothing;
          return;
        end if;
        if pk is null then
          insert into %1$I.plaza_alias_keys(key, person) values (k, pm) on conflict (key) do nothing;
          return;
        end if;
        perform %1$I.plaza_alias_merge(pk, pm);
      end $$;
      revoke all on function %1$I.plaza_alias_bind(uuid, text) from public, anon, authenticated;

      -- 화면이 부른다(로그인 뒤 한 번)
      create or replace function %1$I.plaza_alias_link(fp text) returns text
      language plpgsql security definer set search_path = '' as $$
      declare u uuid := auth.uid();
      begin
        if u is null then return null; end if;
        perform %1$I.plaza_alias_bind(u, public.plaza_device_key(fp));
        return (select alias from %1$I.plaza_alias where owner = u);
      end $$;
      revoke all on function %1$I.plaza_alias_link(text) from public, anon;
      grant execute on function %1$I.plaza_alias_link(text) to authenticated;

      -- 첫 댓글에서 이름을 정할 때: 같은 사람으로 이미 묶인 uid 가 있으면 그 이름을 쓴다(0017 의 ensure 앞에서 확인)
      create or replace function %1$I.plaza_alias_ensure(u uuid, want text default null) returns text
      language plpgsql security definer set search_path = '' as $$
      declare a text; adj text[] := plaza_priv.alias_adj(); noun text[] := plaza_priv.alias_noun(); boss text[] := plaza_priv.alias_boss(); i int;
      begin
        if u is null then return null; end if;
        select alias into a from %1$I.plaza_alias where owner = u;
        if a is not null then return a; end if;
        if want is not null and not exists (select 1 from %1$I.plaza_alias where alias = want) then
          insert into %1$I.plaza_alias(owner, alias, person) values (u, want, u) on conflict do nothing returning alias into a;
          if a is not null then return a; end if;
        end if;
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
    $f$, s);

    -- 기존 자료 옮기기: 좋아요 · 출품에 남은 (uid, 기기 키) 짝을 이름을 받은 순서대로 묶는다 → 갈라진 사람은 첫 이름 하나로 합쳐진다
    execute format($f$
      do $b$
      declare r record;
      begin
        for r in
          select t.owner, t.key from (
            select owner, key from %1$I.plaza_like_keys
            union select p.owner, pk.key from %1$I.plaza_post_keys pk join %1$I.plaza_posts p on p.id = pk.post_id
          ) t left join %1$I.plaza_alias a on a.owner = t.owner
          order by a.created_at nulls last, t.owner, t.key
        loop
          perform %1$I.plaza_alias_bind(r.owner, r.key);
        end loop;
      end $b$;
    $f$, s);
  end loop;
end $do$;
