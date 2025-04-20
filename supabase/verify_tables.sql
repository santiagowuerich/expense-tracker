-- Verificar y crear las tablas necesarias si no existen

-- Extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de tarjetas
CREATE TABLE IF NOT EXISTS public.tarjetas (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alias      TEXT NOT NULL,
  cierre_dia INT  NOT NULL CHECK (cierre_dia BETWEEN 1 AND 31),
  venc_dia   INT  NOT NULL CHECK (venc_dia BETWEEN 1 AND 31),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de pagos
CREATE TABLE IF NOT EXISTS public.pagos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tarjeta_id   UUID REFERENCES public.tarjetas ON DELETE CASCADE,
  monto        DECIMAL(10,2) NOT NULL CHECK (monto > 0),
  fecha        DATE NOT NULL,
  descripcion  TEXT NOT NULL,
  ciclo_cierre DATE NOT NULL,
  cuotas       INT DEFAULT 1,
  cuota_actual INT DEFAULT 1,
  es_cuota     BOOLEAN DEFAULT FALSE,
  pago_original_id UUID REFERENCES public.pagos(id),
  created_at   TIMESTAMP DEFAULT NOW()
);

-- Desactivar RLS para permitir acceso público durante pruebas
ALTER TABLE public.tarjetas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos DISABLE ROW LEVEL SECURITY;

-- Asegurar que las tablas sean accesibles para todos
GRANT ALL ON public.tarjetas TO anon, authenticated;
GRANT ALL ON public.pagos TO anon, authenticated;

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_pagos_tarjeta_id ON public.pagos(tarjeta_id);
CREATE INDEX IF NOT EXISTS idx_pagos_original_id ON public.pagos(pago_original_id);

-- Verificar si las tablas se crearon correctamente
SELECT 'Tabla tarjetas existe' AS resultado FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tarjetas';
SELECT 'Tabla pagos existe' AS resultado FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pagos';
