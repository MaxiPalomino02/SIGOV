-- Seed de DESARROLLO: nombres y legajos ficticios. NO usar el padron real aca.
-- Ejecutar despues de schema.sql y rpc.sql. Idempotente.
-- Cambia el legajo 1 por el tuyo si queres entrar como Oficial Principal.
insert into public.bomberos (numero_ingreso, nombre_completo, cargo)
values
  (1,  'Prueba Oficial Principal', 'Oficial Principal'),
  (2,  'Prueba Oficial Ayudante',  'Oficial Ayudante'),
  (3,  'Prueba Cabo',              'Cabo'),
  (4,  'Prueba Bombero Uno',       'Bombero'),
  (5,  'Prueba Bombero Dos',       'Bombero'),
  (6,  'Prueba Bombero Tres',      'Bombero'),
  (7,  'Prueba Bombero Cuatro',    'Bombero'),
  (8,  'Prueba Aspirante',         'Aspirante')
on conflict (numero_ingreso) where activo do nothing;
