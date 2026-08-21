-- Run in the Supabase SQL Editor before enabling owner listings in js/config.js.
create table if not exists public.seller_listings (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 100),
  phone text not null check (char_length(phone) between 5 and 25),
  address text not null check (char_length(address) between 5 and 250),
  category text,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  is_active boolean not null default true,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.seller_listings enable row level security;

create policy "Anyone can read active listings"
  on public.seller_listings for select
  using (is_active = true);

create policy "Anyone can submit a bounded listing"
  on public.seller_listings for insert
  with check (
    is_active = true
    and char_length(name) between 2 and 100
    and char_length(phone) between 5 and 25
    and char_length(address) between 5 and 250
    and lat between -90 and 90
    and lon between -180 and 180
  );

-- Do not add anonymous update/delete policies. Admins can review listings
-- in Supabase and set verified=true or is_active=false.
