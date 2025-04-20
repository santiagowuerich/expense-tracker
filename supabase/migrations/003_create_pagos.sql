create table if not exists public.pagos (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users on delete cascade,
  tarjeta_id   uuid references public.tarjetas on delete cascade,
  monto        decimal(10,2) not null check (monto > 0),
  fecha        date not null,
  descripcion  text not null,
  ciclo_cierre date not null,
  created_at   timestamp default now()
);

/* RLS */
alter table public.pagos enable row level security;
create policy "pagos_owner" on public.pagos
  using (auth.uid() = user_id);
