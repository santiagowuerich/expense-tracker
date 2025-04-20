create table if not exists public.categorias (
  id      uuid primary key default uuid_generate_v4(),
  nombre  text unique not null
);

-- Desactivar RLS para permitir acceso público durante pruebas
alter table public.categorias disable row level security;

-- Asegurar que las tablas sean accesibles para todos
grant all on public.categorias to anon, authenticated;

-- Añadir columna categoria_id a productos
alter table public.productos
  add column if not exists categoria_id uuid references public.categorias(id);

-- Verificar si las tablas/columnas se crearon correctamente
select 'Tabla categorias existe' as resultado from pg_tables 
where schemaname = 'public' and tablename = 'categorias';

select 'Columna categoria_id añadida' as resultado from information_schema.columns 
where table_schema = 'public' and table_name = 'productos' and column_name = 'categoria_id';
