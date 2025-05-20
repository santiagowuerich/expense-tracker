CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- Asegurar que la extensión exista

create table if not exists public.productos (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null, -- Añadir user_id
  nombre      text not null,
  sku         text, -- Eliminar UNIQUE de aquí
  stock       int  default 0,
  costo_unit  numeric(10,2),          -- precio al que lo compras
  precio_unit numeric(10,2),          -- precio de venta (opcional)
  created_at  timestamp default now(),
  constraint productos_user_id_sku_key unique (user_id, sku) -- Nueva restricción compuesta
);

-- Habilitar RLS
alter table public.productos enable row level security;

-- Política para que los usuarios puedan ver y gestionar sus propios productos
create policy "Productos: Acceso total para propietarios"
  on public.productos for all
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

-- Permisos básicos para usuarios autenticados (RLS se encargará del filtrado por fila)
grant select, insert, update, delete on public.productos to authenticated;
-- Revocar permisos excesivos si existían de antes (opcional, pero buena práctica)
-- grant all on public.productos to anon, authenticated; -- Esto se reemplaza por el anterior

-- vincular pagos con productos (nullable)
alter table public.pagos
  add column if not exists producto_id uuid references public.productos(id);

-- Crear índice para mejorar el rendimiento
create index if not exists idx_pagos_producto_id on public.pagos(producto_id);

-- Crear índices para user_id y sku para optimizar la búsqueda y la restricción unique
create index if not exists idx_productos_user_id on public.productos(user_id);
create index if not exists idx_productos_user_id_sku on public.productos(user_id, sku);
