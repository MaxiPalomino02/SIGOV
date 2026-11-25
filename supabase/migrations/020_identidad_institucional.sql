-- ============================================================
-- 020 · Identidad institucional
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- El nombre del cuartel y su ubicación dejan de estar
-- hardcodeados en los componentes compartidos.
-- ============================================================

create table if not exists public.institucion (
  id            boolean primary key default true check (id = true),
  nombre_cuartel text not null,
  localidad      text not null,
  provincia      text not null,
  actualizado_en timestamptz not null default now()
);

insert into public.institucion (id, nombre_cuartel, localidad, provincia)
values (true, 'Bomberos Voluntarios La Trinidad', 'La Trinidad', 'Tucumán')
on conflict (id) do nothing;

alter table public.institucion enable row level security;

-- Lectura pública: es información de marca, no sensible.
revoke all on table public.institucion from anon, authenticated;
grant select on table public.institucion to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'institucion'
      and policyname = 'institucion_select_anon'
  ) then
    create policy "institucion_select_anon"
      on public.institucion
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'institucion'
      and policyname = 'institucion_select_authenticated'
  ) then
    create policy "institucion_select_authenticated"
      on public.institucion
      for select
      to authenticated
      using (true);
  end if;
end
$$;

comment on table public.institucion is
  'Configuración institucional de la instalación SIGOV: cuartel, localidad y provincia.';
