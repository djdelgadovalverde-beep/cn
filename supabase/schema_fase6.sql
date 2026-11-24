-- SOS / SOE: los PDV inactivos no entran en ningún cálculo (resumen, análisis, plan ni puntaje)
create or replace function public.share_agg(p_desde date, p_hasta date, p_dim text, p_region text[] default null, p_cadena text[] default null, p_supervisor text[] default null, p_ecm text[] default null, p_pdv text[] default null, p_excluir text[] default null)
returns table(dim text, nombre text, sem date, tipo text, grupo text, marca text, caras bigint)
language sql stable set search_path to 'public' as $function$
  with w as materialized (select coalesce((select valor::int from config where clave='semana_inicio'),3) wsd,
                    string_to_array(coalesce((select valor from config where clave='excluir_pdv'),''), ',') exc,
                    region_filtro() rf)
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
    and coalesce(r.activo, true)
    and s.codigo <> all (w.exc) and (w.rf is null or upper(coalesce(r.region,'')) = any (w.rf))
    and (p_region is null or r.region = any(p_region)) and (p_cadena is null or r.cadena = any(p_cadena))
    and (p_supervisor is null or upper(s.supervisor) = any(p_supervisor)) and (p_ecm is null or upper(s.ecm) = any(p_ecm))
    and (p_pdv is null or s.codigo = any(p_pdv)) and (p_excluir is null or s.codigo <> all(p_excluir))
  group by 1, 3, 4, 5, 6
$function$;

create or replace function public.share_pdv_sem(p_desde date, p_hasta date, p_region text[] default null, p_cadena text[] default null, p_supervisor text[] default null, p_ecm text[] default null)
returns jsonb language sql stable set search_path to 'public' as $function$
  with w as materialized (select coalesce((select valor::int from config where clave='semana_inicio'),3) wsd,
        string_to_array(coalesce((select valor from config where clave='excluir_pdv'),''), ',') exc, region_filtro() rf),
  x as (
    select s.codigo c, (s.fecha - ((extract(dow from s.fecha)::int - w.wsd + 7) % 7))::date sem, (s.tipo = 'PERCHA') isp,
           sum(s.caras)::int tot, coalesce(sum(s.caras) filter (where s.grupo = 'CN'), 0)::int cn,
           max(s.pdv) nom, max(r.cadena) cad, max(r.region) reg, max(upper(s.supervisor)) sup, max(upper(s.ecm)) ecm
    from share_detalle s cross join w left join rutero r on r.codigo = s.codigo
    where s.fecha between p_desde and p_hasta and s.grupo <> 'EXCLUIR' and s.codigo <> all (w.exc)
      and coalesce(r.activo, true)
      and (w.rf is null or upper(coalesce(r.region,'')) = any (w.rf))
      and (p_region is null or r.region = any(p_region)) and (p_cadena is null or r.cadena = any(p_cadena))
      and (p_supervisor is null or upper(s.supervisor) = any(p_supervisor)) and (p_ecm is null or upper(s.ecm) = any(p_ecm))
    group by 1, 2, 3)
  select coalesce(jsonb_agg(jsonb_build_array(c, sem, isp, tot, cn, nom, cad, reg, sup, ecm)), '[]'::jsonb) from x
$function$;

create or replace function public.plan_pdv_tipo(p_desde date, p_hasta date)
returns jsonb language sql stable set search_path to 'public' as $function$
  with w as materialized (select coalesce((select valor::int from config where clave='semana_inicio'),3) wsd,
        string_to_array(coalesce((select valor from config where clave='excluir_pdv'),''), ',') exc, region_filtro() rf),
  x as (
    select s.codigo c, (s.fecha - ((extract(dow from s.fecha)::int - w.wsd + 7) % 7))::date sem, s.tipo t,
           sum(s.caras)::int tot, coalesce(sum(s.caras) filter (where s.grupo = 'CN'), 0)::int cn
    from share_detalle s cross join w left join rutero r on r.codigo = s.codigo
    where s.fecha between p_desde and p_hasta and s.grupo <> 'EXCLUIR' and s.codigo <> all (w.exc)
      and coalesce(r.activo, true)
      and (w.rf is null or upper(coalesce(r.region,'')) = any (w.rf))
    group by 1, 2, 3)
  select coalesce(jsonb_agg(jsonb_build_array(c, sem, t, tot, cn)), '[]'::jsonb) from x
$function$;

-- puntaje por ECM: el SOS / SOE tampoco cuenta PDV inactivos
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.score_ecm(date,date)'::regprocedure);
  n := replace(d, 'from share_detalle where fecha between p_desde and p_hasta and ecm is not null group by 1',
    'from share_detalle where fecha between p_desde and p_hasta and ecm is not null and not exists (select 1 from rutero rr where rr.codigo = share_detalle.codigo and rr.activo = false) group by 1');
  if n = d then raise exception 'score_ecm: no se encontró el bloque de SOS/SOE'; end if;
  execute n;
end $$;
