-- ============================================================
-- 010 · Endurecimiento de seguridad base
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Cerrar las RPC existentes para anon y authenticated.
-- En Supabase anon y authenticated reciben execute por
-- privilegios por defecto: revocar solo de public no alcanza.
-- ------------------------------------------------------------
revoke all on function public.ocupar_celda(date, text, uuid) from public, anon, authenticated;
revoke all on function public.lock_celda(date, text) from public, anon, authenticated;
revoke all on function public.anotar_turno(date, text, uuid) from public, anon, authenticated;
revoke all on function public.cancelar_turno(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.cambiar_turno(uuid, date, text, uuid) from public, anon, authenticated;
revoke all on function public.generar_turnos_ventana(date, integer) from public, anon, authenticated;
revoke all on function public.crear_bombero(integer, text, text) from public, anon, authenticated;
revoke all on function public.dar_de_baja_bombero(uuid) from public, anon, authenticated;

grant execute on function public.ocupar_celda(date, text, uuid) to service_role;
grant execute on function public.lock_celda(date, text) to service_role;
grant execute on function public.anotar_turno(date, text, uuid) to service_role;
grant execute on function public.cancelar_turno(uuid, uuid, text) to service_role;
grant execute on function public.cambiar_turno(uuid, date, text, uuid) to service_role;
grant execute on function public.generar_turnos_ventana(date, integer) to service_role;
grant execute on function public.crear_bombero(integer, text, text) to service_role;
grant execute on function public.dar_de_baja_bombero(uuid) to service_role;

-- ------------------------------------------------------------
-- 2) Las funciones futuras nacen cerradas.
-- ------------------------------------------------------------
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3) Intentos de login (rate limiting).
-- RLS habilitada y SIN policies: solo se accede por las RPC
-- SECURITY DEFINER de abajo, ejecutables solo por service_role.
-- ------------------------------------------------------------
create table if not exists public.intentos_login (
  id uuid primary key default gen_random_uuid(),
  clave text not null,
  creado_en timestamptz not null default now()
);

create index if not exists idx_intentos_login_clave_creado
  on public.intentos_login (clave, creado_en);

alter table public.intentos_login enable row level security;

revoke all on table public.intentos_login from public, anon, authenticated;
grant all on table public.intentos_login to service_role;

create or replace function public.registrar_intento_login(p_clave text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_clave is null or btrim(p_clave) = '' then
    return;
  end if;

  delete from public.intentos_login
  where creado_en < now() - interval '1 day';

  insert into public.intentos_login (clave)
  values (p_clave);
end;
$$;

create or replace function public.contar_intentos_login(
  p_clave text,
  p_minutos integer
) returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.intentos_login
  where clave = p_clave
    and creado_en >= now() - make_interval(
      mins => greatest(coalesce(p_minutos, 0), 0)
    );
$$;

revoke all on function public.registrar_intento_login(text) from public, anon, authenticated;
revoke all on function public.contar_intentos_login(text, integer) from public, anon, authenticated;

grant execute on function public.registrar_intento_login(text) to service_role;
grant execute on function public.contar_intentos_login(text, integer) to service_role;
