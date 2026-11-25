revoke all on table public.bomberos from anon;

grant select (id, numero_ingreso, nombre_completo, cargo, activo) on table public.bomberos to anon;

revoke insert, update, delete on table public.turnos from anon;
revoke insert, update, delete on table public.configuracion from anon;
revoke insert, update, delete on table public.historial_cambios from anon;

revoke all on function public._alertas_es_oficial(uuid) from public, anon, authenticated;
revoke all on function public._eventos_es_oficial(uuid) from public, anon, authenticated;

grant execute on function public._alertas_es_oficial(uuid) to service_role;
grant execute on function public._eventos_es_oficial(uuid) to service_role;
