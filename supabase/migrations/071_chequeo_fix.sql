-- 071_chequeo_fix.sql
-- Corrige firmas de RPCs de lectura y elimina dependencia de storage.create_signed_upload_url.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.

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

revoke all on function public.obtener_chequeos_fecha(uuid, date) from public, anon, authenticated;
revoke all on function public.obtener_chequeo_detalle(uuid, uuid) from public, anon, authenticated;
grant execute on function public.obtener_chequeos_fecha(uuid, date) to service_role;
grant execute on function public.obtener_chequeo_detalle(uuid, uuid) to service_role;
