-- Migración: Añadir función para eliminar múltiples ventas con cualquier método de pago

-- Función para eliminar múltiples ventas por ID sin verificación de método de pago
CREATE OR REPLACE FUNCTION eliminar_ventas_batch(
  _venta_ids UUID[]
) RETURNS TABLE(venta_id UUID, exito BOOLEAN, mensaje TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _venta_id UUID;
  _venta_existe BOOLEAN;
  _item RECORD;
BEGIN
  -- Iterar a través de cada ID de venta
  FOREACH _venta_id IN ARRAY _venta_ids
  LOOP
    BEGIN
      -- Verificar si la venta existe
      SELECT EXISTS(SELECT 1 FROM ventas WHERE id = _venta_id) INTO _venta_existe;
      
      IF NOT _venta_existe THEN
        venta_id := _venta_id;
        exito := FALSE;
        mensaje := 'La venta no existe';
        RETURN NEXT;
        CONTINUE;
      END IF;
      
      -- Recuperar el stock de productos
      FOR _item IN (
        SELECT vi.producto_id, vi.cantidad
        FROM ventas_items vi
        WHERE vi.venta_id = _venta_id
      ) LOOP
        -- Actualizar el stock de los productos
        UPDATE productos 
        SET stock = stock + _item.cantidad 
        WHERE id = _item.producto_id;
      END LOOP;
      
      -- Eliminar la venta (las tablas relacionadas se eliminarán en cascada)
      DELETE FROM ventas WHERE id = _venta_id;
      
      venta_id := _venta_id;
      exito := TRUE;
      mensaje := 'Venta eliminada correctamente';
      RETURN NEXT;
      
    EXCEPTION
      WHEN OTHERS THEN
        venta_id := _venta_id;
        exito := FALSE;
        mensaje := 'Error: ' || SQLERRM;
        RETURN NEXT;
    END;
  END LOOP;
  
  RETURN;
END;
$$;

-- Conceder permisos sobre la función
GRANT EXECUTE ON FUNCTION eliminar_ventas_batch TO authenticated, anon; 