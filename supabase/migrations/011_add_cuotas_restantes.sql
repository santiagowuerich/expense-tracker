-- Añadir columna cuotas_restantes a la tabla pagos si no existe
ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS cuotas_restantes INT GENERATED ALWAYS AS (cuotas - cuota_actual) STORED;

-- Verificar si la columna se añadió correctamente
SELECT 'Columna cuotas_restantes añadida a pagos' AS resultado FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'pagos' AND column_name = 'cuotas_restantes';
