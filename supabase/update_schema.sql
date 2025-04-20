-- Actualizar la tabla de pagos para soportar cuotas
ALTER TABLE public.pagos 
ADD COLUMN IF NOT EXISTS cuotas INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS cuota_actual INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS es_cuota BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pago_original_id UUID REFERENCES public.pagos(id);

-- Índice para mejorar el rendimiento de las consultas por tarjeta_id
CREATE INDEX IF NOT EXISTS idx_pagos_tarjeta_id ON public.pagos(tarjeta_id);

-- Índice para mejorar el rendimiento de las consultas por pago_original_id
CREATE INDEX IF NOT EXISTS idx_pagos_original_id ON public.pagos(pago_original_id);
