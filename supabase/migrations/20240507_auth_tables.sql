-- Creación de la tabla de perfiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar la extensión pgcrypto si no está habilitada
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Función para actualizar el timestamp de última actualización
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar el timestamp en perfiles
DROP TRIGGER IF EXISTS set_profiles_updated_at ON profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Políticas de seguridad (RLS) para la tabla de perfiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Política para permitir a los usuarios ver solo su propio perfil
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Política para permitir a los usuarios actualizar solo su propio perfil
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Modificar la tabla de gastos (si existe) para incluir el user_id
ALTER TABLE IF EXISTS gastos 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Modificar la tabla de productos (si existe) para incluir el user_id
ALTER TABLE IF EXISTS productos 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Modificar la tabla de ventas (si existe) para incluir el user_id
ALTER TABLE IF EXISTS ventas 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Modificar la tabla de pagos (si existe) para incluir el user_id
ALTER TABLE IF EXISTS pagos 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Políticas de seguridad para la tabla de gastos (si existe)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'gastos') THEN
    ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view their own gastos" ON gastos;
    CREATE POLICY "Users can view their own gastos"
      ON gastos
      FOR SELECT
      USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can insert their own gastos" ON gastos;
    CREATE POLICY "Users can insert their own gastos"
      ON gastos
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can update their own gastos" ON gastos;
    CREATE POLICY "Users can update their own gastos"
      ON gastos
      FOR UPDATE
      USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can delete their own gastos" ON gastos;
    CREATE POLICY "Users can delete their own gastos"
      ON gastos
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Políticas de seguridad para la tabla de productos (si existe)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'productos') THEN
    ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view their own productos" ON productos;
    CREATE POLICY "Users can view their own productos"
      ON productos
      FOR SELECT
      USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can insert their own productos" ON productos;
    CREATE POLICY "Users can insert their own productos"
      ON productos
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can update their own productos" ON productos;
    CREATE POLICY "Users can update their own productos"
      ON productos
      FOR UPDATE
      USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can delete their own productos" ON productos;
    CREATE POLICY "Users can delete their own productos"
      ON productos
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Políticas de seguridad para la tabla de ventas (si existe)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ventas') THEN
    ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view their own ventas" ON ventas;
    CREATE POLICY "Users can view their own ventas"
      ON ventas
      FOR SELECT
      USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can insert their own ventas" ON ventas;
    CREATE POLICY "Users can insert their own ventas"
      ON ventas
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can update their own ventas" ON ventas;
    CREATE POLICY "Users can update their own ventas"
      ON ventas
      FOR UPDATE
      USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can delete their own ventas" ON ventas;
    CREATE POLICY "Users can delete their own ventas"
      ON ventas
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Políticas de seguridad para la tabla de pagos (si existe)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pagos') THEN
    ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view their own pagos" ON pagos;
    CREATE POLICY "Users can view their own pagos"
      ON pagos
      FOR SELECT
      USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can insert their own pagos" ON pagos;
    CREATE POLICY "Users can insert their own pagos"
      ON pagos
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can update their own pagos" ON pagos;
    CREATE POLICY "Users can update their own pagos"
      ON pagos
      FOR UPDATE
      USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can delete their own pagos" ON pagos;
    CREATE POLICY "Users can delete their own pagos"
      ON pagos
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$; 