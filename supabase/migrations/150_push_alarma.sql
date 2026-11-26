alter table public.alarmas add column if not exists mensaje text;
alter table public.alarmas add column if not exists cantidad_enviados integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public'
      and c.conrelid = 'public.alarmas'::regclass
      and c.conname = 'alarmas_cantidad_enviados_no_negativo'
  ) then
    alter table public.alarmas
      add constraint alarmas_cantidad_enviados_no_negativo check (cantidad_enviados >= 0);
  end if;
end $$;

create or replace function public.push_renovar_suscripcion(
  p_bombero_id uuid,
  p_endpoint_anterior text,
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
     or not exists (select 1 from public.bomberos where id = p_bombero_id and activo = true)
     or p_endpoint is null or char_length(btrim(p_endpoint)) = 0 or char_length(p_endpoint) > 2048
     or p_p256dh is null or char_length(btrim(p_p256dh)) = 0 or char_length(p_p256dh) > 512
     or p_auth is null or char_length(btrim(p_auth)) = 0 or char_length(p_auth) > 256 then
    raise exception using errcode = 'P0001', message = 'DATOS_INVALIDOS';
  end if;

  if p_endpoint_anterior is not null and btrim(p_endpoint_anterior) <> '' then
    delete from public.push_suscripciones
    where bombero_id = p_bombero_id
      and endpoint = p_endpoint_anterior
      and endpoint <> p_endpoint;
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

create or replace function public.alarma_registrar_envio(
  p_alarma_id uuid,
  p_mensaje text,
  p_cantidad integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_alarma_id is null or p_cantidad is null or p_cantidad < 0 then
    raise exception using errcode = 'P0001', message = 'DATOS_INVALIDOS';
  end if;

  update public.alarmas
  set mensaje = left(btrim(coalesce(p_mensaje, '')), 500),
      cantidad_enviados = least(p_cantidad, 100000)
  where id = p_alarma_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'ALARMA_NO_ENCONTRADA';
  end if;
end;
$$;

revoke all on function public.push_renovar_suscripcion(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.alarma_registrar_envio(uuid, text, integer) from public, anon, authenticated;

grant execute on function public.push_renovar_suscripcion(uuid, text, text, text, text) to service_role;
grant execute on function public.alarma_registrar_envio(uuid, text, integer) to service_role;
