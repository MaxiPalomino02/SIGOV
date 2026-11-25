-- 020_tareas.sql
-- Módulo de tareas del cuartel.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.

-- ------------------------------------------------------------
-- Tabla: tareas
-- ------------------------------------------------------------
create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  asignada_a uuid references public.bomberos(id) on delete set null,
  creada_por uuid not null references public.bomberos(id),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'hecha')),
  completada_por uuid references public.bomberos(id),
  completada_en timestamptz,
  creada_en timestamptz not null default now()
);

create index if not exists idx_tareas_estado_creada on public.tareas (estado, creada_en desc);
create index if not exists idx_tareas_asignada_a on public.tareas (asignada_a);
create index if not exists idx_tareas_creada_por on public.tareas (creada_por);

-- RLS: lectura para anon y authenticated (datos no sensibles operativos).
alter table public.tareas enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'tareas' and policyname = 'tareas_select_publico'
  ) then
    create policy tareas_select_publico on public.tareas
      for select to anon, authenticated using (true);
  end if;
end $$;

revoke all on table public.tareas from public, anon, authenticated;
grant select on table public.tareas to anon, authenticated;
grant all on table public.tareas to service_role;

-- Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tareas'
  ) then
    alter publication supabase_realtime add table public.tareas;
  end if;
end $$;

-- ------------------------------------------------------------
-- Helpers internos
-- ------------------------------------------------------------
create or replace function public.tarea_franja_actual(p_ts timestamptz default now())
returns table(fecha date, franja text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_local timestamp;
  v_hora integer;
  v_fecha date;
begin
  v_local := timezone('America/Argentina/Tucuman', p_ts);
  v_hora := extract(hour from v_local)::integer;
  v_fecha := v_local::date;

  if v_hora >= 23 then
    fecha := v_fecha; franja := '23:00-08:00';
  elsif v_hora < 8 then
    fecha := v_fecha - 1; franja := '23:00-08:00';
  elsif v_hora < 13 then
    fecha := v_fecha; franja := '08:00-13:00';
  elsif v_hora < 18 then
    fecha := v_fecha; franja := '13:00-18:00';
  else
    fecha := v_fecha; franja := '18:00-23:00';
  end if;
  return next;
end;
$$;

create or replace function public.bombero_de_guardia_ahora(p_bombero_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.turnos t
    join public.tarea_franja_actual(now()) fa on fa.fecha = t.fecha and fa.franja = t.franja
    where t.bombero_id = p_bombero_id
  );
$$;

-- ------------------------------------------------------------
-- RPC: crear_tarea
-- ------------------------------------------------------------
create or replace function public.crear_tarea(
  p_actor_id uuid,
  p_titulo text,
  p_descripcion text default null,
  p_asignada_a uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_id uuid;
  v_titulo text;
begin
  select id, cargo, activo into v_actor from public.bomberos where id = p_actor_id and activo = true;
  if not found then
    raise exception using errcode = 'P0001', message = 'BOMBERO_INACTIVO';
  end if;
  if v_actor.cargo not in ('Oficial Principal', 'Oficial Ayudante') then
    raise exception using errcode = 'P0001', message = 'SIN_PERMISO';
  end if;

  v_titulo := btrim(coalesce(p_titulo, ''));
  if v_titulo = '' then
    raise exception using errcode = 'P0001', message = 'TITULO_REQUERIDO';
  end if;

  if p_asignada_a is not null then
    if not exists (select 1 from public.bomberos where id = p_asignada_a and activo = true) then
      raise exception using errcode = 'P0001', message = 'ASIGNADO_INVALIDO';
    end if;
  end if;

  insert into public.tareas (titulo, descripcion, asignada_a, creada_por)
  values (v_titulo, nullif(btrim(coalesce(p_descripcion, '')), ''), p_asignada_a, p_actor_id)
  returning id into v_id;

  return v_id;
end;
$$;

-- ------------------------------------------------------------
-- RPC: editar_tarea
-- ------------------------------------------------------------
create or replace function public.editar_tarea(
  p_actor_id uuid,
  p_tarea_id uuid,
  p_titulo text,
  p_descripcion text default null,
  p_asignada_a uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_titulo text;
begin
  select id, cargo, activo into v_actor from public.bomberos where id = p_actor_id and activo = true;
  if not found then raise exception using errcode = 'P0001', message = 'BOMBERO_INACTIVO'; end if;
  if v_actor.cargo not in ('Oficial Principal', 'Oficial Ayudante') then
    raise exception using errcode = 'P0001', message = 'SIN_PERMISO';
  end if;

  v_titulo := btrim(coalesce(p_titulo, ''));
  if v_titulo = '' then raise exception using errcode = 'P0001', message = 'TITULO_REQUERIDO'; end if;

  if p_asignada_a is not null and not exists (select 1 from public.bomberos where id = p_asignada_a and activo = true) then
    raise exception using errcode = 'P0001', message = 'ASIGNADO_INVALIDO';
  end if;

  update public.tareas
  set titulo = v_titulo,
      descripcion = nullif(btrim(coalesce(p_descripcion, '')), ''),
      asignada_a = p_asignada_a
  where id = p_tarea_id;

  if not found then raise exception using errcode = 'P0001', message = 'TAREA_NO_ENCONTRADA'; end if;
end;
$$;

-- ------------------------------------------------------------
-- RPC: borrar_tarea
-- ------------------------------------------------------------
create or replace function public.borrar_tarea(
  p_actor_id uuid,
  p_tarea_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
begin
  select id, cargo, activo into v_actor from public.bomberos where id = p_actor_id and activo = true;
  if not found then raise exception using errcode = 'P0001', message = 'BOMBERO_INACTIVO'; end if;
  if v_actor.cargo not in ('Oficial Principal', 'Oficial Ayudante') then
    raise exception using errcode = 'P0001', message = 'SIN_PERMISO';
  end if;

  delete from public.tareas where id = p_tarea_id;
  if not found then raise exception using errcode = 'P0001', message = 'TAREA_NO_ENCONTRADA'; end if;
end;
$$;

-- ------------------------------------------------------------
-- RPC: marcar_tarea
-- ------------------------------------------------------------
create or replace function public.marcar_tarea(
  p_actor_id uuid,
  p_tarea_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_tarea record;
  v_es_oficial boolean;
  v_de_guardia boolean;
  v_puede boolean := false;
begin
  select id, cargo, activo into v_actor from public.bomberos where id = p_actor_id and activo = true;
  if not found then raise exception using errcode = 'P0001', message = 'BOMBERO_INACTIVO'; end if;

  select id, estado, asignada_a into v_tarea from public.tareas where id = p_tarea_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'TAREA_NO_ENCONTRADA'; end if;

  if v_tarea.estado <> 'pendiente' then
    raise exception using errcode = 'P0001', message = 'TAREA_YA_HECHA';
  end if;

  v_es_oficial := v_actor.cargo in ('Oficial Principal', 'Oficial Ayudante');
  v_de_guardia := public.bombero_de_guardia_ahora(p_actor_id);

  if v_es_oficial then
    v_puede := true;
  elsif v_tarea.asignada_a is null then
    v_puede := v_de_guardia;
  else
    v_puede := (v_tarea.asignada_a = p_actor_id) or v_de_guardia;
  end if;

  if not v_puede then
    raise exception using errcode = 'P0001', message = 'SIN_PERMISO_MARCAR';
  end if;

  update public.tareas
  set estado = 'hecha',
      completada_por = p_actor_id,
      completada_en = now()
  where id = p_tarea_id and estado = 'pendiente';

  if not found then
    raise exception using errcode = 'P0001', message = 'TAREA_YA_HECHA';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- RPC: desmarcar_tarea
-- ------------------------------------------------------------
create or replace function public.desmarcar_tarea(
  p_actor_id uuid,
  p_tarea_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_tarea record;
  v_es_oficial boolean;
begin
  select id, cargo, activo into v_actor from public.bomberos where id = p_actor_id and activo = true;
  if not found then raise exception using errcode = 'P0001', message = 'BOMBERO_INACTIVO'; end if;

  select id, estado, completada_en into v_tarea from public.tareas where id = p_tarea_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'TAREA_NO_ENCONTRADA'; end if;
  if v_tarea.estado <> 'hecha' then
    raise exception using errcode = 'P0001', message = 'TAREA_NO_HECHA';
  end if;

  v_es_oficial := v_actor.cargo in ('Oficial Principal', 'Oficial Ayudante');
  if not v_es_oficial then
    if v_tarea.completada_en is null or v_tarea.completada_en < now() - interval '10 minutes' then
      raise exception using errcode = 'P0001', message = 'DESMARCAR_VENCIDO';
    end if;
  end if;

  update public.tareas
  set estado = 'pendiente',
      completada_por = null,
      completada_en = null
  where id = p_tarea_id and estado = 'hecha';
end;
$$;

-- ------------------------------------------------------------
-- Privilegios
-- ------------------------------------------------------------
revoke all on function public.tarea_franja_actual(timestamptz) from public, anon, authenticated;
revoke all on function public.bombero_de_guardia_ahora(uuid) from public, anon, authenticated;
revoke all on function public.crear_tarea(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.editar_tarea(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.borrar_tarea(uuid, uuid) from public, anon, authenticated;
revoke all on function public.marcar_tarea(uuid, uuid) from public, anon, authenticated;
revoke all on function public.desmarcar_tarea(uuid, uuid) from public, anon, authenticated;

grant execute on function public.tarea_franja_actual(timestamptz) to service_role;
grant execute on function public.bombero_de_guardia_ahora(uuid) to service_role;
grant execute on function public.crear_tarea(uuid, text, text, uuid) to service_role;
grant execute on function public.editar_tarea(uuid, uuid, text, text, uuid) to service_role;
grant execute on function public.borrar_tarea(uuid, uuid) to service_role;
grant execute on function public.marcar_tarea(uuid, uuid) to service_role;
grant execute on function public.desmarcar_tarea(uuid, uuid) to service_role;
