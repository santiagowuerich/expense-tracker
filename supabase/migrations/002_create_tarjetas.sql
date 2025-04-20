create extension if not exists "uuid-ossp";

create table if not exists public.tarjetas (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users on delete cascade,
  alias      text not null,
  cierre_dia int  not null check (cierre_dia between 1 and 31),
  venc_dia   int  not null check (venc_dia between 1 and 31),
  created_at timestamp default now()
);

/* RLS */
alter table public.tarjetas enable row level security;
create policy "tarjetas_owner" on public.tarjetas
  using (auth.uid() = user_id);
