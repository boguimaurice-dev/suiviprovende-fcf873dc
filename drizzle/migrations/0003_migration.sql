create table public.paystack_payments (
  reference text primary key,
  user_id uuid not null,
  months integer not null,
  amount integer not null,
  created_at timestamptz not null default now()
);
alter table public.paystack_payments enable row level security;
grant all on public.paystack_payments to service_role;
-- no policies: only server (service role) accesses this table