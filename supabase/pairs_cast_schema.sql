-- StageFlow relational cast model
-- Safe additive migration: existing tables and Storage JSON are not removed.

create extension if not exists pgcrypto;

create table if not exists public.production_pairs (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  name text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (production_id, name)
);

create table if not exists public.production_people (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  contact_note text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (production_id, display_name)
);

create table if not exists public.production_roles (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  parent_role_id uuid references public.production_roles(id) on delete cascade,
  depth smallint not null check (depth in (1, 2)),
  name text not null,
  role_type text not null default '배역' check (role_type in ('주연', '조연', '앙상블', '배역')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((depth = 1 and parent_role_id is null) or (depth = 2 and parent_role_id is not null))
);

create unique index if not exists production_roles_depth1_unique
  on public.production_roles (production_id, lower(name)) where depth = 1;
create unique index if not exists production_roles_depth2_unique
  on public.production_roles (production_id, parent_role_id, lower(name)) where depth = 2;

create table if not exists public.pair_cast_assignments (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  pair_id uuid not null references public.production_pairs(id) on delete cascade,
  person_id uuid not null references public.production_people(id) on delete cascade,
  role_depth1_id uuid not null references public.production_roles(id) on delete cascade,
  role_depth2_id uuid references public.production_roles(id) on delete set null,
  is_primary boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pair_id, person_id, role_depth1_id, role_depth2_id)
);

create table if not exists public.scene_cast_assignments (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  pair_cast_assignment_id uuid not null references public.pair_cast_assignments(id) on delete cascade,
  appearance_type text not null default '등장' check (appearance_type in ('메인', '등장', '백', '대기')),
  entrance_note text not null default '',
  exit_note text not null default '',
  created_at timestamptz not null default now(),
  unique (scene_id, pair_cast_assignment_id, appearance_type)
);

create index if not exists production_pairs_production_idx on public.production_pairs(production_id, sort_order);
create index if not exists production_people_production_idx on public.production_people(production_id, display_name);
create index if not exists production_people_user_idx on public.production_people(user_id) where user_id is not null;
create index if not exists production_roles_production_idx on public.production_roles(production_id, depth, sort_order);
create index if not exists pair_cast_pair_idx on public.pair_cast_assignments(pair_id);
create index if not exists pair_cast_person_idx on public.pair_cast_assignments(person_id);
create index if not exists scene_cast_scene_idx on public.scene_cast_assignments(scene_id);

create or replace function public.stageflow_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists production_pairs_touch_updated_at on public.production_pairs;
create trigger production_pairs_touch_updated_at before update on public.production_pairs
for each row execute function public.stageflow_touch_updated_at();
drop trigger if exists production_people_touch_updated_at on public.production_people;
create trigger production_people_touch_updated_at before update on public.production_people
for each row execute function public.stageflow_touch_updated_at();
drop trigger if exists production_roles_touch_updated_at on public.production_roles;
create trigger production_roles_touch_updated_at before update on public.production_roles
for each row execute function public.stageflow_touch_updated_at();
drop trigger if exists pair_cast_touch_updated_at on public.pair_cast_assignments;
create trigger pair_cast_touch_updated_at before update on public.pair_cast_assignments
for each row execute function public.stageflow_touch_updated_at();

create or replace function public.stageflow_can_access_production(target_production_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.productions p
    join public.workspace_members wm on wm.workspace_id = p.workspace_id
    where p.id = target_production_id and wm.user_id = auth.uid()
  );
$$;

grant execute on function public.stageflow_can_access_production(uuid) to authenticated;

alter table public.production_pairs enable row level security;
alter table public.production_people enable row level security;
alter table public.production_roles enable row level security;
alter table public.pair_cast_assignments enable row level security;
alter table public.scene_cast_assignments enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['production_pairs','production_people','production_roles','pair_cast_assignments','scene_cast_assignments']
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_member_access', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.stageflow_can_access_production(production_id)) with check (public.stageflow_can_access_production(production_id))',
      table_name || '_member_access', table_name
    );
  end loop;
end $$;

grant select, insert, update, delete on public.production_pairs to authenticated;
grant select, insert, update, delete on public.production_people to authenticated;
grant select, insert, update, delete on public.production_roles to authenticated;
grant select, insert, update, delete on public.pair_cast_assignments to authenticated;
grant select, insert, update, delete on public.scene_cast_assignments to authenticated;

-- Enforce that both role columns have the expected hierarchy and that all
-- referenced rows belong to the same production and pair.
create or replace function public.stageflow_validate_pair_cast_assignment()
returns trigger language plpgsql as $$
declare
  pair_production uuid;
  person_production uuid;
  depth1_production uuid;
  depth1_value smallint;
  depth2_production uuid;
  depth2_value smallint;
  depth2_parent uuid;
begin
  select production_id into pair_production from public.production_pairs where id = new.pair_id;
  select production_id into person_production from public.production_people where id = new.person_id;
  select production_id, depth into depth1_production, depth1_value from public.production_roles where id = new.role_depth1_id;
  if new.role_depth2_id is not null then
    select production_id, depth, parent_role_id into depth2_production, depth2_value, depth2_parent from public.production_roles where id = new.role_depth2_id;
  end if;
  if pair_production <> new.production_id or person_production <> new.production_id or depth1_production <> new.production_id then
    raise exception '페어, 배우, 1Depth 배역은 같은 공연에 속해야 합니다';
  end if;
  if depth1_value <> 1 then raise exception 'role_depth1_id는 1Depth 배역이어야 합니다'; end if;
  if new.role_depth2_id is not null and (depth2_production <> new.production_id or depth2_value <> 2 or depth2_parent <> new.role_depth1_id) then
    raise exception '2Depth 배역은 선택한 1Depth 배역의 하위 배역이어야 합니다';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_pair_cast_assignment on public.pair_cast_assignments;
create trigger validate_pair_cast_assignment before insert or update on public.pair_cast_assignments
for each row execute function public.stageflow_validate_pair_cast_assignment();

create or replace view public.production_cast_matrix
with (security_invoker = true) as
select
  a.production_id,
  a.id as assignment_id,
  pair.id as pair_id,
  pair.name as pair_name,
  person.id as person_id,
  person.user_id,
  person.display_name,
  role1.id as role_depth1_id,
  role1.name as role_depth1_name,
  role2.id as role_depth2_id,
  role2.name as role_depth2_name,
  a.is_primary,
  a.note
from public.pair_cast_assignments a
join public.production_pairs pair on pair.id = a.pair_id
join public.production_people person on person.id = a.person_id
join public.production_roles role1 on role1.id = a.role_depth1_id
left join public.production_roles role2 on role2.id = a.role_depth2_id;

grant select on public.production_cast_matrix to authenticated;
