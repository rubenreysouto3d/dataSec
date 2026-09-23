-- dataSec universal data model (design draft; applied to Supabase only after project creation)
create extension if not exists postgis;

create table if not exists countries (
  id bigserial primary key,
  code text not null unique,
  name text not null
);

create table if not exists cities (
  id bigserial primary key,
  country_id bigint not null references countries(id),
  slug text not null unique,
  name text not null,
  timezone text not null
);

create table if not exists areas (
  id bigserial primary key,
  city_id bigint not null references cities(id),
  parent_area_id bigint references areas(id),
  source_area_id text not null,
  slug text not null,
  name text not null,
  population integer,
  geometry geometry(MultiPolygon, 4326),
  valid_from date,
  valid_to date,
  unique(city_id, source_area_id, valid_from)
);
create index if not exists areas_geometry_gix on areas using gist (geometry);

create table if not exists sources (
  id bigserial primary key,
  slug text not null unique,
  authority text not null,
  source_url text not null,
  licence text,
  update_frequency text,
  source_type text not null,
  granularity text,
  notes text
);

create table if not exists metrics (
  id bigserial primary key,
  slug text not null unique,
  label text not null,
  family text not null,
  description text
);

create table if not exists source_metric_mappings (
  id bigserial primary key,
  source_id bigint not null references sources(id),
  source_key text not null,
  metric_id bigint not null references metrics(id),
  unique(source_id, source_key)
);

create table if not exists observations (
  id bigserial primary key,
  area_id bigint not null references areas(id),
  source_id bigint not null references sources(id),
  metric_id bigint not null references metrics(id),
  period_start date not null,
  period_end date not null,
  value numeric not null,
  unit text not null,
  raw_metadata jsonb not null default '{}'::jsonb,
  unique(area_id, source_id, metric_id, period_start, period_end, unit)
);

create table if not exists ingestion_runs (
  id bigserial primary key,
  source_id bigint not null references sources(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running','passed','failed','quarantined')),
  source_version text,
  row_count integer,
  checksum text,
  diagnostics jsonb not null default '{}'::jsonb
);

create table if not exists data_quality_flags (
  id bigserial primary key,
  ingestion_run_id bigint not null references ingestion_runs(id),
  severity text not null check (severity in ('info','warning','error')),
  code text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb
);
