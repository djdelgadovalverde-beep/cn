-- PDV activos / inactivos
alter table public.rutero
  add column if not exists activo boolean not null default true,
  add column if not exists estado_manual boolean not null default false,
  add column if not exists inactivo_desde date,
  add column if not exists ult_dato date,
  add column if not exists estado_motivo text,
  add column if not exists estado_actualizado timestamptz;
create index if not exists rutero_activo_idx on public.rutero (activo);
insert into public.config (clave, valor) values ('pdv_semanas_inactivo', '3') on conflict (clave) do nothing;

-- Recalcula el estado de los PDV: sin dato (visitas, tareas, encuestas SOS/SOE o espacios ganados) en N semanas => inactivo;
-- si vuelve a tener datos => activo. Los PDV fijados a mano (estado_manual) no se tocan.
create or replace function public.pdv_recalcular_estado()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sem int; v_ref date; v_min date; v_corte date; n_in int := 0; n_act int := 0; n_hist boolean;
begin
  if (select public.my_role()) <> 'admin' then raise exception 'Solo el administrador puede recalcular el estado de los PDV'; end if;
  select coalesce((select valor::int from config where clave = 'pdv_semanas_inactivo'), 3) into v_sem;
  select greatest(coalesce((select max(fecha) from visitas), date '1900-01-01'), coalesce((select max(fecha) from tareas), date '1900-01-01'), coalesce((select max(fecha) from share_detalle), date '1900-01-01')) into v_ref;
  select least(coalesce((select min(fecha) from visitas), date '2999-01-01'), coalesce((select min(fecha) from share_detalle), date '2999-01-01')) into v_min;
  if v_ref = date '1900-01-01' then return jsonb_build_object('ok', false, 'motivo', 'sin datos cargados'); end if;
  v_corte := v_ref - v_sem * 7; n_hist := v_min <= v_corte;
  create temp table _u on commit drop as
    select c, max(f) f from (
      select codigo_cliente c, max(fecha) f from visitas group by 1
      union all select codigo_cliente, max(fecha) from tareas group by 1
      union all select codigo, max(fecha) from share_detalle group by 1
      union all select codigo, max(fecha) from ganancias group by 1) x where c is not null group by c;
  update rutero r set ult_dato = u.f from _u u where u.c = r.codigo and r.ult_dato is distinct from u.f;
  if n_hist then
    update rutero r set activo = false, inactivo_desde = coalesce(r.ult_dato, v_corte), estado_motivo = 'Sin datos en ' || v_sem || ' semanas', estado_actualizado = now()
      where not r.estado_manual and r.activo and (r.ult_dato is null or r.ult_dato < v_corte);
    get diagnostics n_in = row_count;
    update rutero r set activo = true, inactivo_desde = null, estado_motivo = 'Volvió a tener datos', estado_actualizado = now()
      where not r.estado_manual and not r.activo and r.ult_dato is not null and r.ult_dato >= v_corte;
    get diagnostics n_act = row_count;
  end if;
  return jsonb_build_object('ok', true, 'desactivados', n_in, 'reactivados', n_act, 'corte', v_corte, 'referencia', v_ref, 'historial_suficiente', n_hist, 'semanas', v_sem);
end $$;
revoke all on function public.pdv_recalcular_estado() from public, anon;
grant execute on function public.pdv_recalcular_estado() to authenticated;
