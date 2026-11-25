-- 100_biblioteca.sql
-- Biblioteca institucional: documentos privados, categorías y contador de descargas.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
  categoria text not null check (categoria in (
    'manuales', 'protocolos', 'formularios', 'capacitacion'
  )),
  descripcion text not null default '' check (char_length(descripcion) <= 1000),
  archivo_path text not null unique check (char_length(archivo_path) between 1 and 400),
  tamano bigint not null check (tamano > 0 and tamano <= 20971520),
  tipo_mime text not null check (tipo_mime in (
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )),
  subido_por uuid not null,
  creado_en timestamptz not null default now(),
  descargas integer not null default 0 check (descargas >= 0),
  constraint documentos_subido_por_fkey
    foreign key (subido_por) references public.bomberos(id)
);

create index if not exists idx_documentos_creado_en
  on public.documentos (creado_en desc);
create index if not exists idx_documentos_categoria
  on public.documentos (categoria);
create index if not exists idx_documentos_subido_por
  on public.documentos (subido_por);

alter table public.documentos enable row level security;

-- Sin policies: la biblioteca es privada. Lectura/escritura solo por service_role.
revoke all on table public.documentos from public, anon, authenticated;
grant all on table public.documentos to service_role;

-- ============================================================
-- Bucket privado de Storage
-- ============================================================

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'biblioteca',
  'biblioteca',
  false,
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================
-- RPC: registrar documento ya subido
-- ============================================================

create or replace function public.registrar_documento(
  p_bombero_id uuid,
  p_titulo text,
  p_categoria text,
  p_descripcion text,
  p_archivo_path text,
  p_tamano bigint,
  p_tipo_mime text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_titulo text;
  v_categoria text;
  v_descripcion text;
  v_path text;
  v_mime text;
begin
  if not exists (
    select 1 from public.bomberos
    where id = p_bombero_id and activo = true
  ) then
    raise exception using errcode='P0001', message='BOMBERO_INACTIVO';
  end if;

  v_titulo := btrim(coalesce(p_titulo, ''));
  if v_titulo = '' then
    raise exception using errcode='P0001', message='TITULO_REQUERIDO';
  end if;
  if char_length(v_titulo) > 200 then
    raise exception using errcode='P0001', message='TITULO_LARGO';
  end if;

  v_categoria := btrim(coalesce(p_categoria, ''));
  if v_categoria not in ('manuales', 'protocolos', 'formularios', 'capacitacion') then
    raise exception using errcode='P0001', message='CATEGORIA_INVALIDA';
  end if;

  v_descripcion := btrim(coalesce(p_descripcion, ''));
  if char_length(v_descripcion) > 1000 then
    raise exception using errcode='P0001', message='DESCRIPCION_LARGA';
  end if;

  v_path := btrim(coalesce(p_archivo_path, ''));
  if v_path = '' then
    raise exception using errcode='P0001', message='ARCHIVO_REQUERIDO';
  end if;
  if position('..' in v_path) > 0
     or v_path not like (p_bombero_id::text || '/%') then
    raise exception using errcode='P0001', message='ARCHIVO_INVALIDO';
  end if;

  v_mime := btrim(coalesce(p_tipo_mime, ''));
  if v_mime not in (
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) then
    raise exception using errcode='P0001', message='TIPO_INVALIDO';
  end if;

  if p_tamano is null or p_tamano <= 0 or p_tamano > 20971520 then
    raise exception using errcode='P0001', message='TAMANO_INVALIDO';
  end if;

  if exists (
    select 1 from public.documentos where archivo_path = v_path
  ) then
    raise exception using errcode='P0001', message='ARCHIVO_DUPLICADO';
  end if;

  insert into public.documentos (
    titulo, categoria, descripcion, archivo_path, tamano, tipo_mime, subido_por
  ) values (
    v_titulo, v_categoria, v_descripcion, v_path, p_tamano, v_mime, p_bombero_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.registrar_documento(uuid, text, text, text, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.registrar_documento(uuid, text, text, text, text, bigint, text)
  to service_role;

-- ============================================================
-- RPC: borrar documento (autor u oficial)
-- Devuelve el path del archivo para borrarlo de Storage.
-- ============================================================

create or replace function public.borrar_documento(
  p_bombero_id uuid,
  p_documento_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
  v_subido_por uuid;
begin
  if not exists (
    select 1 from public.bomberos
    where id = p_bombero_id and activo = true
  ) then
    raise exception using errcode='P0001', message='BOMBERO_INACTIVO';
  end if;

  select archivo_path, subido_por
    into v_path, v_subido_por
    from public.documentos
    where id = p_documento_id;

  if not found then
    raise exception using errcode='P0001', message='DOCUMENTO_NO_ENCONTRADO';
  end if;

  if v_subido_por <> p_bombero_id
     and not public._chequeo_es_oficial(p_bombero_id) then
    raise exception using errcode='P0001', message='SIN_PERMISO';
  end if;

  delete from public.documentos where id = p_documento_id;

  return v_path;
end;
$$;

revoke all on function public.borrar_documento(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.borrar_documento(uuid, uuid)
  to service_role;

-- ============================================================
-- RPC: contador de descargas
-- ============================================================

create or replace function public.registrar_descarga_documento(
  p_documento_id uuid
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_descargas integer;
begin
  update public.documentos
    set descargas = descargas + 1
    where id = p_documento_id
    returning descargas into v_descargas;

  if not found then
    raise exception using errcode='P0001', message='DOCUMENTO_NO_ENCONTRADO';
  end if;

  return v_descargas;
end;
$$;

revoke all on function public.registrar_descarga_documento(uuid)
  from public, anon, authenticated;
grant execute on function public.registrar_descarga_documento(uuid)
  to service_role;
