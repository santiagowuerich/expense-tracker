-- Añadir columna compra_id a la tabla pagos
ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS compra_id UUID REFERENCES public.compras(id);

-- Crear índice para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_pagos_compra_id ON public.pagos(compra_id);

-- Verificar si la columna se añadió correctamente
SELECT 'Columna compra_id añadida a pagos' AS resultado FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'pagos' AND column_name = 'compra_id';
