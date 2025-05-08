-- Migración: Añadir función para eliminar múltiples pagos en lote

-- Función para eliminar múltiples pagos por ID
CREATE OR REPLACE FUNCTION eliminar_pagos_batch(
  _pago_ids UUID[]
) RETURNS TABLE(pago_id UUID, exito BOOLEAN, mensaje TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _pago_id UUID;
  _pago_existe BOOLEAN;
  _es_pago_original BOOLEAN;
  _tiene_cuotas BOOLEAN;
  _compra_id UUID;
  _producto_id UUID;
  _cantidad_original INT;
BEGIN
  -- Iterar a través de cada ID de pago
  FOREACH _pago_id IN ARRAY _pago_ids
  LOOP
    BEGIN
      -- Verificar si el pago existe
      SELECT EXISTS(SELECT 1 FROM pagos WHERE id = _pago_id) INTO _pago_existe;
      
      IF NOT _pago_existe THEN
        pago_id := _pago_id;
        exito := FALSE;
        mensaje := 'El pago no existe';
        RETURN NEXT;
        CONTINUE;
      END IF;
      
      -- Verificar si el pago tiene cuotas asociadas (es un pago original)
      SELECT EXISTS(SELECT 1 FROM pagos WHERE pago_original_id = _pago_id) INTO _tiene_cuotas;
      
      -- Verificar si es una cuota de otro pago
      SELECT pago_original_id IS NOT NULL INTO _es_pago_original FROM pagos WHERE id = _pago_id;
      
      -- Comprobar si el pago está asociado a una compra de producto
      SELECT compra_id, producto_id INTO _compra_id, _producto_id FROM pagos WHERE id = _pago_id;
      
      -- Si es un pago original y tiene cuotas, eliminar tanto el pago como todas sus cuotas
      IF _tiene_cuotas THEN
        -- Eliminar todas las cuotas asociadas (esto no afectará productos/compras)
        DELETE FROM pagos WHERE pago_original_id = _pago_id;
        
        -- El mensaje incluirá información sobre las cuotas eliminadas
        mensaje := 'Pago y sus cuotas eliminados correctamente';
      ELSE
        mensaje := 'Pago eliminado correctamente';
      END IF;
      
      -- Eliminar el pago principal
      DELETE FROM pagos WHERE id = _pago_id;
      
      pago_id := _pago_id;
      exito := TRUE;
      RETURN NEXT;
      
    EXCEPTION
      WHEN OTHERS THEN
        pago_id := _pago_id;
        exito := FALSE;
        mensaje := 'Error: ' || SQLERRM;
        RETURN NEXT;
    END;
  END LOOP;
  
  RETURN;
END;
$$;

-- Conceder permisos sobre la función
GRANT EXECUTE ON FUNCTION eliminar_pagos_batch TO authenticated, anon; 