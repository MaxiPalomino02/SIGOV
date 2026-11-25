-- 030_avisos.sql
-- Módulo de avisos y convocatorias.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.

-- ------------------------------------------------------------
-- Tablas
-- ------------------------------------------------------------
create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  cuerpo text not null,
  tipo text not null default 'informativo' check (tipo in ('informativo', 'importante', 'convocatoria')),
  creado_por uuid not null references public.bomberos(id),
  fijado boolean not null default false,
  creado_en timestamptz not null default now()
);

create index if not exists idx_avisos_creado_en on public.avisos (creado_en desc);
create index if not exists idx_avisos_fijado_creado on public.avisos (fijado desc, creado_en desc);

create table if not exists public.avisos_lecturas (
  aviso_id uuid not null references public.avisos(id) on delete cascade,
  bombero_id uuid not null references public.bomberos(id) on delete cascade,
  leido_en timestamptz not null default now(),
  primary key (aviso_id, bombero_id)
);

create index if not exists idx_avisos_lecturas_bombero on public.avisos_lecturas (bombero_id);

create table if not exists public.convocatorias (
  aviso_id uuid primary key references public.avisos(id) on delete cascade,
  motivo text not null,
  fecha_hora timestamptz not null,
  lugar text not null
);

create table if not exists public.convocatoria_respuestas (
  aviso_id uuid not null references public.avisos(id) on delete cascade,
  bombero_id uuid not null references public.bomberos(id) on delete cascade,
  respuesta text not null check (respuesta in ('voy', 'no_puedo', 'en_camino')),
  respondido_en timestamptz not null default now(),
  primary key (aviso_id, bombero_id)
);

create index if not exists idx_conv_respuestas_aviso on public.convocatoria_respuestas (aviso_id);

-- ------------------------------------------------------------
-- RLS: lectura anon y authenticated
-- ------------------------------------------------------------
alter table public.avisos enable row level security;
alter table public.avisos_lecturas enable row level security;
alter table public.convocatorias enable row level security;
alter table public.convocatoria_respuestas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='avisos' and policyname='avisos_select_publico') then
    create policy avisos_select_publico on public.avisos for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='avisos_lecturas' and policyname='avisos_lecturas_select_publico') then
    create policy avisos_lecturas_select_publico on public.avisos_lecturas for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='convocatorias' and policyname='convocatorias_select_publico') then
    create policy convocatorias_select_publico on public.convocatorias for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='convocatoria_respuestas' and policyname='conv_respuestas_select_publico') then
    create policy conv_respuestas_select_publico on public.convocatoria_respuestas for select to anon, authenticated using (true);
  end if;
end $$;

revoke all on table public.avisos from public, anon, authenticated;
revoke all on table public.avisos_lecturas from public, anon, authenticated;
revoke all on table public.convocatorias from public, anon, authenticated;
revoke all on table public.convocatoria_respuestas from public, anon, authenticated;

grant select on table public.avisos to anon, authenticated;
grant select on table public.avisos_lecturas to anon, authenticated;
grant select on table public.convocatorias to anon, authenticated;
grant select on table public.convocatoria_respuestas to anon, authenticated;

grant all on table public.avisos to service_role;
grant all on table public.avisos_lecturas to service_role;
grant all on table public.convocatorias to service_role;
grant all on table public.convocatoria_respuestas to service_role;

-- ------------------------------------------------------------
-- Realtime
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='avisos') then
    alter publication supabase_realtime add table public.avisos;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='convocatoria_respuestas') then
    alter publication supabase_realtime add table public.convocatoria_respuestas;
  end if;
end $$;

-- ------------------------------------------------------------
-- RPCs
-- ------------------------------------------------------------
create or replace function public.publicar_aviso(
  p_actor_id uuid,
  p_titulo text,
  p_cuerpo text,
  p_tipo text,
  p_fijado boolean default false,
  p_motivo text default null,
  p_fecha_hora timestamptz default null,
  p_lugar text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_id uuid;
  v_titulo text;
  v_cuerpo text;
  v_tipo text;
begin
  select id, cargo, activo into v_actor from public.bomberos where id = p_actor_id and activo = true;
  if not found then raise exception using errcode='P0001', message='BOMBERO_INACTIVO'; end if;
  if v_actor.cargo not in ('Oficial Principal','Oficial Ayudante') then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;

  v_titulo := btrim(coalesce(p_titulo,''));
  v_cuerpo := btrim(coalesce(p_cuerpo,''));
  v_tipo := coalesce(nullif(btrim(p_tipo),''), 'informativo');
  if v_titulo = '' then raise exception using errcode='P0001', message='TITULO_REQUERIDO'; end if;
  if v_cuerpo = '' then raise exception using errcode='P0001', message='CUERPO_REQUERIDO'; end if;
  if v_tipo not in ('informativo','importante','convocatoria') then
    raise exception using errcode='P0001', message='TIPO_INVALIDO';
  end if;

  if v_tipo = 'convocatoria' then
    if btrim(coalesce(p_motivo,'')) = '' or p_fecha_hora is null or btrim(coalesce(p_lugar,'')) = '' then
      raise exception using errcode='P0001', message='CONVOCATORIA_INCOMPLETA';
    end if;
  end if;

  insert into public.avisos (titulo, cuerpo, tipo, creado_por, fijado)
  values (v_titulo, v_cuerpo, v_tipo, p_actor_id, coalesce(p_fijado,false))
  returning id into v_id;

  if v_tipo = 'convocatoria' then
    insert into public.convocatorias (aviso_id, motivo, fecha_hora, lugar)
    values (v_id, btrim(p_motivo), p_fecha_hora, btrim(p_lugar));
  end if;

  return v_id;
end;
$$;

create or replace function public.fijar_aviso(
  p_actor_id uuid,
  p_aviso_id uuid,
  p_fijado boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_actor record;
begin
  select id, cargo, activo into v_actor from public.bomberos where id = p_actor_id and activo = true;
  if not found then raise exception using errcode='P0001', message='BOMBERO_INACTIVO'; end if;
  if v_actor.cargo not in ('Oficial Principal','Oficial Ayudante') then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;
  update public.avisos set fijado = coalesce(p_fijado,false) where id = p_aviso_id;
  if not found then raise exception using errcode='P0001', message='AVISO_NO_ENCONTRADO'; end if;
end;
$$;

create or replace function public.borrar_aviso(
  p_actor_id uuid,
  p_aviso_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_actor record;
begin
  select id, cargo, activo into v_actor from public.bomberos where id = p_actor_id and activo = true;
  if not found then raise exception using errcode='P0001', message='BOMBERO_INACTIVO'; end if;
  if v_actor.cargo not in ('Oficial Principal','Oficial Ayudante') then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;
  delete from public.avisos where id = p_aviso_id;
  if not found then raise exception using errcode='P0001', message='AVISO_NO_ENCONTRADO'; end if;
end;
$$;

create or replace function public.marcar_leido(
  p_actor_id uuid,
  p_aviso_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.bomberos where id = p_actor_id and activo = true) then
    raise exception using errcode='P0001', message='BOMBERO_INACTIVO';
  end if;
  if not exists (select 1 from public.avisos where id = p_aviso_id) then
    raise exception using errcode='P0001', message='AVISO_NO_ENCONTRADO';
  end if;
  insert into public.avisos_lecturas (aviso_id, bombero_id, leido_en)
  values (p_aviso_id, p_actor_id, now())
  on conflict (aviso_id, bombero_id) do nothing;
end;
$$;

create or replace function public.responder_convocatoria(
  p_actor_id uuid,
  p_aviso_id uuid,
  p_respuesta text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_resp text;
begin
  if not exists (select 1 from public.bomberos where id = p_actor_id and activo = true) then
    raise exception using errcode='P0001', message='BOMBERO_INACTIVO';
  end if;
  if not exists (select 1 from public.convocatorias where aviso_id = p_aviso_id) then
    raise exception using errcode='P0001', message='CONVOCATORIA_NO_ENCONTRADA';
  end if;
  v_resp := btrim(coalesce(p_respuesta,''));
  if v_resp not in ('voy','no_puedo','en_camino') then
    raise exception using errcode='P0001', message='RESPUESTA_INVALIDA';
  end if;
  insert into public.convocatoria_respuestas (aviso_id, bombero_id, respuesta, respondido_en)
  values (p_aviso_id, p_actor_id, v_resp, now())
  on conflict (aviso_id, bombero_id)
  do update set respuesta = excluded.respuesta, respondido_en = excluded.respondido_en;
end;
$$;

revoke all on function public.publicar_aviso(uuid,text,text,text,boolean,text,timestamptz,text) from public, anon, authenticated;
revoke all on function public.fijar_aviso(uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function public.borrar_aviso(uuid,uuid) from public, anon, authenticated;
revoke all on function public.marcar_leido(uuid,uuid) from public, anon, authenticated;
revoke all on function public.responder_convocatoria(uuid,uuid,text) from public, anon, authenticated;

grant execute on function public.publicar_aviso(uuid,text,text,text,boolean,text,timestamptz,text) to service_role;
grant execute on function public.fijar_aviso(uuid,uuid,boolean) to service_role;
grant execute on function public.borrar_aviso(uuid,uuid) to service_role;
grant execute on function public.marcar_leido(uuid,uuid) to service_role;
grant execute on function public.responder_convocatoria(uuid,uuid,text) to service_role;
