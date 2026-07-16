-- `column display_name does not exist` 오류 전용 선행 보정 SQL
-- 이 파일을 실행한 뒤 pairs_cast_schema.sql 전체를 다시 실행하세요.

alter table public.production_people add column if not exists display_name text;
alter table public.production_people add column if not exists contact_note text not null default '';
alter table public.production_people add column if not exists is_active boolean not null default true;
alter table public.production_people add column if not exists created_at timestamptz not null default now();
alter table public.production_people add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'production_people' and column_name = 'name'
  ) then
    execute 'update public.production_people set display_name = coalesce(nullif(display_name, ''''), nullif(name, ''''), ''이름 미정'')';
  else
    update public.production_people
    set display_name = coalesce(nullif(display_name, ''), '이름 미정');
  end if;
end $$;

alter table public.production_people alter column display_name set not null;
