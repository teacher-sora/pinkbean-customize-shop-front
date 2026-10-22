-- 광장 익명 이름을 **브라우저마다** 고정한다 — 2026-10-22 사용자 지시(0020 을 바로잡는다).
--
-- 지시: 기기 · 브라우저가 다르면 이름도 다르게(예전처럼). 다만 **같은 기기의 같은 브라우저**에서는 이름이 바뀌면 안 된다.
-- 0020 은 기기 키(접속 네트워크 | 기기 특징 — 브라우저가 달라도 같은 값)로 묶어 다른 브라우저까지 한 사람으로 합쳤다 → 되돌린다.
--
-- 같은 브라우저에서 이름이 바뀌던 까닭: 이름은 익명 로그인(uid)마다 정해지는데, 세션 갱신이 실패하면(여러 탭이 동시에 갱신하거나
-- 잠자기에서 깨어난 직후 등 — 갱신 토큰이 이미 쓰였다는 오류) 라이브러리가 세션을 버리고, 화면은 새 익명 로그인을 만든다 → 새 uid → 새 이름.
-- 운영의 세션 만료는 꺼져 있다(시간 제한 · 비활동 제한 0). 브라우저 저장소는 그대로 남는다.
-- 지금: 화면이 브라우저 저장소에 브라우저 id(무작위, 한 번 만들고 그대로)를 두고 로그인 뒤 plaza_alias_link(bid) 를 부른다.
-- 이름은 그 브라우저 id 에 묶인다 — uid 가 새로 생겨도 같은 브라우저면 그 브라우저의 첫 이름을 그대로 쓴다.
--  · 브라우저 id 는 서버 비밀값으로 HMAC 해 키로만 적는다(원래 값은 DB 에 없다).
--  · 저장소를 통째로 지우면(사이트 데이터 지우기, 사파리가 7일 동안 들르지 않은 사이트를 지울 때) 브라우저 id 도 함께 없어져 새 이름이 된다.

do $do$
declare s text;
begin
  foreach s in array array['public', 'plaza_dev'] loop
    execute format($f$
      -- 0020 이 기기 키로 묶은 것을 되돌린다: 그때 묶인 uid 들은 모두 이름이 없던 uid 였다(자기 이름을 받은 적이 없다)
      delete from %1$I.plaza_alias where owner <> person;
      delete from %1$I.plaza_alias_keys;
      drop function if exists %1$I.plaza_alias_link(text);

      create or replace function %1$I.plaza_alias_link(bid text) returns text
      language plpgsql security definer set search_path = '' as $$
      declare u uuid := auth.uid();
      begin
        if u is null then return null; end if;
        if bid is null or char_length(bid) < 16 or char_length(bid) > 64 then return (select alias from %1$I.plaza_alias where owner = u); end if;
        perform %1$I.plaza_alias_bind(u, 'b:' || encode(extensions.hmac(bid, (select k from public.plaza_secret limit 1), 'sha256'), 'hex'));
        return (select alias from %1$I.plaza_alias where owner = u);
      end $$;
      revoke all on function %1$I.plaza_alias_link(text) from public, anon;
      grant execute on function %1$I.plaza_alias_link(text) to authenticated;
    $f$, s);
  end loop;
end $do$;
