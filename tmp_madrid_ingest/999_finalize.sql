begin;

insert into public.ingestion_runs(
  id,source_slug,started_at,finished_at,status,source_version,row_count,matched_row_count,checksum,diagnostics
) values (
  'f64172de-f61f-4131-8cbb-94709b0feeab','madrid-police-dispatch-incidents',now(),now(),'passed','2026-08',
  43177,43001,'6d9b3d06999e26fd55b9c45295ba5464f83a5f10b86f7c91239a18edab56550a','{"unmatched_rows":176,"resource_id":"837676-16-incidencias-recibidas-en-la-emisora-central-de-policia-municipal","source_sha256":"6d9b3d06999e26fd55b9c45295ba5464f83a5f10b86f7c91239a18edab56550a","boundary_sha256":"702cb35318bd918d700a10dfceac8f3f3b96b466a8f708367710c41d83b18d75","boundary_model":"current_madrid_municipal_neighbourhood_geojson"}'::jsonb
)
on conflict(id) do nothing;

insert into public.data_quality_flags(ingestion_run_id,severity,code,message,details)
values (
  'f64172de-f61f-4131-8cbb-94709b0feeab',
  'warning',
  'guindalera_092_source_caveat',
  'The official source states that Guindalera includes incidents closed as citizen information at the 092 service address, which creates an apparent local concentration.',
  '{"neighbourhood":"Guindalera","source_note":true}'::jsonb
);

    insert into public.data_quality_flags(ingestion_run_id,severity,code,message,details)
    values (
      'f64172de-f61f-4131-8cbb-94709b0feeab',
      'warning',
      'unmatched_madrid_rows',
      '176 Madrid source rows could not be matched to the official neighbourhood catalog.',
      '{"ratio":0.004076244296732056,"top_unmatched":[["DESCONOCIDO / DESCONOCIDO",176]]}'::jsonb
    );
    
commit;
