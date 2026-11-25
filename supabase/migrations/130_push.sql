-- 130_push.sql
-- Web Push con VAPID: suscripciones y registro de envíos.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.

create table if not exists public.push_suscripciones (
  id uuid primary key default gen_random_uuid(),
  bombero_id uuid not null references public.bomberos(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null check (char_length(p256dh) between 1 and 512),
  auth text not null check (char_length(auth) between 1 and 256),
  creada_en timestamptz not null default now(),
  ultimo_uso timestamptz
);

create index if not exists idx_push_suscripciones_bombero
  on public.push_suscripciones (bombero_id);

create table if not exists public.push_envios (
  referencia text primary key,
  registrado_en timestamptz not null default now()
);

alter table public.push_suscripciones enable row level security;
alter table public.push_envios enable row level security;

revoke all on table public.push_suscripciones from public, anon, authenticated;
revoke all on table public.push_envios from public, anon, authenticated;
grant all on table public.push_suscripciones to service_role;
grant all on table public.push_envios to service_role;

create or replace function public.push_guardar_suscripcion(
  p_bombero_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_bombero_id is null
     or p_endpoint is null or char_length(btrim(p_endpoint)) = 0 or char_length(p_endpoint) > 2048
     or p_p256dh is null or char_length(btrim(p_p256dh)) = 0
     or p_auth is null or char_length(btrim(p_auth)) = 0 then
    raise exception using errcode = 'P0001', message = 'DATOS_INVALIDOS';
  end if;

  insert into public.push_suscripciones (bombero_id, endpoint, p256dh, auth, ultimo_uso)
  values (p_bombero_id, p_endpoint, p_p256dh, p_auth, now())
  on conflict (endpoint) do update set
    bombero_id = excluded.bombero_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    ultimo_uso = now();
end;
$$;

create or replace function public.push_borrar_suscripcion(
  p_bombero_id uuid,
  p_endpoint text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.push_suscripciones
  where bombero_id = p_bombero_id
    and (p_endpoint is null or endpoint = p_endpoint);
end;
$$;

create or replace function public.push_obtener_suscripciones(
  p_bombero_id uuid default null
) returns table (id uuid, bombero_id uuid, endpoint text, p256dh text, auth text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select s.id, s.bombero_id, s.endpoint, s.p256dh, s.auth
    from public.push_suscripciones s
    where p_bombero_id is null or s.bombero_id = p_bombero_id;
end;
$$;

create or replace function public.push_marcar_uso(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.push_suscripciones
  set ultimo_uso = now()
  where id = any(coalesce(p_ids, '{}'::uuid[]));
end;
$$;

create or replace function public.push_tiene_suscripcion(p_bombero_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.push_suscripciones s where s.bombero_id = p_bombero_id
  );
end;
$$;

create or replace function public.push_registrar_envio(
  p_referencia text,
  p_ventana_segundos integer default 1800
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ventana integer := greatest(coalesce(p_ventana_segundos, 1800), 60);
begin
  if p_referencia is null or char_length(btrim(p_referencia)) = 0 or char_length(p_referencia) > 200 then
    raise exception using errcode = 'P0001', message = 'DATOS_INVALIDOS';
  end if;

  delete from public.push_envios
  where registrado_en < now() - make_interval(secs => v_ventana);

  if exists (
    select 1 from public.push_envios e
    where e.referencia = p_referencia
      and e.registrado_en > now() - make_interval(secs => v_ventana)
  ) then
    return false;
  end if;

  insert into public.push_envios (referencia, registrado_en)
  values (p_referencia, now())
  on conflict (referencia) do update set registrado_en = now();
  return true;
end;
$$;

revoke all on function public.push_guardar_suscripcion(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.push_borrar_suscripcion(uuid, text) from public, anon, authenticated;
revoke all on function public.push_obtener_suscripciones(uuid) from public, anon, authenticated;
revoke all on function public.push_marcar_uso(uuid[]) from public, anon, authenticated;
revoke all on function public.push_tiene_suscripcion(uuid) from public, anon, authenticated;
revoke all on function public.push_registrar_envio(text, integer) from public, anon, authenticated;

grant execute on function public.push_guardar_suscripcion(uuid, text, text, text) to service_role;
grant execute on function public.push_borrar_suscripcion(uuid, text) to service_role;
grant execute on function public.push_obtener_suscripciones(uuid) to service_role;
grant execute on function public.push_marcar_uso(uuid[]) to service_role;
grant execute on function public.push_tiene_suscripcion(uuid) to service_role;
grant execute on function public.push_registrar_envio(text, integer) to service_role;
