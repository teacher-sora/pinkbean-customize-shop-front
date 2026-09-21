-- 공지 및 건의함: 건의글에 달리는 '운영자 답변'(2026-09-22 사용자 지시).
--
-- 권한 시스템은 두지 않는다. 한때 '이 브라우저를 운영자로 등록하는 코드'를 만들었다가, 위험할 수 있다는
-- 사용자 판단으로 폐기했다(plaza_admin_codes · plaza_admin_claim 은 drop 했다).
-- 답변은 **운영자가 DB 에서 직접** 남긴다. 그래서 앱에서는 아무도 답글을 달 수 없게 막고(정책), 화면은
-- 달려 있는 답변을 원글 아래에 보여 주기만 한다(읽기 전용).
--  · parent_id = 답변이 달린 건의글. 한 단계만 쓴다(광장 댓글 plaza_comments 와 같은 방식).
--  · 답변을 지우는 것도 DB 에서 한다 — 앱의 삭제는 예전 그대로 '자기 글만'이다.

-- ════════ public ════════
alter table public.plaza_notice_comments add column if not exists parent_id uuid references public.plaza_notice_comments(id) on delete cascade;
create index if not exists plaza_notice_cmt_parent_idx on public.plaza_notice_comments(parent_id) where parent_id is not null;

-- 앱에서 오는 글은 **원글만** 허용한다(답변을 사칭할 수 없게).
drop policy if exists plaza_notice_cmt_insert on public.plaza_notice_comments;
create policy plaza_notice_cmt_insert on public.plaza_notice_comments for insert
  with check (auth.uid() = owner and parent_id is null);

-- ════════ plaza_dev ════════
alter table plaza_dev.plaza_notice_comments add column if not exists parent_id uuid references plaza_dev.plaza_notice_comments(id) on delete cascade;
create index if not exists plaza_notice_cmt_parent_idx on plaza_dev.plaza_notice_comments(parent_id) where parent_id is not null;

drop policy if exists plaza_notice_cmt_insert on plaza_dev.plaza_notice_comments;
create policy plaza_notice_cmt_insert on plaza_dev.plaza_notice_comments for insert
  with check (auth.uid() = owner and parent_id is null);
