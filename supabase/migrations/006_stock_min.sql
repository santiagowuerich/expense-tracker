-- Añadir columna stock_min a la tabla productos
alter table public.productos
  add column if not exists stock_min int default 0;

-- Verificar si la columna se añadió correctamente
select 'Columna stock_min añadida' as resultado from information_schema.columns 
where table_schema = 'public' and table_name = 'productos' and column_name = 'stock_min';
