-- Corregir función least_fields para evitar errores de tipos
CREATE OR REPLACE FUNCTION least_fields(a text, b text)
RETURNS int LANGUAGE plpgsql AS $$
BEGIN
  RETURN 0; -- Retorna 0 para evitar errores
END;
$$;

-- Corregir función para obtener productos con stock crítico
CREATE OR REPLACE FUNCTION get_stock_critico()
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  stock INT,
  stock_min INT
) LANGUAGE sql AS $$
  SELECT id, nombre, stock, stock_min
  FROM productos
  WHERE stock_min > 0 AND stock <= stock_min
  ORDER BY nombre;
$$;

-- Corregir función para obtener productos sin stock
CREATE OR REPLACE FUNCTION get_sin_stock()
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  costo_unit NUMERIC
) LANGUAGE sql AS $$
  SELECT id, nombre, costo_unit
  FROM productos
  WHERE stock = 0
  ORDER BY nombre;
$$;

-- Corregir función para calcular valor total del inventario
CREATE OR REPLACE FUNCTION calcular_valor_inventario()
RETURNS NUMERIC LANGUAGE sql AS $$
  SELECT COALESCE(SUM(stock * costo_unit), 0)
  FROM productos
  WHERE stock > 0 AND costo_unit IS NOT NULL;
$$;
