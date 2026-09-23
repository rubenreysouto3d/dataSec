begin;

insert into public.ingestion_runs(
  id,source_slug,started_at,finished_at,status,source_version,row_count,matched_row_count,checksum,diagnostics
) values (
  'aa18a1c3-5559-4715-9a89-fcf37cf48b1c','uk-police-open-data',now(),now(),'passed','2026-07',101644,101512,'6ba79297d8e5c9cb0bde1e306ca94c456a82deec4c9f01689353177018a65cbb','{"unmatched_rows":132,"crime_zip_sha256":"6ba79297d8e5c9cb0bde1e306ca94c456a82deec4c9f01689353177018a65cbb","boundary_zip_sha256":"b32bfe4b84bf59a5648df108d4623d110a2f0fdd5e94946fb3eab8937a269c5b","boundary_model":"same_month_police_neighbourhood_archive"}'::jsonb
)
on conflict(id) do nothing;

    insert into public.data_quality_flags(ingestion_run_id,severity,code,message,details)
    values (
      'aa18a1c3-5559-4715-9a89-fcf37cf48b1c',
      'warning',
      'unmatched_crime_points',
      '132 source rows could not be assigned to a Metropolitan Police neighbourhood.',
      '{"ratio":0.001298650190862225}'::jsonb
    );
    
commit;
