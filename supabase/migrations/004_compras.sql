-- Extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de compras (sin referencia a auth.users)
CREATE TABLE IF NOT EXISTS public.compras (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id UUID REFERENCES public.productos(id) ON DELETE CASCADE,
  costo_unit  NUMERIC(10,2) NOT NULL,
  cantidad    INT NOT NULL CHECK (cantidad > 0),
  restante    INT NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Desactivar RLS para permitir acceso público durante pruebas
ALTER TABLE public.compras DISABLE ROW LEVEL SECURITY;

-- Asegurar que las tablas sean accesibles para todos
GRANT ALL ON public.compras TO anon, authenticated;

-- Añadir columna payment_intent_id a pagos si no existe
ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS payment_intent_id TEXT UNIQUE;

-- Verificar si las tablas se crearon correctamente
SELECT 'Tabla compras existe' AS resultado FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'compras';
