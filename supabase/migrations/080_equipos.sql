-- 080_equipos.sql
-- Equipamiento: equipos, movimientos e integración con chequeos.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.

-- ============================================================
-- Tablas
-- ============================================================

create table if not exists public.equipos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nombre text not null,
  categoria text not null,
  ubicacion text not null default '',
  estado text not null default 'operativo' check (estado in ('operativo', 'en_reparacion', 'baja')),
  notas text not null default '',
  foto_path text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index if not exists idx_equipos_codigo on public.equipos (lower(codigo));
create index if not exists idx_equipos_categoria on public.equipos (categoria);
create index if not exists idx_equipos_estado on public.equipos (estado);

alter table public.equipos enable row level security;

create table if not exists public.equipos_movimientos (
  id uuid primary key default gen_random_uuid(),
  equipo_id uuid not null references public.equipos(id) on delete cascade,
  accion text not null,
  bombero_id uuid not null references public.bomberos(id),
  nota text not null default '',
  fecha timestamptz not null default now()
);

create index if not exists idx_equipos_movimientos_equipo on public.equipos_movimientos (equipo_id, fecha desc);

alter table public.equipos_movimientos enable row level security;

-- Vinculación opcional de ítems de chequeo con equipos
alter table public.chequeo_items add column if not exists equipo_id uuid references public.equipos(id) on delete set null;
create index if not exists idx_chequeo_items_equipo on public.chequeo_items (equipo_id);

-- ============================================================
-- Realtime
-- ============================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'equipos'
     ) then
    alter publication supabase_realtime add table public.equipos;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'equipos_movimientos'
     ) then
    alter publication supabase_realtime add table public.equipos_movimientos;
  end if;
end $$;

-- ============================================================
-- Helper: bombero de guardia en la franja actual (America/Argentina/Tucuman)
-- ============================================================

create or replace function public._equipo_bombero_de_guardia(p_bombero_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_local timestamp;
  v_hora integer;
  v_fecha date;
  v_franja text;
begin
  v_local := timezone('America/Argentina/Tucuman', now());
  v_hora := extract(hour from v_local)::integer;
  v_fecha := v_local::date;

  if v_hora >= 23 then
    v_franja := '23:00-08:00';
  elsif v_hora < 8 then
    v_fecha := v_fecha - 1; v_franja := '23:00-08:00';
  elsif v_hora < 13 then
    v_franja := '08:00-13:00';
  elsif v_hora < 18 then
    v_franja := '13:00-18:00';
  else
    v_franja := '18:00-23:00';
  end if;

  return exists (
    select 1 from public.turnos t
    where t.bombero_id = p_bombero_id and t.fecha = v_fecha and t.franja = v_franja
  );
end;
$$;

-- ============================================================
-- RPCs: Equipos
-- ============================================================

create or replace function public.crear_equipo(
  p_bombero_id uuid,
  p_codigo text,
  p_nombre text,
  p_categoria text,
  p_ubicacion text,
  p_estado text,
  p_notas text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_codigo text;
  v_nombre text;
  v_categoria text;
  v_estado text;
begin
  if not public._chequeo_es_oficial(p_bombero_id) then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;

  v_codigo := btrim(coalesce(p_codigo, ''));
  v_nombre := btrim(coalesce(p_nombre, ''));
  v_categoria := btrim(coalesce(p_categoria, ''));
  v_estado := coalesce(nullif(btrim(p_estado), ''), 'operativo');

  if v_codigo = '' then raise exception using errcode='P0001', message='CODIGO_REQUERIDO'; end if;
  if v_nombre = '' then raise exception using errcode='P0001', message='NOMBRE_REQUERIDO'; end if;
  if v_categoria = '' then raise exception using errcode='P0001', message='CATEGORIA_REQUERIDA'; end if;
  if v_estado not in ('operativo', 'en_reparacion', 'baja') then
    raise exception using errcode='P0001', message='ESTADO_INVALIDO';
  end if;
  if exists (select 1 from public.equipos e where lower(e.codigo) = lower(v_codigo)) then
    raise exception using errcode='P0001', message='CODIGO_DUPLICADO';
  end if;

  insert into public.equipos (codigo, nombre, categoria, ubicacion, estado, notas)
  values (v_codigo, v_nombre, v_categoria, btrim(coalesce(p_ubicacion, '')), v_estado, btrim(coalesce(p_notas, '')))
  returning id into v_id;

  insert into public.equipos_movimientos (equipo_id, accion, bombero_id, nota)
  values (v_id, 'alta', p_bombero_id, 'Alta de equipo');

  return v_id;
end;
$$;

create or replace function public.editar_equipo(
  p_bombero_id uuid,
  p_equipo_id uuid,
  p_codigo text,
  p_nombre text,
  p_categoria text,
  p_ubicacion text,
  p_notas text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_nombre text;
  v_categoria text;
begin
  if not public._chequeo_es_oficial(p_bombero_id) then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;

  v_codigo := btrim(coalesce(p_codigo, ''));
  v_nombre := btrim(coalesce(p_nombre, ''));
  v_categoria := btrim(coalesce(p_categoria, ''));

  if v_codigo = '' then raise exception using errcode='P0001', message='CODIGO_REQUERIDO'; end if;
  if v_nombre = '' then raise exception using errcode='P0001', message='NOMBRE_REQUERIDO'; end if;
  if v_categoria = '' then raise exception using errcode='P0001', message='CATEGORIA_REQUERIDA'; end if;
  if exists (select 1 from public.equipos e where lower(e.codigo) = lower(v_codigo) and e.id <> p_equipo_id) then
    raise exception using errcode='P0001', message='CODIGO_DUPLICADO';
  end if;

  update public.equipos set
    codigo = v_codigo,
    nombre = v_nombre,
    categoria = v_categoria,
    ubicacion = btrim(coalesce(p_ubicacion, '')),
    notas = btrim(coalesce(p_notas, '')),
    actualizado_en = now()
  where id = p_equipo_id;

  if not found then raise exception using errcode='P0001', message='EQUIPO_NO_ENCONTRADO'; end if;

  insert into public.equipos_movimientos (equipo_id, accion, bombero_id, nota)
  values (p_equipo_id, 'edicion', p_bombero_id, 'Edición de datos');
end;
$$;

create or replace function public.cambiar_estado_equipo(
  p_bombero_id uuid,
  p_equipo_id uuid,
  p_estado text,
  p_nota text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_estado text;
  v_nota text;
  v_actual text;
begin
  select id, cargo, activo into v_actor from public.bomberos where id = p_bombero_id and activo = true;
  if not found then raise exception using errcode='P0001', message='BOMBERO_INACTIVO'; end if;

  v_estado := btrim(coalesce(p_estado, ''));
  v_nota := btrim(coalesce(p_nota, ''));
  if v_estado not in ('operativo', 'en_reparacion', 'baja') then
    raise exception using errcode='P0001', message='ESTADO_INVALIDO';
  end if;
  if v_nota = '' then raise exception using errcode='P0001', message='NOTA_REQUERIDA'; end if;

  if v_actor.cargo not in ('Oficial Principal', 'Oficial Ayudante')
     and not public._equipo_bombero_de_guardia(p_bombero_id) then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;

  select estado into v_actual from public.equipos where id = p_equipo_id for update;
  if not found then raise exception using errcode='P0001', message='EQUIPO_NO_ENCONTRADO'; end if;

  update public.equipos set estado = v_estado, actualizado_en = now() where id = p_equipo_id;

  insert into public.equipos_movimientos (equipo_id, accion, bombero_id, nota)
  values (p_equipo_id, 'cambio_estado:' || v_actual || '->' || v_estado, p_bombero_id, v_nota);
end;
$$;

-- ============================================================
-- RPCs: Chequeo items con equipo_id (reemplazan versiones 070)
-- ============================================================

create or replace function public.crear_chequeo_item(
  p_bombero_id uuid,
  p_plantilla_id uuid,
  p_nombre text,
  p_grupo text,
  p_orden integer,
  p_equipo_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not public._chequeo_es_oficial(p_bombero_id) then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;
  if not exists (select 1 from public.chequeo_plantillas where id = p_plantilla_id) then
    raise exception using errcode='P0001', message='PLANTILLA_NO_ENCONTRADA';
  end if;
  if btrim(coalesce(p_nombre, '')) = '' then
    raise exception using errcode='P0001', message='NOMBRE_REQUERIDO';
  end if;
  if p_equipo_id is not null and not exists (select 1 from public.equipos where id = p_equipo_id) then
    raise exception using errcode='P0001', message='EQUIPO_NO_ENCONTRADO';
  end if;

  insert into public.chequeo_items (plantilla_id, nombre, grupo, orden, equipo_id)
  values (p_plantilla_id, btrim(p_nombre), btrim(coalesce(p_grupo, '')), coalesce(p_orden, 0), p_equipo_id)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.editar_chequeo_item(
  p_bombero_id uuid,
  p_item_id uuid,
  p_nombre text,
  p_grupo text,
  p_orden integer,
  p_equipo_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._chequeo_es_oficial(p_bombero_id) then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;
  if btrim(coalesce(p_nombre, '')) = '' then
    raise exception using errcode='P0001', message='NOMBRE_REQUERIDO';
  end if;
  if p_equipo_id is not null and not exists (select 1 from public.equipos where id = p_equipo_id) then
    raise exception using errcode='P0001', message='EQUIPO_NO_ENCONTRADO';
  end if;

  update public.chequeo_items set
    nombre = btrim(p_nombre),
    grupo = btrim(coalesce(p_grupo, '')),
    orden = coalesce(p_orden, 0),
    equipo_id = p_equipo_id
  where id = p_item_id;

  if not found then
    raise exception using errcode='P0001', message='ITEM_NO_ENCONTRADO';
  end if;
end;
$$;

-- ============================================================
-- Permisos
-- ============================================================

revoke all on table public.equipos from public, anon, authenticated;
revoke all on table public.equipos_movimientos from public, anon, authenticated;
grant all on table public.equipos to service_role;
grant all on table public.equipos_movimientos to service_role;

revoke all on function public._equipo_bombero_de_guardia(uuid) from public, anon, authenticated;
revoke all on function public.crear_equipo(uuid, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.editar_equipo(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.cambiar_estado_equipo(uuid, uuid, text, text) from public, anon, authenticated;

grant execute on function public._equipo_bombero_de_guardia(uuid) to service_role;
grant execute on function public.crear_equipo(uuid, text, text, text, text, text, text) to service_role;
grant execute on function public.editar_equipo(uuid, uuid, text, text, text, text, text) to service_role;
grant execute on function public.cambiar_estado_equipo(uuid, uuid, text, text) to service_role;

-- Re-otorgar execute de chequeo_items por cambio de firma (5 y 6 args)
revoke all on function public.crear_chequeo_item(uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.crear_chequeo_item(uuid, uuid, text, text, integer, uuid) from public, anon, authenticated;
revoke all on function public.editar_chequeo_item(uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.editar_chequeo_item(uuid, uuid, text, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.crear_chequeo_item(uuid, uuid, text, text, integer, uuid) to service_role;
grant execute on function public.editar_chequeo_item(uuid, uuid, text, text, integer, uuid) to service_role;
