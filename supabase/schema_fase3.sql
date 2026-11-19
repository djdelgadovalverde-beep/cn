-- =====================================================================
--  FASE 3 · ejecutar DESPUÉS de schema.sql y schema_fase2.sql
--  (ya aplicada en el proyecto cn-desempeno; se guarda aquí para poder recrearlo)
--  Efectividad ajustada, marca/producto en SOS-SOE, metas, cargas, enlaces, ECM y funciones de agregación.
-- =====================================================================
insert into public.config(clave, valor) values
  ('meta_vis','0.9'),('meta_tar','0.9'),('meta_frio','0.9'),('dur_min','2'),('rei_min','2'),('dias_antiguedad','15')
on conflict do nothing;

alter table public.share_detalle add column if not exists marca text not null default '';
alter table public.share_detalle add column if not exists sku text not null default '';
alter table public.share_detalle drop constraint if exists share_detalle_fecha_codigo_tipo_grupo_key;
alter table public.share_detalle add constraint share_detalle_uk unique (fecha, codigo, tipo, grupo, marca, sku);
create index if not exists share_codigo_idx on public.share_detalle(codigo);
alter table public.catalogo_share add column if not exists visual text;

create table if not exists public.metas (
  id bigserial primary key,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  ambito text not null check (ambito in ('general','region','cadena','supervisor','ecm','pdv')),
  clave text not null default '',
  tipo text not null check (tipo in ('percha','frio','seco','ruma','total')),
  valor integer not null check (valor >= 0),
  unique (mes, ambito, clave, tipo)
);
alter table public.metas enable row level security;
create policy mt_sel on public.metas for select using (my_role() is not null);
create policy mt_all on public.metas for all using (my_role() in ('admin','gerencia')) with check (my_role() in ('admin','gerencia'));
drop trigger if exists bit_metas on public.metas;
create trigger bit_metas after insert or update or delete on public.metas for each row execute function public.trg_bitacora();

create or replace function public.share_agg(p_desde date, p_hasta date, p_dim text,
  p_region text default null, p_cadena text default null, p_supervisor text default null, p_ecm text default null)
returns table (dim text, nombre text, sem date, tipo text, grupo text, marca text, caras bigint)
language sql stable security invoker set search_path = public as $$
  with w as (select coalesce((select valor::int from config where clave='semana_inicio'),3) wsd)
  select
    case p_dim when 'ecm' then upper(coalesce(s.ecm,'')) when 'supervisor' then upper(coalesce(s.supervisor,''))
      when 'region' then coalesce(r.region,'') when 'cadena' then coalesce(r.cadena,'')
      when 'marca' then s.marca when 'sku' then s.sku when 'pdv' then s.codigo else 'TOTAL' end,
    case when p_dim = 'pdv' then max(s.pdv) else '' end,
    (s.fecha - ((extract(dow from s.fecha)::int - w.wsd + 7) % 7))::date,
    s.tipo, s.grupo,
    case when p_dim in ('marca','sku') then s.marca else '' end,
    sum(s.caras)::bigint
  from share_detalle s cross join w left join rutero r on r.codigo = s.codigo
  where s.fecha between p_desde and p_hasta and s.grupo <> 'EXCLUIR'
    and (p_region is null or r.region = p_region) and (p_cadena is null or r.cadena = p_cadena)
    and (p_supervisor is null or upper(s.supervisor) = upper(p_supervisor)) and (p_ecm is null or upper(s.ecm) = upper(p_ecm))
  group by 1, 3, 4, 5, 6
$$;
create or replace function public.share_opts() returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'region', (select coalesce(jsonb_agg(x order by x), '[]') from (select distinct region x from rutero where coalesce(region,'') <> '') a),
    'cadena', (select coalesce(jsonb_agg(x order by x), '[]') from (select distinct cadena x from rutero where coalesce(cadena,'') <> '') a),
    'supervisor', (select coalesce(jsonb_agg(x order by x), '[]') from (select distinct upper(supervisor) x from share_detalle where coalesce(supervisor,'') <> '') a),
    'ecm', (select coalesce(jsonb_agg(x order by x), '[]') from (select distinct upper(ecm) x from share_detalle where coalesce(ecm,'') <> '') a),
    'desde', (select min(fecha) from share_detalle), 'hasta', (select max(fecha) from share_detalle))
$$;

alter table public.tareas add column if not exists region text;
alter table public.visitas add column if not exists programadas int not null default 1;
alter table public.rutero
  add column if not exists subcadena text, add column if not exists kam text, add column if not exists gerencia text,
  add column if not exists grupo_supervision text, add column if not exists semanas text, add column if not exists dia_entrega text,
  add column if not exists agrupacion text, add column if not exists gestor text;
alter table public.ecm_map add column if not exists origen text not null default 'manual';

create table if not exists public.cargas (
  id bigserial primary key, fecha timestamptz not null default now(), usuario uuid default auth.uid(),
  tipo text not null, modo text, archivo text, filas int, nuevas int, actualizadas int, iguales int, borradas int,
  detalle jsonb not null default '{}'::jsonb
);
alter table public.cargas enable row level security;
create policy ca_sel on public.cargas for select using (my_role() in ('admin','gerencia'));
create policy ca_ins on public.cargas for insert with check (my_role() in ('admin','gerencia'));

create table if not exists public.enlaces (
  visita_id text primary key, ecm text, codigo text, fecha date,
  foto_antes text, foto_despues text, efectividad text, check_in text, check_out text, novedades text,
  cargado timestamptz not null default now(), coincidencia text not null default 'CODIGO'
);
alter table public.enlaces enable row level security;
create policy en_sel on public.enlaces for select using (exists (select 1 from public.visitas v where v.id = enlaces.visita_id));
create policy en_w on public.enlaces for all using (my_role() in ('admin','gerencia')) with check (my_role() in ('admin','gerencia'));

-- (la función trg_justificacion se actualizó para aceptar la sincronización de supervisor: ver la versión vigente en el proyecto)
-- ecm_sync, ecm_propagar, estado_datos, regiones_clientes y la nueva score_ecm (ajustada = (efectivas+justificadas)/programadas)
-- están definidas en las migraciones fase3_cargas, regiones_clientes y fase3_analisis del proyecto Supabase.
revoke execute on function public.share_agg(date,date,text,text,text,text,text) from public, anon;
grant execute on function public.share_agg(date,date,text,text,text,text,text) to authenticated;
revoke execute on function public.share_opts() from public, anon;
grant execute on function public.share_opts() to authenticated;
