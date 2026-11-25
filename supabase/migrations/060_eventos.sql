-- 060_eventos.sql
-- Calendario de eventos del cuartel (capacitaciones, reuniones, simulacros, actos).
-- Idempotente. Ejecutar en el SQL Editor de Supabase.

create table if not exists public.eventos (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null default '',
  descripcion   text not null default '',
  tipo          text not null check (
                tipo in ('capacitacion', 'reunion', 'simulacro', 'acto', 'otro')
              ),
  inicio        timestamptz not null,
  fin           timestamptz not null,
  lugar         text not null default '',
  creado_por    uuid references public.bomberos(id),
  creada_en     timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

create index if not exists idx_eventos_inicio on public.eventos (inicio);
create index if not exists idx_eventos_tipo on public.eventos (tipo);
create index if not exists idx_eventos_creado_por on public.eventos (creado_por);

alter table public.eventos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='eventos' and policyname='eventos_select_publico'
  ) then
    create policy eventos_select_publico
      on public.eventos
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

revoke all on table public.eventos from public, anon, authenticated;
grant select on table public.eventos to anon, authenticated;
grant all on table public.eventos to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'eventos'
     ) then
    alter publication supabase_realtime add table public.eventos;
  end if;
end $$;

-- Helper interno: valida oficial activo
create or replace function public._eventos_es_oficial(p_bombero_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bomberos b
    where b.id = p_bombero_id and b.activo = true
      and b.cargo in ('Oficial Principal', 'Oficial Ayudante')
  );
$$;

-- Crear evento. Solo oficiales.
create or replace function public.crear_evento(
  p_bombero_id uuid,
  p_titulo text,
  p_descripcion text,
  p_tipo text,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_lugar text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not public._eventos_es_oficial(p_bombero_id) then
    raise exception using errcode = 'P0001', message = 'SIN_PERMISO';
  end if;
  if p_tipo not in ('capacitacion','reunion','simulacro','acto','otro') then
    raise exception using errcode = 'P0001', message = 'TIPO_INVALIDO';
  end if;
  if btrim(coalesce(p_titulo, '')) = '' then
    raise exception using errcode = 'P0001', message = 'TITULO_REQUERIDO';
  end if;
  if length(btrim(p_titulo)) > 120 then
    raise exception using errcode = 'P0001', message = 'TITULO_LARGO';
  end if;
  if length(coalesce(p_descripcion, '')) > 2000 then
    raise exception using errcode = 'P0001', message = 'DESCRIPCION_LARGA';
  end if;
  if length(coalesce(p_lugar, '')) > 200 then
    raise exception using errcode = 'P0001', message = 'LUGAR_LARGO';
  end if;
  if p_fin <= p_inicio then
    raise exception using errcode = 'P0001', message = 'FIN_DESPUES_INICIO';
  end if;

  insert into public.eventos (titulo, descripcion, tipo, inicio, fin, lugar, creado_por, creada_en, actualizada_en)
  values (btrim(p_titulo), coalesce(p_descripcion, ''), p_tipo, p_inicio, p_fin, coalesce(p_lugar, ''), p_bombero_id, now(), now())
  returning id into v_id;
  return v_id;
end;
$$;

-- Editar evento. Solo oficiales.
create or replace function public.editar_evento(
  p_evento_id uuid,
  p_bombero_id uuid,
  p_titulo text,
  p_descripcion text,
  p_tipo text,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_lugar text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._eventos_es_oficial(p_bombero_id) then
    raise exception using errcode = 'P0001', message = 'SIN_PERMISO';
  end if;
  if p_tipo not in ('capacitacion','reunion','simulacro','acto','otro') then
    raise exception using errcode = 'P0001', message = 'TIPO_INVALIDO';
  end if;
  if btrim(coalesce(p_titulo, '')) = '' then
    raise exception using errcode = 'P0001', message = 'TITULO_REQUERIDO';
  end if;
  if length(btrim(p_titulo)) > 120 then
    raise exception using errcode = 'P0001', message = 'TITULO_LARGO';
  end if;
  if length(coalesce(p_descripcion, '')) > 2000 then
    raise exception using errcode = 'P0001', message = 'DESCRIPCION_LARGA';
  end if;
  if length(coalesce(p_lugar, '')) > 200 then
    raise exception using errcode = 'P0001', message = 'LUGAR_LARGO';
  end if;
  if p_fin <= p_inicio then
    raise exception using errcode = 'P0001', message = 'FIN_DESPUES_INICIO';
  end if;

  update public.eventos
  set titulo = btrim(p_titulo),
      descripcion = coalesce(p_descripcion, ''),
      tipo = p_tipo,
      inicio = p_inicio,
      fin = p_fin,
      lugar = coalesce(p_lugar, ''),
      actualizada_en = now()
  where id = p_evento_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'EVENTO_NO_ENCONTRADO';
  end if;
end;
$$;

-- Borrar evento. Solo oficiales.
create or replace function public.borrar_evento(
  p_evento_id uuid,
  p_bombero_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._eventos_es_oficial(p_bombero_id) then
    raise exception using errcode = 'P0001', message = 'SIN_PERMISO';
  end if;
  delete from public.eventos where id = p_evento_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'EVENTO_NO_ENCONTRADO';
  end if;
end;
$$;

revoke all on function public._eventos_es_oficial(uuid) from public, anon, authenticated;
revoke all on function public.crear_evento(uuid,text,text,text,timestamptz,timestamptz,text) from public, anon, authenticated;
revoke all on function public.editar_evento(uuid,uuid,text,text,text,timestamptz,timestamptz,text) from public, anon, authenticated;
revoke all on function public.borrar_evento(uuid,uuid) from public, anon, authenticated;

grant execute on function public.crear_evento(uuid,text,text,text,timestamptz,timestamptz,text) to service_role;
grant execute on function public.editar_evento(uuid,uuid,text,text,text,timestamptz,timestamptz,text) to service_role;
grant execute on function public.borrar_evento(uuid,uuid) to service_role;
