-- Extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de tarjetas
CREATE TABLE IF NOT EXISTS public.tarjetas (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  alias      TEXT NOT NULL,
  cierre_dia INT  NOT NULL CHECK (cierre_dia BETWEEN 1 AND 31),
  venc_dia   INT  NOT NULL CHECK (venc_dia BETWEEN 1 AND 31),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de pagos
CREATE TABLE IF NOT EXISTS public.pagos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tarjeta_id   UUID REFERENCES public.tarjetas(id) ON DELETE CASCADE,
  monto        DECIMAL(10,2) NOT NULL CHECK (monto >= 0),
  fecha        DATE NOT NULL,
  descripcion  TEXT NOT NULL,
  ciclo_cierre DATE NOT NULL,
  cuotas       INTEGER DEFAULT 1,
  cuota_actual INTEGER DEFAULT 1,
  es_cuota     BOOLEAN DEFAULT FALSE,
  pago_original_id UUID REFERENCES public.pagos(id),
  payment_intent_id TEXT UNIQUE,
  producto_id UUID REFERENCES public.productos(id),
  created_at   TIMESTAMP DEFAULT NOW()
);

-- Habilitar RLS y definir políticas
ALTER TABLE public.tarjetas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tarjetas_owner_policy_setup" ON public.tarjetas
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pagos_owner_policy_setup" ON public.pagos
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Asegurar que roles básicos tengan permisos a nivel de tabla (RLS filtrará filas)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarjetas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagos TO authenticated;
