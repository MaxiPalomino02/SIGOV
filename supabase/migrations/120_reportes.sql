create or replace function public.reportes_obtener(p_desde date, p_hasta date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cupo integer;
  v_resultado jsonb;
begin
  if p_desde is null or p_hasta is null or p_desde > p_hasta then
    raise exception 'Rango de fechas inválido';
  end if;

  select valor into v_cupo from public.configuracion where clave = 'cupo_maximo_turnos';
  v_cupo := coalesce(v_cupo, 5);

  with
  incidentes_local as (
    select
      (i.fecha_hora at time zone 'America/Argentina/Tucuman')::date as fecha,
      i.tipo
    from public.incidentes i
    where (i.fecha_hora at time zone 'America/Argentina/Tucuman')::date between p_desde and p_hasta
  ),
  incidentes_por_tipo as (
    select tipo, count(*)::bigint as total
    from incidentes_local
    group by tipo
  ),
  incidentes_por_mes as (
    select
      to_char(date_trunc('month', fecha), 'YYYY-MM') as mes,
      count(*)::bigint as total
    from incidentes_local
    group by date_trunc('month', fecha)
  ),
  horas_por_bombero as (
    select
      b.id as bombero_id,
      b.numero_ingreso,
      b.nombre_completo,
      b.cargo,
      sum(case when t.franja = '23:00-08:00' then 9 else 5 end)::integer as horas,
      count(*)::bigint as turnos
    from public.turnos t
    join public.bomberos b on b.id = t.bombero_id
    where t.fecha between p_desde and p_hasta
      and t.bombero_id is not null
    group by b.id, b.numero_ingreso, b.nombre_completo, b.cargo
  ),
  dias as (
    select generate_series(p_desde, p_hasta, interval '1 day')::date as fecha
  ),
  franjas as (
    select unnest(array[
      '08:00-13:00',
      '13:00-18:00',
      '18:00-23:00',
      '23:00-08:00'
    ]) as franja
  ),
  turnos_agrupados as (
    select
      fecha,
      franja,
      count(*) filter (where bombero_id is not null) as ocupadas
    from public.turnos
    where fecha between p_desde and p_hasta
    group by fecha, franja
  ),
  cobertura_franjas as (
    select
      f.franja,
      count(*)::bigint as celdas,
      coalesce(sum(ta.ocupadas), 0)::bigint as ocupadas,
      (count(*) * v_cupo)::bigint as capacidad,
      greatest((count(*) * v_cupo)::bigint - coalesce(sum(ta.ocupadas), 0)::bigint, 0)::bigint as libres,
      round(
        100.0 * coalesce(sum(ta.ocupadas), 0)::numeric / nullif((count(*) * v_cupo)::numeric, 0),
        1
      ) as porcentaje
    from dias d
    cross join franjas f
    left join turnos_agrupados ta on ta.fecha = d.fecha and ta.franja = f.franja
    group by f.franja
  ),
  chequeos_base as (
    select
      c.id as chequeo_id,
      c.fecha,
      cr.item_id,
      cr.estado
    from public.chequeos c
    left join public.chequeo_resultados cr on cr.chequeo_id = c.id
    where c.fecha between p_desde and p_hasta
  ),
  chequeos_fallas as (
    select
      to_char(date_trunc('month', fecha), 'YYYY-MM') as mes,
      count(distinct chequeo_id)::bigint as chequeos,
      count(item_id)::bigint as items,
      count(item_id) filter (where estado in ('falta', 'danado'))::bigint as fallas,
      count(distinct chequeo_id) filter (where estado in ('falta', 'danado'))::bigint as chequeos_con_fallas
    from chequeos_base
    group by date_trunc('month', fecha)
  ),
  tareas_cumplidas as (
    select
      to_char(
        date_trunc('month', (completada_en at time zone 'America/Argentina/Tucuman')),
        'YYYY-MM'
      ) as mes,
      count(*)::bigint as total
    from public.tareas
    where estado = 'hecha'
      and completada_en is not null
      and (completada_en at time zone 'America/Argentina/Tucuman')::date between p_desde and p_hasta
    group by date_trunc('month', (completada_en at time zone 'America/Argentina/Tucuman'))
  ),
  prevencion as (
    select
      to_char(date_trunc('month', fecha), 'YYYY-MM') as mes,
      count(*)::bigint as total,
      count(*) filter (where tipo = 'charla')::bigint as charlas,
      count(*) filter (where tipo = 'inspeccion')::bigint as inspecciones,
      count(*) filter (where tipo = 'simulacro')::bigint as simulacros,
      count(*) filter (where tipo = 'otra')::bigint as otras
    from public.prevencion_actividades
    where fecha between p_desde and p_hasta
    group by date_trunc('month', fecha)
  )
  select jsonb_build_object(
    'desde', p_desde,
    'hasta', p_hasta,
    'resumen', jsonb_build_object(
      'incidentes', (select coalesce(sum(total), 0) from incidentes_por_tipo),
      'horas_guardia', (select coalesce(sum(horas), 0) from horas_por_bombero),
      'cobertura_promedio', (select coalesce(round(avg(porcentaje), 1), 0) from cobertura_franjas),
      'fallas_chequeo', (select coalesce(sum(fallas), 0) from chequeos_fallas),
      'tareas_cumplidas', (select coalesce(sum(total), 0) from tareas_cumplidas),
      'actividades_prevencion', (select coalesce(sum(total), 0) from prevencion)
    ),
    'incidentes_por_tipo', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', tipo, 'total', total) order by total desc, tipo)
      from incidentes_por_tipo
    ), '[]'::jsonb),
    'incidentes_por_mes', coalesce((
      select jsonb_agg(jsonb_build_object('mes', mes, 'total', total) order by mes)
      from incidentes_por_mes
    ), '[]'::jsonb),
    'horas_por_bombero', coalesce((
      select jsonb_agg(jsonb_build_object(
        'bombero_id', bombero_id,
        'numero_ingreso', numero_ingreso,
        'nombre_completo', nombre_completo,
        'cargo', cargo,
        'horas', horas,
        'turnos', turnos
      ) order by horas desc, numero_ingreso)
      from horas_por_bombero
    ), '[]'::jsonb),
    'cobertura_franjas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'franja', franja,
        'celdas', celdas,
        'ocupadas', ocupadas,
        'libres', libres,
        'capacidad', capacidad,
        'porcentaje', porcentaje
      ) order by franja)
      from cobertura_franjas
    ), '[]'::jsonb),
    'chequeos_fallas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mes', mes,
        'chequeos', chequeos,
        'items', items,
        'fallas', fallas,
        'chequeos_con_fallas', chequeos_con_fallas
      ) order by mes)
      from chequeos_fallas
    ), '[]'::jsonb),
    'tareas_cumplidas', coalesce((
      select jsonb_agg(jsonb_build_object('mes', mes, 'total', total) order by mes)
      from tareas_cumplidas
    ), '[]'::jsonb),
    'prevencion', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mes', mes,
        'total', total,
        'charlas', charlas,
        'inspecciones', inspecciones,
        'simulacros', simulacros,
        'otras', otras
      ) order by mes)
      from prevencion
    ), '[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.reportes_obtener(date, date) from public, anon, authenticated;
grant execute on function public.reportes_obtener(date, date) to service_role;
