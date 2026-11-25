-- 090_incidentes.sql
-- Registro de incidentes con asistente y borrador.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.

create table if not exists public.incidentes (
  id uuid primary key default gen_random_uuid(),
  fecha_hora timestamptz not null default now(),
  tipo text not null check (tipo in (
    'incendio_estructural', 'forestal', 'vehicular', 'rescate',
    'abeja_enjambre', 'inundacion', 'apoyo', 'otro'
  )),
  direccion text not null default '',
  descripcion text not null default '',
  unidades text[] not null default '{}',
  personal jsonb not null default '[]'::jsonb,
  estado text not null default 'borrador' check (estado in ('borrador', 'cargado')),
  creado_por uuid not null references public.bomberos(id),
  creado_en timestamptz not null default now()
);

create index if not exists idx_incidentes_fecha on public.incidentes (fecha_hora desc);
create index if not exists idx_incidentes_estado on public.incidentes (estado);
create index if not exists idx_incidentes_creado_por on public.incidentes (creado_por);

alter table public.incidentes enable row level security;

-- Sin policies: datos sensibles. Lectura/escritura solo por service_role.

revoke all on table public.incidentes from public, anon, authenticated;
grant all on table public.incidentes to service_role;

-- ============================================================
-- RPC: guardar incidente (borrador o cargado)
-- ============================================================

create or replace function public.guardar_incidente(
  p_bombero_id uuid,
  p_incidente_id uuid,
  p_fecha_hora timestamptz,
  p_tipo text,
  p_direccion text,
  p_descripcion text,
  p_unidades text[],
  p_personal jsonb,
  p_estado text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_estado text;
  v_tipo text;
begin
  if not exists (select 1 from public.bomberos where id = p_bombero_id and activo = true) then
    raise exception using errcode='P0001', message='BOMBERO_INACTIVO';
  end if;

  v_tipo := btrim(coalesce(p_tipo, ''));
  if v_tipo not in ('incendio_estructural', 'forestal', 'vehicular', 'rescate', 'abeja_enjambre', 'inundacion', 'apoyo', 'otro') then
    raise exception using errcode='P0001', message='TIPO_INVALIDO';
  end if;

  v_estado := coalesce(nullif(btrim(p_estado), ''), 'borrador');
  if v_estado not in ('borrador', 'cargado') then
    raise exception using errcode='P0001', message='ESTADO_INVALIDO';
  end if;

  if v_estado = 'cargado' and btrim(coalesce(p_direccion, '')) = '' then
    raise exception using errcode='P0001', message='DIRECCION_REQUERIDA';
  end if;

  if p_incidente_id is null then
    insert into public.incidentes (
      fecha_hora, tipo, direccion, descripcion, unidades, personal, estado, creado_por
    ) values (
      coalesce(p_fecha_hora, now()),
      v_tipo,
      btrim(coalesce(p_direccion, '')),
      btrim(coalesce(p_descripcion, '')),
      coalesce(p_unidades, '{}'::text[]),
      coalesce(p_personal, '[]'::jsonb),
      v_estado,
      p_bombero_id
    )
    returning id into v_id;
  else
    update public.incidentes set
      fecha_hora = coalesce(p_fecha_hora, fecha_hora),
      tipo = v_tipo,
      direccion = btrim(coalesce(p_direccion, '')),
      descripcion = btrim(coalesce(p_descripcion, '')),
      unidades = coalesce(p_unidades, '{}'::text[]),
      personal = coalesce(p_personal, '[]'::jsonb),
      estado = v_estado
    where id = p_incidente_id and creado_por = p_bombero_id;

    if not found then
      raise exception using errcode='P0001', message='INCIDENTE_NO_ENCONTRADO';
    end if;
    v_id := p_incidente_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.guardar_incidente(uuid, uuid, timestamptz, text, text, text, text[], jsonb, text) from public, anon, authenticated;
grant execute on function public.guardar_incidente(uuid, uuid, timestamptz, text, text, text, text[], jsonb, text) to service_role;

