-- =====================================================================
--  FASE 2 · ejecutar DESPUÉS de schema.sql (SQL Editor > Run)
--  Catálogo de marcas, espacios ganados, evidencias (fotos), ubicaciones PDV
-- =====================================================================

insert into public.config(clave, valor) values
  ('semana_inicio','3'),          -- 0=dom … 3=mié (semana operativa mié–mar, solo se cuentan mié–dom)
  ('excluir_pdv','14019915')      -- códigos de PDV excluidos, separados por coma
on conflict do nothing;

-- ---------- Catálogo de preguntas de las encuestas SOS/SOE ----------
create table if not exists public.catalogo_share (
  clave text primary key,            -- pregunta normalizada
  pregunta text not null,
  encuesta text not null check (encuesta in ('SOS','SOE')),
  grupo text not null check (grupo in ('CN','HNK','MERC','OTROS','EXCLUIR')),
  tipo text not null check (tipo in ('PERCHA','RUMA','BANDEJA FRÍO','BANDEJA SECO')),
  marca text,
  origen text not null default 'auto'  -- auto = clasificada por palabras clave (revisar) · manual
);
alter table public.catalogo_share enable row level security;
create policy cs_sel on public.catalogo_share for select using (my_role() in ('admin','gerencia'));
create policy cs_all on public.catalogo_share for all using (my_role() in ('admin','gerencia')) with check (my_role() in ('admin','gerencia'));

-- ---------- Espacios ganados (un registro por PDV y día) ----------
create table if not exists public.ganancias (
  id bigserial primary key,
  fecha date not null, hora text,
  codigo text not null, pdv text, cadena text,
  ecm text, supervisor text,
  percha int not null default 0 check (percha >= 0),
  frio int not null default 0 check (frio >= 0),
  seco int not null default 0 check (seco >= 0),
  ruma int not null default 0 check (ruma >= 0),
  foto_percha text, foto_frio text, foto_seco text, foto_ruma text,
  observacion text, foto_obs text,
  fuente text not null default 'archivo' check (fuente in ('archivo','manual')),
  usuario uuid default auth.uid(),
  unique (fecha, codigo)
);
create index if not exists gan_fecha_idx on public.ganancias(fecha);
alter table public.ganancias enable row level security;
create policy g_sel on public.ganancias for select using (
  my_role() in ('admin','gerencia')
  or (my_role() = 'supervisor' and upper(supervisor) = my_sup())
  or (my_role() = 'asesor' and upper(ecm) = my_ecm()));
create policy g_ins on public.ganancias for insert with check (
  my_role() in ('admin','gerencia')
  or (my_role() = 'supervisor' and upper(supervisor) = my_sup())
  or (my_role() = 'asesor' and upper(ecm) = my_ecm()));
create policy g_upd on public.ganancias for update using (
  my_role() in ('admin','gerencia')
  or (my_role() = 'supervisor' and upper(supervisor) = my_sup())
  or (my_role() = 'asesor' and upper(ecm) = my_ecm()))
  with check (
  my_role() in ('admin','gerencia')
  or (my_role() = 'supervisor' and upper(supervisor) = my_sup())
  or (my_role() = 'asesor' and upper(ecm) = my_ecm()));
create policy g_del on public.ganancias for delete using (
  my_role() in ('admin','gerencia')
  or (my_role() = 'supervisor' and upper(supervisor) = my_sup()));
drop trigger if exists bit_ganancias on public.ganancias;
create trigger bit_ganancias after insert or update or delete on public.ganancias for each row execute function public.trg_bitacora();

-- ---------- Ubicaciones de PDV ----------
create table if not exists public.ubicaciones (
  codigo text primary key, lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  usuario uuid default auth.uid(), fecha timestamptz default now()
);
alter table public.ubicaciones enable row level security;
create policy u_sel on public.ubicaciones for select using (my_role() is not null);
create policy u_ins on public.ubicaciones for insert with check (my_role() in ('admin','gerencia','supervisor','asesor'));
create policy u_upd on public.ubicaciones for update using (my_role() in ('admin','gerencia','supervisor','asesor'));

-- ---------- Evidencias (fotos) de justificaciones ----------
create table if not exists public.evidencias (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('vis','tar')),
  registro_id text not null,
  path text not null unique,
  ecm text, supervisor text,
  creado_por uuid default auth.uid(), creado_en timestamptz default now()
);
create index if not exists evi_reg_idx on public.evidencias(tipo, registro_id);
alter table public.evidencias enable row level security;

create or replace function public.trg_evidencia() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.tipo = 'vis' then select ecm, supervisor into r from visitas where id = new.registro_id;
  else select ecm, supervisor into r from tareas where id = new.registro_id; end if;
  if r is null then raise exception 'El registro no existe'; end if;
  new.ecm := r.ecm; new.supervisor := r.supervisor; new.creado_por := auth.uid();
  return new;
end $$;
drop trigger if exists evidencia_bi on public.evidencias;
create trigger evidencia_bi before insert on public.evidencias for each row execute function public.trg_evidencia();

create policy ev_sel on public.evidencias for select using (
  my_role() in ('admin','gerencia')
  or (my_role() = 'supervisor' and upper(supervisor) = my_sup())
  or (my_role() = 'asesor' and upper(ecm) = my_ecm()));
create policy ev_ins on public.evidencias for insert with check (
  my_role() in ('admin','gerencia')
  or (my_role() = 'supervisor' and upper(supervisor) = my_sup())
  or (my_role() = 'asesor' and upper(ecm) = my_ecm()));
create policy ev_del on public.evidencias for delete using (
  my_role() in ('admin','gerencia')
  or (my_role() = 'supervisor' and upper(supervisor) = my_sup())
  or (my_role() = 'asesor' and upper(ecm) = my_ecm() and creado_por = auth.uid()));

-- Bucket privado (1 GB gratis). Las fotos solo se leen con URL firmada y solo quien ve la evidencia.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('evidencias', 'evidencias', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "evi_storage_ins" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias' and public.my_role() is not null);
create policy "evi_storage_sel" on storage.objects for select to authenticated
  using (bucket_id = 'evidencias' and exists (select 1 from public.evidencias e where e.path = name));
create policy "evi_storage_del" on storage.objects for delete to authenticated
  using (bucket_id = 'evidencias' and exists (select 1 from public.evidencias e where e.path = name));
