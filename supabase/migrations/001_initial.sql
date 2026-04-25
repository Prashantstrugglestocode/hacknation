-- City Wallet schema
-- RLS is off for hackathon scope

create extension if not exists "uuid-ossp";

create table if not exists merchants (
  id              uuid primary key default uuid_generate_v4(),
  owner_device_id text not null,
  name            text not null,
  type            text not null,
  lat             double precision not null,
  lng             double precision not null,
  geohash6        text not null,
  goal            text not null default 'fill_quiet_hours',
  max_discount_pct int not null default 15,
  time_windows    text[] default '{}',
  inventory_tags  text[] default '{}',
  locale          text not null default 'de',
  created_at      timestamptz default now()
);

create index if not exists merchants_geohash6_idx on merchants(geohash6);

create table if not exists offers (
  id                    uuid primary key default uuid_generate_v4(),
  merchant_id           uuid references merchants(id),
  customer_device_hash  text not null,
  widget_spec           jsonb not null,
  context_state         jsonb not null default '{}',
  status                text not null default 'shown',
  discount_amount_cents int,
  redemption_kind       text default 'qr',
  generated_at          timestamptz default now(),
  expires_at            timestamptz
);

create index if not exists offers_merchant_id_idx on offers(merchant_id);
create index if not exists offers_device_hash_idx on offers(customer_device_hash);
create index if not exists offers_generated_at_idx on offers(generated_at);

create table if not exists redemptions (
  id          uuid primary key default uuid_generate_v4(),
  offer_id    uuid references offers(id),
  token_jti   text,
  redeemed_at timestamptz default now()
);

create unique index if not exists redemptions_offer_id_unique on redemptions(offer_id);

-- Supabase Realtime: enable broadcast on the realtime schema
-- Run these in the Supabase dashboard SQL editor:
-- alter publication supabase_realtime add table merchants;
-- alter publication supabase_realtime add table offers;
