-- 051_alertas_ingesta_log.sql
-- Registro de cadencia/ingesta de alertas SMN.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.

create table if not exists public.alertas_ingesta_log (
  id uuid primary key default gen_random_uuid(),
  fecha_consulta timestamptz not null default now(),
  items_feed integer not null default 0,
  cap_nuevos integer not null default 0,
  detalle jsonb not null default '[]'::jsonb
);

create index if not exists idx_alertas_ingesta_log_fecha
  on public.alertas_ingesta_log (fecha_consulta desc);

alter table public.alertas_ingesta_log enable row level security;

-- Sin políticas de select: anon/authenticated no pueden leer.
revoke all on table public.alertas_ingesta_log from public, anon, authenticated;
grant all on table public.alertas_ingesta_log to service_role;

create or replace function public.registrar_ingesta_alertas(
  p_fecha_consulta timestamptz,
  p_items_feed integer,
  p_cap_nuevos integer,
  p_detalle jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.alertas_ingesta_log (fecha_consulta, items_feed, cap_nuevos, detalle)
  values (
    coalesce(p_fecha_consulta, now()),
    coalesce(p_items_feed, 0),
    coalesce(p_cap_nuevos, 0),
    coalesce(p_detalle, '[]'::jsonb)
  );

  -- limpieza de registros de más de 30 días
  delete from public.alertas_ingesta_log
  where fecha_consulta < now() - interval '30 days';
end;
$$;

revoke all on function public.registrar_ingesta_alertas(timestamptz,integer,integer,jsonb) from public, anon, authenticated;
grant execute on function public.registrar_ingesta_alertas(timestamptz,integer,integer,jsonb) to service_role;
