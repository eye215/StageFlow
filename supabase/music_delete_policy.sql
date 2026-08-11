-- StageFlow 음악 삭제 권한 복구
-- 같은 공연의 production_members만 해당 공연 Storage 파일을 삭제할 수 있습니다.

create or replace function public.stageflow_storage_production_id(object_name text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(object_name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 2)::uuid
    else null
  end;
$$;

create or replace function public.stageflow_can_access_production(target_production_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.production_members pm
    where pm.production_id = target_production_id
      and pm.user_id = auth.uid()
      and coalesce(pm.access_source, 'legacy') in ('owner', 'invite', 'manual', 'legacy')
  );
$$;

grant execute on function public.stageflow_can_access_production(uuid) to authenticated;

drop policy if exists stageflow_files_production_delete on storage.objects;
create policy stageflow_files_production_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'stageflow-files'
  and public.stageflow_can_access_production(public.stageflow_storage_production_id(name))
  and (split_part(name, '/', 3) <> 'feedback' or owner_id = auth.uid()::text)
);

-- 확인용: 실행 결과에 stageflow_files_production_delete 한 줄이 나오면 적용 완료입니다.
select policyname, cmd, roles
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname = 'stageflow_files_production_delete';
