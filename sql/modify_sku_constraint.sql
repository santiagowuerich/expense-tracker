-- Eliminar la restricción única existente en el campo SKU
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_sku_key;

-- Crear una nueva restricción única compuesta (SKU + user_id)
-- Esto permitirá tener SKUs duplicados entre diferentes usuarios, pero no para el mismo usuario
ALTER TABLE productos 
  ADD CONSTRAINT productos_sku_user_id_key 
  UNIQUE (sku, user_id) 
  WHERE sku IS NOT NULL; -- Solo aplicar a registros con SKU no nulo 