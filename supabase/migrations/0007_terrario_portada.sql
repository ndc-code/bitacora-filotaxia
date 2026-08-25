alter table public.terrario_fotos
  add column es_portada boolean not null default false;

create unique index terrario_fotos_una_portada_por_terrario
  on public.terrario_fotos (terrario_id)
  where es_portada;
