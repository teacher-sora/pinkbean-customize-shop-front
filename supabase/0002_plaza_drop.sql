-- 코디 광장 목업 정리용. 검증이 끝나면 이 파일만 실행하면 레코드·테이블·정책·버킷이 모두 사라진다.
delete from storage.objects where bucket_id = 'plaza';
delete from storage.buckets where id = 'plaza';
drop policy if exists plaza_img_read on storage.objects;
drop policy if exists plaza_img_insert on storage.objects;
drop policy if exists plaza_img_delete on storage.objects;

drop table if exists public.plaza_contest_entries cascade;
drop table if exists public.plaza_likes cascade;
drop table if exists public.plaza_posts cascade;
drop function if exists public.plaza_like_count() cascade;

-- dev 쪽(0003_plaza_dev.sql)도 같이 지운다.
delete from storage.objects where bucket_id = 'plaza-dev';
delete from storage.buckets where id = 'plaza-dev';
drop policy if exists plaza_dev_img_read on storage.objects;
drop policy if exists plaza_dev_img_insert on storage.objects;
drop policy if exists plaza_dev_img_delete on storage.objects;
drop schema if exists plaza_dev cascade;
-- 스키마를 지운 뒤 API 노출 목록에서도 빼야 한다(Management API: postgrest.db_schema = "public, graphql_public").
