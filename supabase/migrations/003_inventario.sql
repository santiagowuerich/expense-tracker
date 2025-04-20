create table if not exists public.productos (
  id          uuid primary key default uuid_generate_v4(),
  nombre      text not null,
  sku         text unique,
  stock       int  default 0,
  costo_unit  numeric(10,2),          -- precio al que lo compras
  precio_unit numeric(10,2),          -- precio de venta (opcional)
  created_at  timestamp default now()
);

-- Desactivar RLS para permitir acceso público durante pruebas
alter table public.productos disable row level security;

-- Asegurar que las tablas sean accesibles para todos
grant all on public.productos to anon, authenticated;

-- vincular pagos con productos (nullable)
alter table public.pagos
  add column if not exists producto_id uuid references public.productos(id);

-- Crear índice para mejorar el rendimiento
create index if not exists idx_pagos_producto_id on public.pagos(producto_id);
