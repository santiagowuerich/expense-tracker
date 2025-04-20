-- Añadir columna payment_method a la tabla pagos
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'tarjeta' CHECK (payment_method IN ('tarjeta', 'efectivo', 'transferencia'));

-- Actualizar registros existentes (todos se consideran como tarjeta)
UPDATE pagos SET payment_method = 'tarjeta' WHERE payment_method = 'tarjeta';

-- Eliminar el valor por defecto después de actualizar los registros existentes
ALTER TABLE pagos ALTER COLUMN payment_method DROP DEFAULT;
