-- Run this in your Supabase SQL editor
-- Creates the subscribers table that tracks paid users

create table if not exists subscribers (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive',
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast email lookups (happens on every Pro API call)
create index if not exists subscribers_email_idx on subscribers(email);

-- Index for status checks
create index if not exists subscribers_status_idx on subscribers(status);

-- Row level security (only service role can write)
alter table subscribers enable row level security;

create policy "Service role full access" on subscribers
  using (true)
  with check (true);
