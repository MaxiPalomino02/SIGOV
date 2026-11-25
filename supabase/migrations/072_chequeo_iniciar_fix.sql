-- 072_chequeo_iniciar_fix.sql
-- Hace idempotente iniciar_chequeo para evitar error por índice único cuando ya existe un chequeo.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.

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

  select id into v_id
  from public.chequeos
  where plantilla_id = p_plantilla_id
    and fecha = p_fecha
    and franja = p_franja
    and realizado_por = p_bombero_id
  limit 1;

  if v_id is null then
    insert into public.chequeos (plantilla_id, realizado_por, fecha, franja, estado)
    values (p_plantilla_id, p_bombero_id, p_fecha, p_franja, 'en_curso')
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.iniciar_chequeo(uuid, uuid, date, text) from public, anon, authenticated;
grant execute on function public.iniciar_chequeo(uuid, uuid, date, text) to service_role;
