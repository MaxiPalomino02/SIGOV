-- 040_alarmas.sql
-- Sistema de alarmas del cuartel.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.

-- ------------------------------------------------------------
-- Tablas
-- ------------------------------------------------------------
create table if not exists public.alarmas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in (
    'incendio_estructural',
    'incendio_forestal',
    'rescate_vehicular',
    'rescate',
    'enjambre_abejas',
    'inundacion',
    'convocatoria_general',
    'simulacro'
  )),
  detalle text,
  es_simulacro boolean not null default false,
  activada_por uuid not null references public.bomberos(id),
  activada_en timestamptz not null default now(),
  activa boolean not null default true,
  cerrada_por uuid references public.bomberos(id),
  cerrada_en timestamptz
);

create index if not exists idx_alarmas_activa on public.alarmas (activa) where activa = true;
create index if not exists idx_alarmas_activada_en on public.alarmas (activada_en desc);

create table if not exists public.alarma_respuestas (
  alarma_id uuid not null references public.alarmas(id) on delete cascade,
  bombero_id uuid not null references public.bomberos(id) on delete cascade,
  respuesta text not null check (respuesta in ('recibido', 'voy', 'no_puedo')),
  respondido_en timestamptz not null default now(),
  primary key (alarma_id, bombero_id)
);

create index if not exists idx_alarma_respuestas_alarma on public.alarma_respuestas (alarma_id);

-- ------------------------------------------------------------
-- RLS: lectura anon y authenticated
-- ------------------------------------------------------------
alter table public.alarmas enable row level security;
alter table public.alarma_respuestas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='alarmas' and policyname='alarmas_select_publico') then
    create policy alarmas_select_publico on public.alarmas for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='alarma_respuestas' and policyname='alarma_respuestas_select_publico') then
    create policy alarma_respuestas_select_publico on public.alarma_respuestas for select to anon, authenticated using (true);
  end if;
end $$;

revoke all on table public.alarmas from public, anon, authenticated;
revoke all on table public.alarma_respuestas from public, anon, authenticated;
grant select on table public.alarmas to anon, authenticated;
grant select on table public.alarma_respuestas to anon, authenticated;
grant all on table public.alarmas to service_role;
grant all on table public.alarma_respuestas to service_role;

-- ------------------------------------------------------------
-- Realtime
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='alarmas') then
    alter publication supabase_realtime add table public.alarmas;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='alarma_respuestas') then
    alter publication supabase_realtime add table public.alarma_respuestas;
  end if;
end $$;

-- ------------------------------------------------------------
-- Helpers / RPCs
-- ------------------------------------------------------------
create or replace function public.cerrar_alarmas_expiradas()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.alarmas
  set activa = false,
      cerrada_en = coalesce(cerrada_en, now())
  where activa = true
    and activada_en < now() - interval '6 hours';
end;
$$;

create or replace function public.activar_alarma(
  p_bombero_id uuid,
  p_tipo text,
  p_detalle text default null,
  p_es_simulacro boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_id uuid;
  v_tipo text;
begin
  select id, cargo, activo into v_actor from public.bomberos where id = p_bombero_id and activo = true;
  if not found then raise exception using errcode='P0001', message='BOMBERO_INACTIVO'; end if;
  if v_actor.cargo not in ('Oficial Principal','Oficial Ayudante') then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;

  v_tipo := btrim(coalesce(p_tipo,''));
  if v_tipo not in ('incendio_estructural','incendio_forestal','rescate_vehicular','rescate','enjambre_abejas','inundacion','convocatoria_general','simulacro') then
    raise exception using errcode='P0001', message='TIPO_INVALIDO';
  end if;

  perform public.cerrar_alarmas_expiradas();

  if exists (select 1 from public.alarmas where activa = true) then
    raise exception using errcode='P0001', message='ALARMA_YA_ACTIVA';
  end if;

  insert into public.alarmas (tipo, detalle, es_simulacro, activada_por, activa)
  values (v_tipo, nullif(btrim(coalesce(p_detalle,'')), ''), coalesce(p_es_simulacro,false), p_bombero_id, true)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.cerrar_alarma(
  p_bombero_id uuid,
  p_alarma_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_actor record;
begin
  select id, cargo, activo into v_actor from public.bomberos where id = p_bombero_id and activo = true;
  if not found then raise exception using errcode='P0001', message='BOMBERO_INACTIVO'; end if;
  if v_actor.cargo not in ('Oficial Principal','Oficial Ayudante') then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;

  perform public.cerrar_alarmas_expiradas();

  update public.alarmas
  set activa = false,
      cerrada_por = p_bombero_id,
      cerrada_en = now()
  where id = p_alarma_id and activa = true;

  if not found then
    raise exception using errcode='P0001', message='ALARMA_NO_ACTIVA';
  end if;
end;
$$;

create or replace function public.responder_alarma(
  p_bombero_id uuid,
  p_alarma_id uuid,
  p_respuesta text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_resp text;
begin
  if not exists (select 1 from public.bomberos where id = p_bombero_id and activo = true) then
    raise exception using errcode='P0001', message='BOMBERO_INACTIVO';
  end if;
  if not exists (select 1 from public.alarmas where id = p_alarma_id and activa = true) then
    raise exception using errcode='P0001', message='ALARMA_NO_ACTIVA';
  end if;
  v_resp := btrim(coalesce(p_respuesta,''));
  if v_resp not in ('recibido','voy','no_puedo') then
    raise exception using errcode='P0001', message='RESPUESTA_INVALIDA';
  end if;

  insert into public.alarma_respuestas (alarma_id, bombero_id, respuesta, respondido_en)
  values (p_alarma_id, p_bombero_id, v_resp, now())
  on conflict (alarma_id, bombero_id)
  do update set respuesta = excluded.respuesta, respondido_en = excluded.respondido_en;
end;
$$;

revoke all on function public.cerrar_alarmas_expiradas() from public, anon, authenticated;
revoke all on function public.activar_alarma(uuid,text,text,boolean) from public, anon, authenticated;
revoke all on function public.cerrar_alarma(uuid,uuid) from public, anon, authenticated;
revoke all on function public.responder_alarma(uuid,uuid,text) from public, anon, authenticated;

grant execute on function public.cerrar_alarmas_expiradas() to service_role;
grant execute on function public.activar_alarma(uuid,text,text,boolean) to service_role;
grant execute on function public.cerrar_alarma(uuid,uuid) to service_role;
grant execute on function public.responder_alarma(uuid,uuid,text) to service_role;
