create table public.terrarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('abierto', 'cerrado')),
  created_at timestamptz not null default now()
);

create index terrarios_user_tipo_idx on public.terrarios (user_id, tipo, nombre);

alter table public.terrarios enable row level security;

create policy "terrarios_owner_all" on public.terrarios
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.user_collection
  add column terrario_id uuid not null references public.terrarios (id) on delete cascade;

create index user_collection_terrario_idx on public.user_collection (terrario_id);
