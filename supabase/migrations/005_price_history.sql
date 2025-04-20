create table if not exists public.price_history (
  id          uuid primary key default uuid_generate_v4(),
  producto_id uuid references public.productos(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  tipo        text check (tipo in ('costo','venta')),
  precio      numeric(10,2) not null,
  compra_id   uuid references public.compras(id),
  created_at  timestamp default now()
);

-- Desactivar RLS para permitir acceso público durante pruebas
alter table public.price_history disable row level security;

-- Asegurar que las tablas sean accesibles para todos
grant all on public.price_history to anon, authenticated;

-- Verificar si la tabla se creó correctamente
select 'Tabla price_history existe' as resultado from pg_tables 
where schemaname = 'public' and tablename = 'price_history';
