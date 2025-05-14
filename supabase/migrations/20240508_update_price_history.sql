-- Añadir user_id a la tabla price_history
ALTER TABLE IF EXISTS price_history 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Agregar un valor por defecto para las filas existentes (opcional, si hay datos)
-- Esta parte podría fallar si no hay usuario admin definido
-- UPDATE price_history SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;

-- Añadir restricción NOT NULL una vez que se han actualizado los datos (opcional)
-- ALTER TABLE price_history ALTER COLUMN user_id SET NOT NULL;

-- Habilitar RLS para la tabla price_history
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para la tabla price_history
DROP POLICY IF EXISTS "Users can view their own price_history" ON price_history;
CREATE POLICY "Users can view their own price_history"
  ON price_history
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own price_history" ON price_history;
CREATE POLICY "Users can insert their own price_history"
  ON price_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own price_history" ON price_history;
CREATE POLICY "Users can update their own price_history"
  ON price_history
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own price_history" ON price_history;
CREATE POLICY "Users can delete their own price_history"
  ON price_history
  FOR DELETE
  USING (auth.uid() = user_id); 