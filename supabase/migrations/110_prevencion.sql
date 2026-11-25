-- 110_prevencion.sql
-- Prevención: actividades institucionales y conteo mensual para Reportes.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.

create table if not exists public.prevencion_actividades (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('charla', 'inspeccion', 'simulacro', 'otra')),
  fecha date not null,
  lugar text not null check (char_length(btrim(lugar)) between 1 and 200),
  responsable_id uuid references public.bomberos(id),
  participantes text not null default '' check (char_length(participantes) <= 1000),
  descripcion text not null default '' check (char_length(descripcion) <= 2000),
  fotos text[] not null default '{}',
  creado_por uuid not null references public.bomberos(id),
  creado_en timestamptz not null default now()
);

create index if not exists idx_prevencion_actividades_fecha
  on public.prevencion_actividades (fecha desc);
create index if not exists idx_prevencion_actividades_tipo
  on public.prevencion_actividades (tipo);
create index if not exists idx_prevencion_actividades_creado_por
  on public.prevencion_actividades (creado_por);

alter table public.prevencion_actividades enable row level security;

-- Sin policies: es un registro interno. Lectura y escritura solo por service_role.
revoke all on table public.prevencion_actividades from public, anon, authenticated;
grant all on table public.prevencion_actividades to service_role;

-- ============================================================
-- RPC: registrar actividad (alta rápida)
-- ============================================================

create or replace function public.registrar_actividad_prevencion(
  p_bombero_id uuid,
  p_tipo text,
  p_fecha date,
  p_lugar text,
  p_responsable_id uuid,
  p_participantes text,
  p_descripcion text,
  p_fotos text[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_tipo text;
  v_lugar text;
  v_participantes text;
  v_descripcion text;
  v_fotos text[];
  v_foto text;
begin
  if not exists (
    select 1 from public.bomberos
    where id = p_bombero_id and activo = true
  ) then
    raise exception using errcode='P0001', message='BOMBERO_INACTIVO';
  end if;

  v_tipo := btrim(coalesce(p_tipo, ''));
  if v_tipo not in ('charla', 'inspeccion', 'simulacro', 'otra') then
    raise exception using errcode='P0001', message='TIPO_INVALIDO';
  end if;

  if p_fecha is null then
    raise exception using errcode='P0001', message='FECHA_REQUERIDA';
  end if;

  v_lugar := btrim(coalesce(p_lugar, ''));
  if v_lugar = '' or char_length(v_lugar) > 200 then
    raise exception using errcode='P0001', message='LUGAR_INVALIDO';
  end if;

  if p_responsable_id is not null and not exists (
    select 1 from public.bomberos
    where id = p_responsable_id and activo = true
  ) then
    raise exception using errcode='P0001', message='RESPONSABLE_INVALIDO';
  end if;

  v_participantes := btrim(coalesce(p_participantes, ''));
  if char_length(v_participantes) > 1000 then
    raise exception using errcode='P0001', message='PARTICIPANTES_LARGOS';
  end if;

  v_descripcion := btrim(coalesce(p_descripcion, ''));
  if char_length(v_descripcion) > 2000 then
    raise exception using errcode='P0001', message='DESCRIPCION_LARGA';
  end if;

  v_fotos := coalesce(p_fotos, '{}'::text[]);
  if cardinality(v_fotos) > 6 then
    raise exception using errcode='P0001', message='FOTOS_INVALIDAS';
  end if;
  foreach v_foto in array v_fotos loop
    v_foto := btrim(v_foto);
    if v_foto = '' or char_length(v_foto) > 400
       or (v_foto not like 'http://%' and v_foto not like 'https://%' and v_foto not like '/%') then
      raise exception using errcode='P0001', message='FOTOS_INVALIDAS';
    end if;
  end loop;

  insert into public.prevencion_actividades (
    tipo, fecha, lugar, responsable_id, participantes, descripcion, fotos, creado_por
  ) values (
    v_tipo, p_fecha, v_lugar, p_responsable_id, v_participantes, v_descripcion, v_fotos, p_bombero_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.registrar_actividad_prevencion(uuid, text, date, text, uuid, text, text, text[])
  from public, anon, authenticated;
grant execute on function public.registrar_actividad_prevencion(uuid, text, date, text, uuid, text, text, text[])
  to service_role;

-- ============================================================
-- Vista: conteo mensual para Reportes (solo service_role)
-- ============================================================

create or replace view public.prevencion_conteo_mensual as
select
  to_char(date_trunc('month', fecha), 'YYYY-MM') as mes,
  count(*)::bigint as total,
  count(*) filter (where tipo = 'charla')::bigint as charlas,
  count(*) filter (where tipo = 'inspeccion')::bigint as inspecciones,
  count(*) filter (where tipo = 'simulacro')::bigint as simulacros,
  count(*) filter (where tipo = 'otra')::bigint as otras
from public.prevencion_actividades
group by date_trunc('month', fecha)
order by 1 desc;

revoke all on public.prevencion_conteo_mensual from public, anon, authenticated;
grant select on public.prevencion_conteo_mensual to service_role;
