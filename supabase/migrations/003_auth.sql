-- City Wallet — Auth + profiles
-- Run AFTER enabling Email auth in Supabase dashboard
-- (Authentication → Providers → Email → Enable; disable "Confirm email" for hackathon speed)

create table if not exists profiles (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  display_name            text,
  preferred_role          text,           -- 'customer' | 'merchant'
  first_login_completed   boolean default false,
  locale                  text default 'de',
  created_at              timestamptz default now()
);

-- Auto-create a profile row whenever a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, locale)
  values (new.id, coalesce(new.raw_user_meta_data->>'locale', 'de'))
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Allow users to read/update their own profile via the publishable key
alter table profiles enable row level security;

drop policy if exists "Users read own profile"   on profiles;
drop policy if exists "Users update own profile" on profiles;

create policy "Users read own profile"
  on profiles for select using (auth.uid() = user_id);
create policy "Users update own profile"
  on profiles for update using (auth.uid() = user_id);
