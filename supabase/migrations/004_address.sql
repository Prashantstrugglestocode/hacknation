-- Persist a human-readable address per merchant.
-- Without this the merchant-settings UI keeps "forgetting" the typed address
-- and falling back to "lat, lng" coordinates after every save.

alter table merchants
  add column if not exists address text;
