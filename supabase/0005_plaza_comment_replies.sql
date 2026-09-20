-- 댓글의 댓글(1단) — 2026-09-20.
-- 유튜브처럼 **한 단계만** 접는다. 더 깊어지면 252px 폭의 댓글 열에서 읽을 수 없다.
-- 깊이 제한은 앱이 아니라 DB 에서 막는다(클라이언트가 무엇을 보내든 구조가 망가지지 않게).

alter table public.plaza_comments
  add column if not exists parent_id uuid references public.plaza_comments(id) on delete cascade;
create index if not exists plaza_comments_parent_idx on public.plaza_comments (parent_id);

alter table plaza_dev.plaza_comments
  add column if not exists parent_id uuid references plaza_dev.plaza_comments(id) on delete cascade;
create index if not exists plaza_comments_parent_idx on plaza_dev.plaza_comments (parent_id);

create or replace function public.plaza_comment_depth() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from public.plaza_comments p where p.id = new.parent_id and p.parent_id is not null) then
      raise exception '답글에는 답글을 달 수 없어요';
    end if;
    -- 답글은 부모와 같은 글에 달려야 한다.
    if not exists (select 1 from public.plaza_comments p where p.id = new.parent_id and p.post_id = new.post_id) then
      raise exception '부모 댓글이 다른 글의 것입니다';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists plaza_comments_depth on public.plaza_comments;
create trigger plaza_comments_depth before insert or update on public.plaza_comments
  for each row execute function public.plaza_comment_depth();

create or replace function plaza_dev.plaza_comment_depth() returns trigger
language plpgsql security definer set search_path = plaza_dev as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from plaza_dev.plaza_comments p where p.id = new.parent_id and p.parent_id is not null) then
      raise exception '답글에는 답글을 달 수 없어요';
    end if;
    if not exists (select 1 from plaza_dev.plaza_comments p where p.id = new.parent_id and p.post_id = new.post_id) then
      raise exception '부모 댓글이 다른 글의 것입니다';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists plaza_comments_depth on plaza_dev.plaza_comments;
create trigger plaza_comments_depth before insert or update on plaza_dev.plaza_comments
  for each row execute function plaza_dev.plaza_comment_depth();
