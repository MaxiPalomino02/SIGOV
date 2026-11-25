-- 050_alertas.sql
-- Alertas meteorológicas (SMN), hidrológicas e institucionales.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.

create table if not exists public.alertas (
  id uuid primary key default gen_random_uuid(),
  tipo_fuente text not null check (tipo_fuente in ('meteorologica', 'hidrologica', 'institucional')),
  id_externo text,
  nivel text not null check (nivel in ('informativa', 'amarilla', 'naranja', 'roja')),
  fenomeno text not null default '',
  titulo text not null default '',
  descripcion text not null default '',
  area text not null default '',
  area_geojson jsonb,
  desde timestamptz,
  hasta timestamptz,
  fuente_nombre text not null default '',
  fuente_url text,
  origen text not null check (origen in ('automatico', 'manual')),
  creada_por uuid references public.bomberos(id),
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  ultima_verificacion timestamptz not null default now(),
  estado text not null default 'vigente' check (estado in ('vigente', 'vencida', 'cancelada'))
);

create unique index if not exists idx_alertas_fuente_externo
  on public.alertas (fuente_nombre, id_externo)
  where id_externo is not null;

create index if not exists idx_alertas_estado_hasta on public.alertas (estado, hasta desc);
create index if not exists idx_alertas_tipo on public.alertas (tipo_fuente);

alter table public.alertas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='alertas' and policyname='alertas_select_publico') then
    create policy alertas_select_publico on public.alertas for select to anon, authenticated using (true);
  end if;
end $$;

revoke all on table public.alertas from public, anon, authenticated;
grant select on table public.alertas to anon, authenticated;
grant all on table public.alertas to service_role;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='alertas') then
    alter publication supabase_realtime add table public.alertas;
  end if;
end $$;

-- Estado de consulta de fuentes (para "última actualización" / distinguir fallo)
create table if not exists public.alertas_fuentes_estado (
  fuente text primary key,
  ultima_verificacion timestamptz,
  ultimo_ok timestamptz,
  ultimo_error text,
  actualizada_en timestamptz not null default now()
);

alter table public.alertas_fuentes_estado enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='alertas_fuentes_estado' and policyname='alertas_fuentes_estado_select_publico') then
    create policy alertas_fuentes_estado_select_publico on public.alertas_fuentes_estado for select to anon, authenticated using (true);
  end if;
end $$;
revoke all on table public.alertas_fuentes_estado from public, anon, authenticated;
grant select on table public.alertas_fuentes_estado to anon, authenticated;
grant all on table public.alertas_fuentes_estado to service_role;

-- Helper interno: valida oficial
create or replace function public._alertas_es_oficial(p_bombero_id uuid)
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

-- Upsert de alerta automática (SMN). Actualiza si existe (fuente_nombre,id_externo).
create or replace function public.upsert_alerta(
  p_tipo_fuente text,
  p_id_externo text,
  p_nivel text,
  p_fenomeno text,
  p_titulo text,
  p_descripcion text,
  p_area text,
  p_area_geojson jsonb,
  p_desde timestamptz,
  p_hasta timestamptz,
  p_fuente_nombre text,
  p_fuente_url text,
  p_estado text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.alertas (
    tipo_fuente, id_externo, nivel, fenomeno, titulo, descripcion, area, area_geojson,
    desde, hasta, fuente_nombre, fuente_url, origen, creada_por, creada_en, actualizada_en, ultima_verificacion, estado
  ) values (
    p_tipo_fuente, p_id_externo, p_nivel, coalesce(p_fenomeno,''), coalesce(p_titulo,''), coalesce(p_descripcion,''),
    coalesce(p_area,''), p_area_geojson, p_desde, p_hasta, p_fuente_nombre, p_fuente_url, 'automatico', null,
    now(), now(), now(), coalesce(p_estado,'vigente')
  )
  on conflict (fuente_nombre, id_externo) where id_externo is not null
  do update set
    tipo_fuente = excluded.tipo_fuente,
    nivel = excluded.nivel,
    fenomeno = excluded.fenomeno,
    titulo = excluded.titulo,
    descripcion = excluded.descripcion,
    area = excluded.area,
    area_geojson = excluded.area_geojson,
    desde = excluded.desde,
    hasta = excluded.hasta,
    fuente_url = excluded.fuente_url,
    actualizada_en = now(),
    ultima_verificacion = now(),
    estado = excluded.estado
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.crear_alerta_manual(
  p_bombero_id uuid,
  p_tipo_fuente text,
  p_nivel text,
  p_fenomeno text,
  p_titulo text,
  p_descripcion text,
  p_area text,
  p_desde timestamptz,
  p_hasta timestamptz,
  p_fuente_nombre text,
  p_fuente_url text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not public._alertas_es_oficial(p_bombero_id) then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;
  if p_tipo_fuente not in ('meteorologica','hidrologica','institucional') then
    raise exception using errcode='P0001', message='TIPO_INVALIDO';
  end if;
  if p_nivel not in ('informativa','amarilla','naranja','roja') then
    raise exception using errcode='P0001', message='NIVEL_INVALIDO';
  end if;
  if btrim(coalesce(p_titulo,'')) = '' then
    raise exception using errcode='P0001', message='TITULO_REQUERIDO';
  end if;
  if btrim(coalesce(p_fuente_nombre,'')) = '' then
    raise exception using errcode='P0001', message='FUENTE_REQUERIDA';
  end if;
  insert into public.alertas (
    tipo_fuente, id_externo, nivel, fenomeno, titulo, descripcion, area, area_geojson,
    desde, hasta, fuente_nombre, fuente_url, origen, creada_por, creada_en, actualizada_en, ultima_verificacion, estado
  ) values (
    p_tipo_fuente, null, p_nivel, btrim(coalesce(p_fenomeno,'')), btrim(p_titulo), btrim(coalesce(p_descripcion,'')),
    btrim(coalesce(p_area,'')), null, p_desde, p_hasta, btrim(p_fuente_nombre), nullif(btrim(coalesce(p_fuente_url,'')), ''),
    'manual', p_bombero_id, now(), now(), now(),
    case when p_hasta is not null and p_hasta <= now() then 'vencida' else 'vigente' end
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.cerrar_alerta(p_bombero_id uuid, p_alerta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._alertas_es_oficial(p_bombero_id) then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;
  update public.alertas set estado = 'vencida', actualizada_en = now() where id = p_alerta_id;
  if not found then raise exception using errcode='P0001', message='ALERTA_NO_ENCONTRADA'; end if;
end;
$$;

create or replace function public.cancelar_alerta(p_bombero_id uuid, p_alerta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._alertas_es_oficial(p_bombero_id) then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;
  update public.alertas set estado = 'cancelada', actualizada_en = now() where id = p_alerta_id;
  if not found then raise exception using errcode='P0001', message='ALERTA_NO_ENCONTRADA'; end if;
end;
$$;

create or replace function public.registrar_estado_fuente_alertas(
  p_fuente text,
  p_ok boolean,
  p_error text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.alertas_fuentes_estado (fuente, ultima_verificacion, ultimo_ok, ultimo_error, actualizada_en)
  values (p_fuente, now(), case when p_ok then now() else null end, case when p_ok then null else p_error end, now())
  on conflict (fuente) do update set
    ultima_verificacion = now(),
    ultimo_ok = case when p_ok then now() else public.alertas_fuentes_estado.ultimo_ok end,
    ultimo_error = case when p_ok then null else coalesce(p_error, public.alertas_fuentes_estado.ultimo_error) end,
    actualizada_en = now();
end;
$$;

create or replace function public.marcar_alertas_vencidas()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.alertas
  set estado = 'vencida', actualizada_en = now()
  where estado = 'vigente' and hasta is not null and hasta <= now();
end;
$$;

create or replace function public.cancelar_alerta_por_id_externo(p_fuente_nombre text, p_id_externo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  update public.alertas
  set estado = 'cancelada', actualizada_en = now(), ultima_verificacion = now()
  where fuente_nombre = p_fuente_nombre and id_externo = p_id_externo and estado = 'vigente'
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public._alertas_es_oficial(uuid) from public, anon, authenticated;
revoke all on function public.upsert_alerta(text,text,text,text,text,text,text,jsonb,timestamptz,timestamptz,text,text,text) from public, anon, authenticated;
revoke all on function public.crear_alerta_manual(uuid,text,text,text,text,text,text,timestamptz,timestamptz,text,text) from public, anon, authenticated;
revoke all on function public.cerrar_alerta(uuid,uuid) from public, anon, authenticated;
revoke all on function public.cancelar_alerta(uuid,uuid) from public, anon, authenticated;
revoke all on function public.registrar_estado_fuente_alertas(text,boolean,text) from public, anon, authenticated;
revoke all on function public.marcar_alertas_vencidas() from public, anon, authenticated;
revoke all on function public.cancelar_alerta_por_id_externo(text,text) from public, anon, authenticated;

grant execute on function public.upsert_alerta(text,text,text,text,text,text,text,jsonb,timestamptz,timestamptz,text,text,text) to service_role;
grant execute on function public.crear_alerta_manual(uuid,text,text,text,text,text,text,timestamptz,timestamptz,text,text) to service_role;
grant execute on function public.cerrar_alerta(uuid,uuid) to service_role;
grant execute on function public.cancelar_alerta(uuid,uuid) to service_role;
grant execute on function public.registrar_estado_fuente_alertas(text,boolean,text) to service_role;
grant execute on function public.marcar_alertas_vencidas() to service_role;
grant execute on function public.cancelar_alerta_por_id_externo(text,text) to service_role;
