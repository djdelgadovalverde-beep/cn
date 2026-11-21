-- Accesos y movimiento (solo lo ve el administrador)
create table if not exists public.accesos (
  id bigserial primary key,
  usuario uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  fecha timestamptz not null default now(),
  evento text not null check (evento in ('login','sesion','pantalla')),
  vista text,
  agente text
);
create index if not exists accesos_fecha_idx on public.accesos (fecha desc);
create index if not exists accesos_usuario_fecha_idx on public.accesos (usuario, fecha desc);
alter table public.accesos enable row level security;
drop policy if exists accesos_ins on public.accesos;
create policy accesos_ins on public.accesos for insert to authenticated with check (usuario = (select auth.uid()));
drop policy if exists accesos_sel on public.accesos;
create policy accesos_sel on public.accesos for select to authenticated using ((select public.my_role()) = 'admin');
drop policy if exists accesos_del on public.accesos;
create policy accesos_del on public.accesos for delete to authenticated using ((select public.my_role()) = 'admin');

-- Resumen por usuario de los últimos N días (accesos, pantallas, cambios en la bitácora)
create or replace function public.admin_actividad(p_dias int default 7)
returns table(usuario uuid, ult_acceso timestamptz, accesos bigint, dias_activos bigint, pantallas bigint, cambios bigint, ult_cambio timestamptz)
language sql stable security definer set search_path = public as $$
  with ok as (select (select public.my_role()) = 'admin' as es),
  d as (select now() - make_interval(days => greatest(1, least(coalesce(p_dias, 7), 90))) as desde),
  a as (select x.usuario, max(x.fecha) filter (where x.evento in ('login','sesion')) ult,
               count(*) filter (where x.evento in ('login','sesion')) n,
               count(distinct (x.fecha at time zone 'America/Guayaquil')::date) filter (where x.evento in ('login','sesion')) dias,
               count(*) filter (where x.evento = 'pantalla') pant
        from accesos x, d where x.fecha >= d.desde group by 1),
  b as (select t.usuario, count(*) n, max(t.fecha) ult from bitacora t, d where t.fecha >= d.desde and t.usuario is not null group by 1)
  select p.id, a.ult, coalesce(a.n,0), coalesce(a.dias,0), coalesce(a.pant,0), coalesce(b.n,0), b.ult
  from profiles p cross join ok left join a on a.usuario = p.id left join b on b.usuario = p.id
  where ok.es
$$;
revoke all on function public.admin_actividad(int) from public, anon;
grant execute on function public.admin_actividad(int) to authenticated;
