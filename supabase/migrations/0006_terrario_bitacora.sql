alter table public.terrarios
  add column riego_frecuencia_dias integer;

create table public.terrario_cuidados (
  id uuid primary key default gen_random_uuid(),
  terrario_id uuid not null references public.terrarios (id) on delete cascade,
  tipo public.tipo_cuidado not null,
  fecha timestamptz not null default now(),
  notas text,
  created_at timestamptz not null default now()
);

create index terrario_cuidados_terrario_tipo_fecha_idx
  on public.terrario_cuidados (terrario_id, tipo, fecha desc);

alter table public.terrario_cuidados enable row level security;

create policy "terrario_cuidados_owner_all" on public.terrario_cuidados
  for all
  to authenticated
  using (
    exists (
      select 1 from public.terrarios t
      where t.id = terrario_id and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.terrarios t
      where t.id = terrario_id and t.user_id = (select auth.uid())
    )
  );

create table public.terrario_fotos (
  id uuid primary key default gen_random_uuid(),
  terrario_id uuid not null references public.terrarios (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index terrario_fotos_terrario_created_idx
  on public.terrario_fotos (terrario_id, created_at desc);

alter table public.terrario_fotos enable row level security;

create policy "terrario_fotos_owner_all" on public.terrario_fotos
  for all
  to authenticated
  using (
    exists (
      select 1 from public.terrarios t
      where t.id = terrario_id and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.terrarios t
      where t.id = terrario_id and t.user_id = (select auth.uid())
    )
  );

-- Fotos de terrario en el bucket existente 'plantas-fotos', bajo
-- {user_id}/terrario/{terrario_id}/{archivo} (paralelo al subpath
-- {user_id}/coleccion/{coleccion_id}/ que ya usan las fotos por ítem).
create policy "terrario_fotos_owner_select" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'plantas-fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] = 'terrario'
  );

create policy "terrario_fotos_owner_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'plantas-fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] = 'terrario'
  );

create policy "terrario_fotos_owner_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'plantas-fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] = 'terrario'
  );
