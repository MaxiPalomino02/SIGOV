insert into public.bomberos (numero_ingreso, nombre_completo, cargo)
values
  (901, 'Demo Oficial Principal', 'Oficial Principal'),
  (902, 'Demo Oficial Ayudante', 'Oficial Ayudante'),
  (903, 'Demo Cabo', 'Cabo'),
  (904, 'Demo Bombero Uno', 'Bombero'),
  (905, 'Demo Bombero Dos', 'Bombero'),
  (906, 'Demo Aspirante', 'Aspirante')
on conflict (numero_ingreso) where activo do nothing;

with franjas(franja) as (
  values ('08:00-13:00'), ('13:00-18:00'), ('18:00-23:00'), ('23:00-08:00')
),
filas as (
  select
    (date_trunc('week', current_date)::date + g.dia)::date as fecha,
    f.franja,
    row_number() over (order by g.dia, f.franja) as n
  from generate_series(0, 13) as g(dia)
  cross join franjas as f
),
demo as (
  select id, row_number() over (order by numero_ingreso) as n
  from public.bomberos
  where numero_ingreso between 901 and 906 and activo
)
insert into public.turnos (fecha, franja, bombero_id)
select filas.fecha, filas.franja, demo.id
from filas
join demo on ((filas.n - 1) % 6) + 1 = demo.n
on conflict (fecha, franja, bombero_id) where bombero_id is not null do nothing;

insert into public.tareas (titulo, descripcion, creada_por, asignada_a)
select
  'Revisar mangueras de la móvil 1',
  'Tarea de prueba para mostrar el tablero.',
  b.id,
  (select id from public.bomberos where numero_ingreso = 904 and activo limit 1)
from public.bomberos b
where b.numero_ingreso = 901 and b.activo
  and not exists (select 1 from public.tareas t where t.titulo = 'Revisar mangueras de la móvil 1');

insert into public.avisos (titulo, cuerpo, tipo, creado_por)
select 'Aviso de prueba SIGOV', 'Novedad ficticia para probar la pantalla de avisos.', 'informativo', b.id
from public.bomberos b
where b.numero_ingreso = 901 and b.activo
  and not exists (select 1 from public.avisos a where a.titulo = 'Aviso de prueba SIGOV');

insert into public.avisos (titulo, cuerpo, tipo, creado_por)
select 'Convocatoria de prueba SIGOV', 'Convocatoria ficticia para probar las respuestas.', 'convocatoria', b.id
from public.bomberos b
where b.numero_ingreso = 901 and b.activo
  and not exists (select 1 from public.avisos a where a.titulo = 'Convocatoria de prueba SIGOV');

insert into public.convocatorias (aviso_id, motivo, fecha_hora, lugar)
select a.id, 'Simulacro de prueba', now() + interval '3 days', 'Cuartel demo'
from public.avisos a
where a.titulo = 'Convocatoria de prueba SIGOV'
  and not exists (select 1 from public.convocatorias c where c.aviso_id = a.id);

insert into public.convocatoria_respuestas (aviso_id, bombero_id, respuesta)
select a.id, b.id, 'voy'
from public.avisos a
join public.bomberos b on b.numero_ingreso = 904 and b.activo
where a.titulo = 'Convocatoria de prueba SIGOV'
on conflict (aviso_id, bombero_id) do nothing;

insert into public.eventos (titulo, descripcion, tipo, inicio, fin, lugar, creado_por)
select 'Capacitación de prueba', 'Evento ficticio para el calendario.', 'capacitacion', now() + interval '2 days', now() + interval '2 days 2 hours', 'Sala demo', b.id
from public.bomberos b
where b.numero_ingreso = 901 and b.activo
  and not exists (select 1 from public.eventos e where e.titulo = 'Capacitación de prueba');

insert into public.alarmas (tipo, detalle, es_simulacro, activada_por, activada_en, activa, cerrada_por, cerrada_en)
select 'simulacro', 'Simulacro de prueba SIGOV', true, b.id, now() - interval '2 hours', false, b.id, now() - interval '1 hour'
from public.bomberos b
where b.numero_ingreso = 901 and b.activo
  and not exists (select 1 from public.alarmas a where a.detalle = 'Simulacro de prueba SIGOV');

insert into public.alarma_respuestas (alarma_id, bombero_id, respuesta)
select a.id, b.id, 'recibido'
from public.alarmas a
join public.bomberos b on b.numero_ingreso in (902, 904) and b.activo
where a.detalle = 'Simulacro de prueba SIGOV'
on conflict (alarma_id, bombero_id) do nothing;

insert into public.equipos (codigo, nombre, categoria, ubicacion, estado, notas)
select 'DEMO-01', 'Móvil de prueba', 'Vehículos', 'Cuartel demo', 'operativo', 'Equipo ficticio para demostración.'
where not exists (select 1 from public.equipos e where lower(e.codigo) = 'demo-01');

insert into public.chequeo_plantillas (nombre, tipo, creado_por)
select 'Apertura demo', 'apertura', b.id
from public.bomberos b
where b.numero_ingreso = 901 and b.activo
  and not exists (select 1 from public.chequeo_plantillas p where p.nombre = 'Apertura demo');

insert into public.chequeo_items (plantilla_id, nombre, grupo, orden)
select p.id, 'Revisar extintores', 'Móvil 1', 1
from public.chequeo_plantillas p
where p.nombre = 'Apertura demo'
  and not exists (select 1 from public.chequeo_items i where i.plantilla_id = p.id and i.nombre = 'Revisar extintores');

insert into public.chequeo_items (plantilla_id, nombre, grupo, orden)
select p.id, 'Revisar mangueras', 'Móvil 1', 2
from public.chequeo_plantillas p
where p.nombre = 'Apertura demo'
  and not exists (select 1 from public.chequeo_items i where i.plantilla_id = p.id and i.nombre = 'Revisar mangueras');

insert into public.chequeos (plantilla_id, realizado_por, fecha, franja, estado, observaciones)
select p.id, b.id, current_date, '08:00-13:00', 'completo', 'Chequeo de prueba.'
from public.chequeo_plantillas p
join public.bomberos b on b.numero_ingreso = 904 and b.activo
where p.nombre = 'Apertura demo'
on conflict (plantilla_id, fecha, franja, realizado_por) do nothing;

insert into public.chequeo_resultados (chequeo_id, item_id, estado, nota)
select c.id, i.id, 'ok', 'Revisado en la demo.'
from public.chequeos c
join public.chequeo_plantillas p on p.id = c.plantilla_id
join public.chequeo_items i on i.plantilla_id = p.id
where p.nombre = 'Apertura demo' and c.observaciones = 'Chequeo de prueba.'
on conflict (chequeo_id, item_id) do nothing;

insert into public.incidentes (tipo, fecha_hora, direccion, descripcion, unidades, personal, estado, creado_por)
select 'otro', now() - interval '5 hours', 'Calle Demo 123', 'Incidente ficticio para demostración.', array['Movil 1']::text[], '[]'::jsonb, 'cargado', b.id
from public.bomberos b
where b.numero_ingreso = 901 and b.activo
  and not exists (select 1 from public.incidentes i where i.descripcion = 'Incidente ficticio para demostración.');

insert into public.documentos (titulo, categoria, descripcion, archivo_path, tamano, tipo_mime, subido_por)
select 'Protocolo de prueba', 'protocolos', 'Documento ficticio para la biblioteca.', b.id::text || '/protocolo-demo.pdf', 1024, 'application/pdf', b.id
from public.bomberos b
where b.numero_ingreso = 901 and b.activo
on conflict (archivo_path) do nothing;

insert into public.prevencion_actividades (tipo, fecha, lugar, responsable_id, participantes, descripcion, fotos, creado_por)
select 'charla', current_date + 3, 'Salón demo', b.id, 'Bomberos demo', 'Charla ficticia para prevención.', '{}'::text[], b.id
from public.bomberos b
where b.numero_ingreso = 902 and b.activo
  and not exists (select 1 from public.prevencion_actividades p where p.descripcion = 'Charla ficticia para prevención.');
