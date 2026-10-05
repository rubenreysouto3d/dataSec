-- Applied to production Supabase on 2026-10-05.
-- Adds the first target-model primitives without replacing the legacy area/metric API.

create table if not exists public.city_capabilities (
  city_slug text not null references public.cities(slug) on delete cascade,
  domain text not null,
  operation text not null,
  available boolean not null default false,
  status text not null default 'unavailable'
    check (status in ('live','pipeline_ready','research','unavailable')),
  geography text[] not null default '{}',
  freshness text,
  source_slugs text[] not null default '{}',
  notes text,
  updated_at timestamptz not null default now(),
  primary key (city_slug, domain, operation)
);

create table if not exists public.temporal_observations (
  area_id text not null references public.areas(id) on delete cascade,
  source_slug text not null references public.sources(slug),
  metric_slug text not null references public.metrics(slug),
  period_start date not null,
  period_end date not null,
  hour_start smallint not null check (hour_start between 0 and 23),
  value numeric not null check (value >= 0),
  unit text not null,
  provenance jsonb not null default '{}'::jsonb,
  primary key (
    area_id, source_slug, metric_slug, period_start, period_end, hour_start, unit
  )
);

create index if not exists temporal_observations_area_period_hour_idx
  on public.temporal_observations (area_id, period_start desc, hour_start);

create index if not exists temporal_observations_metric_period_hour_idx
  on public.temporal_observations (metric_slug, period_start desc, hour_start);

alter table public.city_capabilities enable row level security;
alter table public.temporal_observations enable row level security;

drop policy if exists "city capabilities public read" on public.city_capabilities;
create policy "city capabilities public read"
on public.city_capabilities for select to anon, authenticated using (true);

drop policy if exists "temporal observations public read" on public.temporal_observations;
create policy "temporal observations public read"
on public.temporal_observations for select to anon, authenticated using (true);

grant select on public.city_capabilities, public.temporal_observations
to anon, authenticated;

grant select, insert, update, delete on public.city_capabilities, public.temporal_observations
to service_role;

alter table public.ingestion_staging
  drop constraint if exists ingestion_staging_entity_type_check;

alter table public.ingestion_staging
  add constraint ingestion_staging_entity_type_check
  check (entity_type in ('metric','area','boundary','observation','temporal_observation'));

-- publish_ingestion_run is replaced by the full function in docs/schema.sql.
