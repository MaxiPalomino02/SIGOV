-- 070_chequeo.sql
-- Chequeo de unidades y herramientas.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.

-- ============================================================
-- Tablas
-- ============================================================

create table if not exists public.chequeo_plantillas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  tipo            text not null check (tipo in ('apertura', 'cierre')),
  activa          boolean not null default true,
  creado_por      uuid not null references public.bomberos (id),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create index if not exists idx_chequeo_plantillas_tipo on public.chequeo_plantillas (tipo);
create index if not exists idx_chequeo_plantillas_activa on public.chequeo_plantillas (activa);

alter table public.chequeo_plantillas enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='chequeo_plantillas' and policyname='chequeo_plantillas_select_authenticated'
  ) then
    create policy chequeo_plantillas_select_authenticated on public.chequeo_plantillas for select to authenticated using (true);
  end if;
end $$;

revoke all on table public.chequeo_plantillas from public, anon, authenticated;
grant select on table public.chequeo_plantillas to authenticated;
grant all on table public.chequeo_plantillas to service_role;

-- ============================================================
-- Items de plantilla (agrupados por grupo/unidad)
-- ============================================================

create table if not exists public.chequeo_items (
  id              uuid primary key default gen_random_uuid(),
  plantilla_id    uuid not null references public.chequeo_plantillas (id) on delete cascade,
  orden           integer not null default 0,
  nombre          text not null,
  grupo           text not null default '',
  creado_en       timestamptz not null default now()
);

create index if not exists idx_chequeo_items_plantilla on public.chequeo_items (plantilla_id, orden);

alter table public.chequeo_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='chequeo_items' and policyname='chequeo_items_select_authenticated'
  ) then
    create policy chequeo_items_select_authenticated on public.chequeo_items for select to authenticated using (true);
  end if;
end $$;

revoke all on table public.chequeo_items from public, anon, authenticated;
grant select on table public.chequeo_items to authenticated;
grant all on table public.chequeo_items to service_role;

-- ============================================================
-- Chequeos (instancias de ejecución)
-- ============================================================

create table if not exists public.chequeos (
  id              uuid primary key default gen_random_uuid(),
  plantilla_id    uuid not null references public.chequeo_plantillas (id),
  realizado_por   uuid not null references public.bomberos (id),
  fecha           date not null,
  franja          text not null check (franja in ('08:00-13:00', '13:00-18:00', '18:00-23:00', '23:00-08:00')),
  estado          text not null default 'en_curso' check (estado in ('en_curso', 'completo')),
  observaciones   text not null default '',
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create unique index if not exists idx_chequeos_unico on public.chequeos (plantilla_id, fecha, franja, realizado_por);
create index if not exists idx_chequeos_fecha on public.chequeos (fecha);
create index if not exists idx_chequeos_estado on public.chequeos (estado);

alter table public.chequeos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='chequeos' and policyname='chequeos_select_authenticated'
  ) then
    create policy chequeos_select_authenticated on public.chequeos for select to authenticated using (true);
  end if;
end $$;

revoke all on table public.chequeos from public, anon, authenticated;
grant select on table public.chequeos to authenticated;
grant all on table public.chequeos to service_role;

-- ============================================================
-- Resultados de items (OK / Falta / Danoado)
-- ============================================================

create table if not exists public.chequeo_resultados (
  chequeo_id      uuid not null references public.chequeos (id) on delete cascade,
  item_id         uuid not null references public.chequeo_items (id) on delete cascade,
  estado          text not null check (estado in ('ok', 'falta', 'danado')),
  nota            text not null default '',
  foto_path       text,
  actualizado_en  timestamptz not null default now(),
  primary key (chequeo_id, item_id)
);

create index if not exists idx_chequeo_resultados_chequeo on public.chequeo_resultados (chequeo_id);
create index if not exists idx_chequeo_resultados_estado on public.chequeo_resultados (estado);

alter table public.chequeo_resultados enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='chequeo_resultados' and policyname='chequeo_resultados_select_authenticated'
  ) then
    create policy chequeo_resultados_select_authenticated on public.chequeo_resultados for select to authenticated using (true);
  end if;
end $$;

revoke all on table public.chequeo_resultados from public, anon, authenticated;
grant select on table public.chequeo_resultados to authenticated;
grant all on table public.chequeo_resultados to service_role;

-- ============================================================
-- Realtime
-- ============================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chequeo_plantillas'
     ) then
    alter publication supabase_realtime add table public.chequeo_plantillas;
  end if;
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chequeo_items'
     ) then
    alter publication supabase_realtime add table public.chequeo_items;
  end if;
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chequeos'
     ) then
    alter publication supabase_realtime add table public.chequeos;
  end if;
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chequeo_resultados'
     ) then
    alter publication supabase_realtime add table public.chequeo_resultados;
  end if;
end $$;

-- ============================================================
-- Helper: valida oficial
-- ============================================================

create or replace function public._chequeo_es_oficial(p_bombero_id uuid)
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

-- ============================================================
-- RPCs: Plantillas (solo oficiales)
-- ============================================================

create or replace function public.crear_chequeo_plantilla(
  p_bombero_id uuid,
  p_nombre text,
  p_tipo text
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
  if p_tipo not in ('apertura', 'cierre') then
    raise exception using errcode='P0001', message='TIPO_INVALIDO';
  end if;
  if btrim(coalesce(p_nombre, '')) = '' then
    raise exception using errcode='P0001', message='NOMBRE_REQUERIDO';
  end if;

  insert into public.chequeo_plantillas (nombre, tipo, creado_por)
  values (btrim(p_nombre), p_tipo, p_bombero_id)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.editar_chequeo_plantilla(
  p_bombero_id uuid,
  p_plantilla_id uuid,
  p_nombre text,
  p_tipo text,
  p_activa boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._chequeo_es_oficial(p_bombero_id) then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;
  if p_tipo not in ('apertura', 'cierre') then
    raise exception using errcode='P0001', message='TIPO_INVALIDO';
  end if;
  if btrim(coalesce(p_nombre, '')) = '' then
    raise exception using errcode='P0001', message='NOMBRE_REQUERIDO';
  end if;

  update public.chequeo_plantillas set
    nombre = btrim(p_nombre),
    tipo = p_tipo,
    activa = p_activa,
    actualizado_en = now()
  where id = p_plantilla_id;

  if not found then
    raise exception using errcode='P0001', message='PLANTILLA_NO_ENCONTRADA';
  end if;
end;
$$;

create or replace function public.borrar_chequeo_plantilla(
  p_bombero_id uuid,
  p_plantilla_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._chequeo_es_oficial(p_bombero_id) then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;

  delete from public.chequeo_plantillas where id = p_plantilla_id;

  if not found then
    raise exception using errcode='P0001', message='PLANTILLA_NO_ENCONTRADA';
  end if;
end;
$$;

-- ============================================================
-- RPCs: Items (solo oficiales)
-- ============================================================

create or replace function public.crear_chequeo_item(
  p_bombero_id uuid,
  p_plantilla_id uuid,
  p_nombre text,
  p_grupo text,
  p_orden integer
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

  insert into public.chequeo_items (plantilla_id, nombre, grupo, orden)
  values (p_plantilla_id, btrim(p_nombre), btrim(coalesce(p_grupo, '')), coalesce(p_orden, 0))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.editar_chequeo_item(
  p_bombero_id uuid,
  p_item_id uuid,
  p_nombre text,
  p_grupo text,
  p_orden integer
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

  update public.chequeo_items set
    nombre = btrim(p_nombre),
    grupo = btrim(coalesce(p_grupo, '')),
    orden = coalesce(p_orden, 0)
  where id = p_item_id;

  if not found then
    raise exception using errcode='P0001', message='ITEM_NO_ENCONTRADO';
  end if;
end;
$$;

create or replace function public.borrar_chequeo_item(
  p_bombero_id uuid,
  p_item_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._chequeo_es_oficial(p_bombero_id) then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;

  delete from public.chequeo_items where id = p_item_id;

  if not found then
    raise exception using errcode='P0001', message='ITEM_NO_ENCONTRADO';
  end if;
end;
$$;

create or replace function public.reordenar_chequeo_items(
  p_bombero_id uuid,
  p_plantilla_id uuid,
  p_items jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_item record;
begin
  if not public._chequeo_es_oficial(p_bombero_id) then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) as elem
  loop
    update public.chequeo_items set
      orden = (v_item->>'orden')::int,
      grupo = btrim(coalesce(v_item->>'grupo', ''))
    where id = (v_item->>'id')::uuid and plantilla_id = p_plantilla_id;
  end loop;
end;
$$;

-- ============================================================
-- RPCs: Chequeos (ejecución por bomberos de guardia)
-- ============================================================

create or replace function public.iniciar_chequeo(
  p_bombero_id uuid,
  p_plantilla_id uuid,
  p_fecha date,
  p_franja text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.bomberos where id = p_bombero_id and activo = true) then
    raise exception using errcode='P0001', message='BOMBERO_INACTIVO';
  end if;
  if p_franja not in ('08:00-13:00', '13:00-18:00', '18:00-23:00', '23:00-08:00') then
    raise exception using errcode='P0001', message='FRANJA_INVALIDA';
  end if;
  if not exists (select 1 from public.chequeo_plantillas where id = p_plantilla_id and activa = true) then
    raise exception using errcode='P0001', message='PLANTILLA_NO_ENCONTRADA';
  end if;

  -- Upsert: si ya existe uno en_curso para esa plantilla/fecha/franja/bombero, lo reusa
  select id into v_id
  from public.chequeos
  where plantilla_id = p_plantilla_id
    and fecha = p_fecha
    and franja = p_franja
    and realizado_por = p_bombero_id
    and estado = 'en_curso'
  limit 1;

  if v_id is null then
    insert into public.chequeos (plantilla_id, realizado_por, fecha, franja, estado)
    values (p_plantilla_id, p_bombero_id, p_fecha, p_franja, 'en_curso')
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.guardar_resultado_chequeo(
  p_bombero_id uuid,
  p_chequeo_id uuid,
  p_item_id uuid,
  p_estado text,
  p_nota text,
  p_foto_path text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.bomberos where id = p_bombero_id and activo = true) then
    raise exception using errcode='P0001', message='BOMBERO_INACTIVO';
  end if;
  if p_estado not in ('ok', 'falta', 'danado') then
    raise exception using errcode='P0001', message='ESTADO_INVALIDO';
  end if;

  -- Verificar que el chequeo pertenezca al bombero
  if not exists (select 1 from public.chequeos where id = p_chequeo_id and realizado_por = p_bombero_id) then
    raise exception using errcode='P0001', message='CHEQUEO_NO_PERTENECE';
  end if;

  -- Verificar que el item pertenezca a la plantilla del chequeo
  if not exists (
    select 1 from public.chequeo_items ci
    join public.chequeos c on c.plantilla_id = ci.plantilla_id
    where ci.id = p_item_id and c.id = p_chequeo_id
  ) then
    raise exception using errcode='P0001', message='ITEM_NO_PERTENECE';
  end if;

  insert into public.chequeo_resultados (chequeo_id, item_id, estado, nota, foto_path, actualizado_en)
  values (p_chequeo_id, p_item_id, p_estado, btrim(coalesce(p_nota, '')), nullif(btrim(coalesce(p_foto_path, '')), ''), now())
  on conflict (chequeo_id, item_id) do update set
    estado = excluded.estado,
    nota = excluded.nota,
    foto_path = excluded.foto_path,
    actualizado_en = now();
end;
$$;

create or replace function public.finalizar_chequeo(
  p_bombero_id uuid,
  p_chequeo_id uuid,
  p_observaciones text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.bomberos where id = p_bombero_id and activo = true) then
    raise exception using errcode='P0001', message='BOMBERO_INACTIVO';
  end if;

  update public.chequeos set
    estado = 'completo',
    observaciones = btrim(coalesce(p_observaciones, '')),
    actualizado_en = now()
  where id = p_chequeo_id and realizado_por = p_bombero_id;

  if not found then
    raise exception using errcode='P0001', message='CHEQUEO_NO_ENCONTRADO';
  end if;
end;
$$;

-- ============================================================
-- RPCs: Lectura (para reportes, historial - oficiales)
-- ============================================================

drop function if exists public.obtener_chequeos_fecha(uuid, date);
create or replace function public.obtener_chequeos_fecha(
  p_bombero_id uuid,
  p_fecha date
) returns table (
  id uuid,
  plantilla_id uuid,
  plantilla_nombre text,
  plantilla_tipo text,
  realizado_por uuid,
  bombero_nombre text,
  franja text,
  estado text,
  observaciones text,
  creado_en timestamptz,
  actualizado_en timestamptz,
  total_items bigint,
  ok_count bigint,
  fallas_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._chequeo_es_oficial(p_bombero_id) then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;

  return query
  select
    c.id,
    c.plantilla_id,
    cp.nombre as plantilla_nombre,
    cp.tipo as plantilla_tipo,
    c.realizado_por,
    b.nombre_completo as bombero_nombre,
    c.franja,
    c.estado,
    c.observaciones,
    c.creado_en,
    c.actualizado_en,
    count(cr.item_id)::bigint as total_items,
    count(cr.item_id) filter (where cr.estado = 'ok')::bigint as ok_count,
    count(cr.item_id) filter (where cr.estado in ('falta', 'danado'))::bigint as fallas_count
  from public.chequeos c
  join public.chequeo_plantillas cp on cp.id = c.plantilla_id
  join public.bomberos b on b.id = c.realizado_por
  left join public.chequeo_resultados cr on cr.chequeo_id = c.id
  where c.fecha = p_fecha
  group by c.id, cp.id, cp.nombre, cp.tipo, b.nombre_completo
  order by c.franja, cp.nombre;
end;
$$;

drop function if exists public.obtener_chequeo_detalle(uuid, uuid);
create or replace function public.obtener_chequeo_detalle(
  p_bombero_id uuid,
  p_chequeo_id uuid
) returns table (
  item_id uuid,
  item_nombre text,
  grupo text,
  orden integer,
  estado text,
  nota text,
  foto_path text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._chequeo_es_oficial(p_bombero_id) then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;

  return query
  select
    ci.id as item_id,
    ci.nombre as item_nombre,
    ci.grupo,
    ci.orden,
    cr.estado,
    cr.nota,
    cr.foto_path
  from public.chequeo_items ci
  join public.chequeos c on c.plantilla_id = ci.plantilla_id
  left join public.chequeo_resultados cr on cr.chequeo_id = c.id and cr.item_id = ci.id
  where c.id = p_chequeo_id
  order by ci.grupo, ci.orden;
end;
$$;

-- ============================================================
-- RPC: Firmar URL para subida de foto (Storage)
-- ============================================================

create or replace function public.firmar_subida_foto_chequeo(
  p_bombero_id uuid,
  p_chequeo_id uuid,
  p_item_id uuid,
  p_content_type text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_path text;
begin
  if not exists (select 1 from public.bomberos where id = p_bombero_id and activo = true) then
    raise exception using errcode='P0001', message='BOMBERO_INACTIVO';
  end if;

  if not exists (select 1 from public.chequeos where id = p_chequeo_id and realizado_por = p_bombero_id) then
    raise exception using errcode='P0001', message='CHEQUEO_NO_PERTENECE';
  end if;

  if not exists (
    select 1 from public.chequeo_items ci
    join public.chequeos c on c.plantilla_id = ci.plantilla_id
    where ci.id = p_item_id and c.id = p_chequeo_id
  ) then
    raise exception using errcode='P0001', message='ITEM_NO_PERTENECE';
  end if;

  -- Ruta: chequeos/{chequeo_id}/{item_id}/{timestamp}.{ext}
  v_path := format('chequeos/%s/%s/%s', p_chequeo_id, p_item_id, extract(epoch from now())::bigint);

  -- Generar signed URL (válida 10 min)
  return storage.create_signed_upload_url('chequeos', v_path, '{"contentType": "' || p_content_type || '"}')::text;
end;
$$;

-- ============================================================
-- Permisos
-- ============================================================

revoke all on function public._chequeo_es_oficial(uuid) from public, anon, authenticated;
revoke all on function public.crear_chequeo_plantilla(uuid, text, text) from public, anon, authenticated;
revoke all on function public.editar_chequeo_plantilla(uuid, uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.borrar_chequeo_plantilla(uuid, uuid) from public, anon, authenticated;
revoke all on function public.crear_chequeo_item(uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.editar_chequeo_item(uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.borrar_chequeo_item(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reordenar_chequeo_items(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.iniciar_chequeo(uuid, uuid, date, text) from public, anon, authenticated;
revoke all on function public.guardar_resultado_chequeo(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.finalizar_chequeo(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.obtener_chequeos_fecha(uuid, date) from public, anon, authenticated;
revoke all on function public.obtener_chequeo_detalle(uuid, uuid) from public, anon, authenticated;
revoke all on function public.firmar_subida_foto_chequeo(uuid, uuid, uuid, text) from public, anon, authenticated;

grant execute on function public._chequeo_es_oficial(uuid) to service_role;
grant execute on function public.crear_chequeo_plantilla(uuid, text, text) to service_role;
grant execute on function public.editar_chequeo_plantilla(uuid, uuid, text, text, boolean) to service_role;
grant execute on function public.borrar_chequeo_plantilla(uuid, uuid) to service_role;
grant execute on function public.crear_chequeo_item(uuid, uuid, text, text, integer) to service_role;
grant execute on function public.editar_chequeo_item(uuid, uuid, text, text, integer) to service_role;
grant execute on function public.borrar_chequeo_item(uuid, uuid) to service_role;
grant execute on function public.reordenar_chequeo_items(uuid, uuid, jsonb) to service_role;
grant execute on function public.iniciar_chequeo(uuid, uuid, date, text) to service_role;
grant execute on function public.guardar_resultado_chequeo(uuid, uuid, uuid, text, text, text) to service_role;
grant execute on function public.finalizar_chequeo(uuid, uuid, text) to service_role;
grant execute on function public.obtener_chequeos_fecha(uuid, date) to service_role;
grant execute on function public.obtener_chequeo_detalle(uuid, uuid) to service_role;
grant execute on function public.firmar_subida_foto_chequeo(uuid, uuid, uuid, text) to service_role;

-- ============================================================
-- Nota: El bucket "chequeos" en Storage debe crearse manualmente en el dashboard de Supabase
-- (Storage > New bucket > Nombre: chequeos > Private bucket).
-- Políticas de Storage (RLS):
--   - SELECT: authenticated users pueden ver sus propias fotos (policy usando auth.uid() en path)
--   - INSERT: authenticated users pueden subir a su propia carpeta chequeos/{chequeo_id}/...
--   - Se recomienda usar signed URLs desde el servidor (RPC firmar_subida_foto_chequeo)
-- ============================================================