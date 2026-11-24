-- ECM activos / inactivos: un ECM inactivo no cuenta en gráficos, puntaje, SOS/SOE ni plan.
alter table public.ecm_map add column if not exists activo boolean not null default true;
-- Las funciones share_agg, share_pdv_sem, plan_pdv_tipo, score_ecm y vt_opts excluyen a los ECM con activo = false
-- (se aplicó como migración «ecm_activo_inactivo» en el proyecto).
