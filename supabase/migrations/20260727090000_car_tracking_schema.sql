-- ============================================================================
-- Car price tracking schema (Cars24 + Spinny)
-- ============================================================================
-- One row per car per source, holding the LATEST raw scrape response.
-- A separate append-only history table holds one price row per car per day,
-- with no pruning / no retention limit, as requested.
-- ============================================================================

create extension if not exists pgcrypto; -- for gen_random_uuid()

-- ----------------------------------------------------------------------------
-- cars: current snapshot, one row per (source, external_id)
-- ----------------------------------------------------------------------------
create table if not exists public.cars (
  id             uuid primary key default gen_random_uuid(),

  -- identity
  source         text not null check (source in ('cars24', 'spinny')),
  external_id    text not null,       -- appointmentId (cars24) / id (spinny)

  -- lifecycle
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  is_active      boolean not null default true,  -- false once it drops out of a scrape (sold/delisted)

  -- denormalized fields for filtering/sorting without touching raw_json
  make           text,
  model          text,
  variant        text,
  year           int,
  city           text,
  fuel_type      text,
  transmission   text,
  odometer_km    integer,
  latest_price   numeric not null,

  -- full raw API object for this car, OVERWRITTEN on every scrape (no history kept here)
  raw_json       jsonb not null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (source, external_id)
);

create index if not exists cars_source_idx on public.cars (source);
create index if not exists cars_is_active_idx on public.cars (is_active);
create index if not exists cars_make_model_idx on public.cars (make, model);
create index if not exists cars_raw_json_gin on public.cars using gin (raw_json);

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cars_set_updated_at on public.cars;
create trigger cars_set_updated_at
  before update on public.cars
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- car_price_history: append-only, one row per car per calendar day, unbounded
-- ----------------------------------------------------------------------------
create table if not exists public.car_price_history (
  id            bigint generated always as identity primary key,
  car_id        uuid not null references public.cars(id) on delete cascade,
  scraped_date  date not null,               -- the "day" this price was observed
  price         numeric not null,
  is_active     boolean not null default true, -- was the listing live that day
  scraped_at    timestamptz not null default now(),

  unique (car_id, scraped_date)  -- one row per car per day; upsert on re-run same day
);

create index if not exists car_price_history_car_id_idx
  on public.car_price_history (car_id, scraped_date desc);

-- ----------------------------------------------------------------------------
-- scrape_runs: lightweight audit log of each cron/manual run (optional but handy)
-- ----------------------------------------------------------------------------
create table if not exists public.scrape_runs (
  id            bigint generated always as identity primary key,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running' check (status in ('running', 'success', 'error')),
  cars24_count  integer,
  spinny_count  integer,
  error_message text
);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
-- Writes only ever happen from the Edge Function using the service_role key,
-- which bypasses RLS entirely. We just need read policies for the UI.
alter table public.cars enable row level security;
alter table public.car_price_history enable row level security;
alter table public.scrape_runs enable row level security;

-- Allow anyone with the anon/authenticated key to read cars + history.
-- Tighten these (e.g. to `authenticated` only, or add a user_id scope)
-- if this data shouldn't be public.
drop policy if exists "cars are publicly readable" on public.cars;
create policy "cars are publicly readable"
  on public.cars for select
  to anon, authenticated
  using (true);

drop policy if exists "price history is publicly readable" on public.car_price_history;
create policy "price history is publicly readable"
  on public.car_price_history for select
  to anon, authenticated
  using (true);

-- scrape_runs is operational/internal — no public read policy on purpose.

-- ----------------------------------------------------------------------------
-- Convenience view: latest price + previous price + simple day-over-day delta
-- ----------------------------------------------------------------------------
create or replace view public.cars_with_price_change as
select
  c.*,
  prev.price as previous_price,
  (c.latest_price - prev.price) as price_change,
  prev.scraped_date as previous_price_date
from public.cars c
left join lateral (
  select price, scraped_date
  from public.car_price_history h
  where h.car_id = c.id
    and h.scraped_date < (
      select max(scraped_date) from public.car_price_history h2 where h2.car_id = c.id
    )
  order by h.scraped_date desc
  limit 1
) prev on true;
