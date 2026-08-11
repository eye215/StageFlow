-- StageFlow: Storage 기반 legacy 피드백을 수신자와 작성자에게만 공개합니다.
-- 기존 라이브 DB에는 production_scoped_access.sql 이후 이 파일을 한 번 실행하세요.

drop policy if exists stageflow_files_production_read on storage.objects;
create policy stageflow_files_production_read on storage.objects
for select to authenticated
using (
  bucket_id = 'stageflow-files'
  and public.stageflow_can_access_production(public.stageflow_storage_production_id(name))
  and (
    split_part(name, '/', 3) <> 'feedback'
    or split_part(name, '/', 4) = auth.uid()::text
    or owner_id = auth.uid()::text
  )
);

drop policy if exists stageflow_files_production_update on storage.objects;
create policy stageflow_files_production_update on storage.objects
for update to authenticated
using (
  bucket_id = 'stageflow-files'
  and public.stageflow_can_access_production(public.stageflow_storage_production_id(name))
  and (split_part(name, '/', 3) <> 'feedback' or owner_id = auth.uid()::text)
)
with check (
  bucket_id = 'stageflow-files'
  and public.stageflow_can_access_production(public.stageflow_storage_production_id(name))
  and (split_part(name, '/', 3) <> 'feedback' or owner_id = auth.uid()::text)
);

drop policy if exists stageflow_files_production_delete on storage.objects;
create policy stageflow_files_production_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'stageflow-files'
  and public.stageflow_can_access_production(public.stageflow_storage_production_id(name))
  and (split_part(name, '/', 3) <> 'feedback' or owner_id = auth.uid()::text)
);
