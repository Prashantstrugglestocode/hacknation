-- City Wallet — Menu scan + knowledge graph
create extension if not exists "uuid-ossp";

create table if not exists menu_items (
  id            uuid primary key default uuid_generate_v4(),
  merchant_id   uuid references merchants(id) on delete cascade,
  name          text not null,
  price_cents   int,
  category      text,             -- 'drink' | 'food' | 'dessert' | 'special'
  tags          text[] default '{}',
  active        boolean default true,
  source_photo  text,             -- supabase storage path or data url
  raw_extract   jsonb,
  created_at    timestamptz default now()
);
create index if not exists menu_items_merchant_idx on menu_items(merchant_id);

create table if not exists offer_item_links (
  offer_id      uuid references offers(id) on delete cascade,
  menu_item_id  uuid references menu_items(id) on delete cascade,
  primary key (offer_id, menu_item_id)
);
create index if not exists offer_item_links_item_idx on offer_item_links(menu_item_id);
