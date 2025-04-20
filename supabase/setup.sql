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
  created_at   TIMESTAMP DEFAULT NOW()
);

-- Desactivar RLS para permitir acceso público durante pruebas
ALTER TABLE public.tarjetas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos DISABLE ROW LEVEL SECURITY;

-- Asegurar que las tablas sean accesibles para todos
GRANT ALL ON public.tarjetas TO anon, authenticated;
GRANT ALL ON public.pagos TO anon, authenticated;
