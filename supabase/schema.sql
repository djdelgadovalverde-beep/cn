-- =====================================================================
--  CN · Plataforma de desempeño (Visitas, Tareas, Frío, SOS, SOE)
--  Pega TODO este archivo en Supabase > SQL Editor > Run.
--  Seguridad: Row Level Security (RLS) en todas las tablas; el filtro por
--  rol se aplica en la base de datos, no en la página.
-- =====================================================================

-- ---------- PERFILES (1 por usuario de Supabase Auth) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  usuario text unique not null,
  nombre text not null default '',
  rol text not null default 'asesor' check (rol in ('admin','gerencia','supervisor','asesor')),
  ecm_code text,          -- asesor: su código ECM/BDR normalizado (ej. ECM031)
  supervisor text,        -- supervisor: su nombre tal como viene en las bases
  region text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create or replace function public.my_role() returns text language sql stable security definer set search_path = public as
$$ select rol from profiles where id = auth.uid() and activo $$;
create or replace function public.my_ecm() returns text language sql stable security definer set search_path = public as
$$ select upper(ecm_code) from profiles where id = auth.uid() and activo $$;
create or replace function public.my_sup() returns text language sql stable security definer set search_path = public as
$$ select upper(supervisor) from profiles where id = auth.uid() and activo $$;

-- ---------- CONFIGURACIÓN Y CATÁLOGOS ----------
create table if not exists public.config (clave text primary key, valor text not null);
insert into public.config(clave, valor) values
  ('w_vis','20'),('w_tar','30'),('w_frio','30'),('w_sos','10'),('w_soe','10'),
  ('meta_sos','0.8'),('meta_soe','0.8'),('frio_regex','FRIO|EQUIPO'),
  ('titulo','CN · Desempeño comercial')
on conflict do nothing;

create table if not exists public.motivos (
  id serial primary key,
  tipo text not null default 'ambos' check (tipo in ('vis','tar','ambos')),
  motivo text not null,
  responsable text not null default 'CN',   -- CN = justificación válida (no penaliza)
  activo boolean not null default true
);
insert into public.motivos(tipo, motivo, responsable) values
  ('ambos','Cliente cerrado','CN'),('ambos','Cliente no permite ejecución','CN'),
  ('vis','Falla de la aplicación / GPS','CN'),('tar','Equipo de frío no disponible','CN'),
  ('ambos','Falta de tiempo / ruta extensa','ASESOR'),('ambos','Sin justificación válida','ASESOR')
on conflict do nothing;

create table if not exists public.ecm_map (
  ecm text primary key, nombre text, telefono text, supervisor text
);
create table if not exists public.rutero (
  codigo text primary key, pdv text, region text, cadena text, ciudad text,
  supervisor text, ecm text, dia_visita text
);

-- ---------- BASES ----------
-- categoria: E efectiva · P perdida/pendiente · F fuera de rango/justificada · M mal ejecutada
create table if not exists public.visitas (
  id text primary key,
  fecha date not null,
  region text, gerencia text, supervisor text, ecm text not null,
  codigo_cliente text, cliente text,
  estado text, categoria text not null check (categoria in ('E','P','F','M')),
  detalle jsonb not null default '{}'::jsonb
);
create index if not exists visitas_fecha_idx on public.visitas(fecha);
create index if not exists visitas_ecm_idx on public.visitas(ecm);
create index if not exists visitas_sup_idx on public.visitas(upper(supervisor));

create table if not exists public.tareas (
  id text primary key,
  fecha date not null,
  supervisor text, ecm text not null,
  codigo_cliente text, cliente text,
  pilar text, descripcion text,
  estado text, resultado text,
  categoria text not null check (categoria in ('E','P','F','M')),
  es_frio boolean not null default false,
  url_imagen text, url_link text,
  detalle jsonb not null default '{}'::jsonb
);
create index if not exists tareas_fecha_idx on public.tareas(fecha);
create index if not exists tareas_ecm_idx on public.tareas(ecm);
create index if not exists tareas_sup_idx on public.tareas(upper(supervisor));

-- Detalle de SOS/SOE: caras por PDV, tipo (PERCHA, RUMA, BANDEJA FRÍO, BANDEJA SECO) y grupo (CN, HNK, MERC, OTROS, EXCLUIR)
create table if not exists public.share_detalle (
  id bigserial primary key,
  fecha date not null,
  codigo text not null, pdv text,
  ecm text, supervisor text,
  tipo text not null check (tipo in ('PERCHA','RUMA','BANDEJA FRÍO','BANDEJA SECO')),
  grupo text not null check (grupo in ('CN','HNK','MERC','OTROS','EXCLUIR')),
  caras integer not null default 0 check (caras >= 0),
  unique (fecha, codigo, tipo, grupo)
);
create index if not exists share_fecha_idx on public.share_detalle(fecha);

-- ---------- JUSTIFICACIONES (separadas de la base: recargar bases no las borra) ----------
create table if not exists public.justificaciones (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('vis','tar')),
  registro_id text not null,
  fecha date, ecm text, supervisor text,
  motivo text not null,
  responsable text not null default 'ASESOR',
  observacion text,
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobada','rectificada','rechazada')),
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  revisado_por uuid, revisado_en timestamptz,
  unique (tipo, registro_id)
);
create index if not exists just_fecha_idx on public.justificaciones(fecha);

create table if not exists public.bitacora (
  id bigserial primary key,
  fecha timestamptz not null default now(),
  usuario uuid default auth.uid(),
  tabla text, accion text, anterior jsonb, nuevo jsonb
);

-- ---------- TRIGGERS ----------
create or replace function public.trg_justificacion() returns trigger language plpgsql security definer set search_path = public as $$
declare r record; rol text := my_role(); resp text;
begin
  if rol is null then raise exception 'Sin permiso'; end if;
  if tg_op = 'INSERT' then
    if new.tipo = 'vis' then select fecha, ecm, supervisor, categoria into r from visitas where id = new.registro_id;
    else select fecha, ecm, supervisor, categoria into r from tareas where id = new.registro_id; end if;
    if r is null then raise exception 'El registro no existe'; end if;
    if r.categoria = 'E' then raise exception 'Un registro efectivo no se justifica'; end if;
    new.fecha := r.fecha; new.ecm := r.ecm; new.supervisor := r.supervisor;
    new.estado := 'pendiente'; new.creado_por := auth.uid();
  else
    new.tipo := old.tipo; new.registro_id := old.registro_id; new.fecha := old.fecha;
    new.ecm := old.ecm; new.supervisor := old.supervisor; new.creado_por := old.creado_por;
    if rol = 'asesor' then
      new.estado := old.estado; new.revisado_por := old.revisado_por; new.revisado_en := old.revisado_en;
    else
      if new.motivo is distinct from old.motivo and new.estado = old.estado then new.estado := 'rectificada'; end if;
      new.revisado_por := auth.uid(); new.revisado_en := now();
    end if;
  end if;
  -- el responsable SIEMPRE sale del catálogo (el cliente no lo puede falsear)
  select responsable into resp from motivos where motivo = new.motivo and activo
    and (tipo = 'ambos' or tipo = new.tipo) limit 1;
  if resp is null then raise exception 'Motivo no válido'; end if;
  new.responsable := resp;
  return new;
end $$;
drop trigger if exists justificacion_bi on public.justificaciones;
create trigger justificacion_bi before insert or update on public.justificaciones
  for each row execute function public.trg_justificacion();

create or replace function public.trg_bitacora() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into bitacora(tabla, accion, anterior, nuevo)
  values (tg_table_name, tg_op, case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
do $$ declare t text; begin
  foreach t in array array['justificaciones','share_detalle','config','profiles','motivos'] loop
    execute format('drop trigger if exists bit_%1$s on public.%1$s; create trigger bit_%1$s after insert or update or delete on public.%1$s for each row execute function public.trg_bitacora();', t);
  end loop;
end $$;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.config enable row level security;
alter table public.motivos enable row level security;
alter table public.ecm_map enable row level security;
alter table public.rutero enable row level security;
alter table public.visitas enable row level security;
alter table public.tareas enable row level security;
alter table public.share_detalle enable row level security;
alter table public.justificaciones enable row level security;
alter table public.bitacora enable row level security;

-- perfiles
create policy p_sel on public.profiles for select using (id = auth.uid() or my_role() in ('admin','gerencia','supervisor'));
create policy p_upd on public.profiles for update using (my_role() = 'admin') with check (my_role() = 'admin');
-- (altas/bajas de usuarios las hace la Edge Function con service role)

-- config y catálogos: leen todos los autenticados; escribe admin (ECM/rutero también gerencia)
create policy c_sel on public.config for select using (my_role() is not null);
create policy c_all on public.config for all using (my_role() = 'admin') with check (my_role() = 'admin');
create policy m_sel on public.motivos for select using (my_role() is not null);
create policy m_all on public.motivos for all using (my_role() in ('admin','gerencia')) with check (my_role() in ('admin','gerencia'));
create policy e_sel on public.ecm_map for select using (my_role() is not null);
create policy e_all on public.ecm_map for all using (my_role() in ('admin','gerencia')) with check (my_role() in ('admin','gerencia'));
create policy r_sel on public.rutero for select using (my_role() is not null);
create policy r_all on public.rutero for all using (my_role() in ('admin','gerencia')) with check (my_role() in ('admin','gerencia'));

-- visitas / tareas: asesor = lo suyo · supervisor = su equipo · gerencia y admin = todo · solo ellos cargan
create policy v_sel on public.visitas for select using (
  my_role() in ('admin','gerencia')
  or (my_role() = 'supervisor' and upper(supervisor) = my_sup())
  or (my_role() = 'asesor' and upper(ecm) = my_ecm()));
create policy v_w on public.visitas for all using (my_role() in ('admin','gerencia')) with check (my_role() in ('admin','gerencia'));
create policy t_sel on public.tareas for select using (
  my_role() in ('admin','gerencia')
  or (my_role() = 'supervisor' and upper(supervisor) = my_sup())
  or (my_role() = 'asesor' and upper(ecm) = my_ecm()));
create policy t_w on public.tareas for all using (my_role() in ('admin','gerencia')) with check (my_role() in ('admin','gerencia'));

-- SOS / SOE: información general visible para todos; modifica supervisor (su equipo), gerencia y admin
create policy s_sel on public.share_detalle for select using (my_role() is not null);
create policy s_ins on public.share_detalle for insert with check (my_role() in ('admin','gerencia'));
create policy s_upd on public.share_detalle for update
  using (my_role() in ('admin','gerencia') or (my_role() = 'supervisor' and upper(supervisor) = my_sup()))
  with check (my_role() in ('admin','gerencia') or (my_role() = 'supervisor' and upper(supervisor) = my_sup()));
create policy s_del on public.share_detalle for delete using (my_role() in ('admin','gerencia'));

-- justificaciones
create policy j_sel on public.justificaciones for select using (
  my_role() in ('admin','gerencia')
  or (my_role() = 'supervisor' and upper(supervisor) = my_sup())
  or (my_role() = 'asesor' and upper(ecm) = my_ecm()));
-- insertar: el trigger rellena ecm/supervisor desde el registro; el WITH CHECK valida el resultado final
create policy j_ins on public.justificaciones for insert with check (
  my_role() in ('admin','gerencia')
  or (my_role() = 'supervisor' and upper(supervisor) = my_sup())
  or (my_role() = 'asesor' and upper(ecm) = my_ecm()));
create policy j_upd on public.justificaciones for update using (
  my_role() in ('admin','gerencia')
  or (my_role() = 'supervisor' and upper(supervisor) = my_sup())
  or (my_role() = 'asesor' and upper(ecm) = my_ecm() and estado = 'pendiente'));
create policy j_del on public.justificaciones for delete using (my_role() in ('admin','gerencia'));

create policy b_sel on public.bitacora for select using (my_role() in ('admin','gerencia'));

-- ---------- PUNTAJE POR PERSONA ----------
-- 20% efectividad visitas · 30% tareas · 30% tareas equipo de frío · 10% SOS · 10% SOE (pesos editables en config)
-- Efectividad = efectivas / (programadas − justificadas válidas); válida = responsable CN y no rechazada.
-- SOS = caras CN en PERCHA / caras de PERCHA (sin EXCLUIR); SOE = caras CN en RUMA+BANDEJAS / total de espacios.
-- Cada componente se topa en 100% (SOS/SOE contra su meta). Si falta un componente se reparte su peso entre los demás.
create or replace function public.score_ecm(p_desde date, p_hasta date)
returns table (
  ecm text, nombre text, supervisor text,
  vis_prog int, vis_efec int, vis_just int, vis_pct numeric,
  tar_prog int, tar_efec int, tar_just int, tar_pct numeric,
  frio_prog int, frio_efec int, frio_just int, frio_pct numeric,
  sos_pct numeric, soe_pct numeric, score numeric)
language sql stable security invoker set search_path = public as $$
with cfg as (
  select
    coalesce((select valor::numeric from config where clave='w_vis'),20)  w_vis,
    coalesce((select valor::numeric from config where clave='w_tar'),30)  w_tar,
    coalesce((select valor::numeric from config where clave='w_frio'),30) w_frio,
    coalesce((select valor::numeric from config where clave='w_sos'),10)  w_sos,
    coalesce((select valor::numeric from config where clave='w_soe'),10)  w_soe,
    coalesce((select valor::numeric from config where clave='meta_sos'),0.8) m_sos,
    coalesce((select valor::numeric from config where clave='meta_soe'),0.8) m_soe),
v as (
  select upper(x.ecm) ecm, max(x.supervisor) sup, count(*)::int prog,
    count(*) filter (where x.categoria='E')::int efec,
    count(*) filter (where x.categoria<>'E' and j.responsable='CN' and j.estado<>'rechazada')::int just
  from visitas x left join justificaciones j on j.tipo='vis' and j.registro_id=x.id
  where x.fecha between p_desde and p_hasta group by 1),
t as (
  select upper(x.ecm) ecm, max(x.supervisor) sup,
    count(*) filter (where not x.es_frio)::int prog,
    count(*) filter (where not x.es_frio and x.categoria='E')::int efec,
    count(*) filter (where not x.es_frio and x.categoria<>'E' and j.responsable='CN' and j.estado<>'rechazada')::int just,
    count(*) filter (where x.es_frio)::int fprog,
    count(*) filter (where x.es_frio and x.categoria='E')::int fefec,
    count(*) filter (where x.es_frio and x.categoria<>'E' and j.responsable='CN' and j.estado<>'rechazada')::int fjust
  from tareas x left join justificaciones j on j.tipo='tar' and j.registro_id=x.id
  where x.fecha between p_desde and p_hasta group by 1),
s as (
  select upper(ecm) ecm, max(supervisor) sup,
    sum(caras) filter (where tipo='PERCHA' and grupo='CN') p_cn,
    sum(caras) filter (where tipo='PERCHA' and grupo<>'EXCLUIR') p_tot,
    sum(caras) filter (where tipo<>'PERCHA' and grupo='CN') e_cn,
    sum(caras) filter (where tipo<>'PERCHA' and grupo<>'EXCLUIR') e_tot
  from share_detalle where fecha between p_desde and p_hasta and ecm is not null group by 1),
ids as (select ecm from v union select ecm from t union select ecm from s),
base as (
  select i.ecm, m.nombre, coalesce(m.supervisor, v.sup, t.sup, s.sup) supervisor,
    coalesce(v.prog,0) vp, coalesce(v.efec,0) ve, coalesce(v.just,0) vj,
    coalesce(t.prog,0) tp, coalesce(t.efec,0) te, coalesce(t.just,0) tj,
    coalesce(t.fprog,0) fp, coalesce(t.fefec,0) fe, coalesce(t.fjust,0) fj,
    case when s.p_tot > 0 then s.p_cn::numeric / s.p_tot end sos,
    case when s.e_tot > 0 then s.e_cn::numeric / s.e_tot end soe
  from ids i
  left join ecm_map m on upper(m.ecm) = i.ecm
  left join v on v.ecm = i.ecm left join t on t.ecm = i.ecm left join s on s.ecm = i.ecm),
calc as (
  select b.*,
    case when b.vp - b.vj > 0 then least(1, b.ve::numeric / (b.vp - b.vj)) end vpct,
    case when b.tp - b.tj > 0 then least(1, b.te::numeric / (b.tp - b.tj)) end tpct,
    case when b.fp - b.fj > 0 then least(1, b.fe::numeric / (b.fp - b.fj)) end fpct
  from base b)
select c.ecm, c.nombre, c.supervisor,
  c.vp, c.ve, c.vj, round(c.vpct, 4),
  c.tp, c.te, c.tj, round(c.tpct, 4),
  c.fp, c.fe, c.fj, round(c.fpct, 4),
  round(c.sos, 4), round(c.soe, 4),
  round(100 * (
      coalesce(cfg.w_vis * c.vpct, 0) + coalesce(cfg.w_tar * c.tpct, 0) + coalesce(cfg.w_frio * c.fpct, 0)
    + coalesce(cfg.w_sos * least(1, c.sos / nullif(cfg.m_sos,0)), 0) + coalesce(cfg.w_soe * least(1, c.soe / nullif(cfg.m_soe,0)), 0)
  ) / nullif(
      (case when c.vpct is not null then cfg.w_vis else 0 end) + (case when c.tpct is not null then cfg.w_tar else 0 end)
    + (case when c.fpct is not null then cfg.w_frio else 0 end) + (case when c.sos is not null then cfg.w_sos else 0 end)
    + (case when c.soe is not null then cfg.w_soe else 0 end), 0), 1)
from calc c cross join cfg order by 1;
$$;
grant execute on function public.score_ecm(date, date) to authenticated;
