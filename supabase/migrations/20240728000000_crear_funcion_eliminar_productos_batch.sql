-- Función para eliminar múltiples productos por ID
CREATE OR REPLACE FUNCTION eliminar_productos_batch(
  _producto_ids UUID[]
) RETURNS TABLE(producto_id UUID, exito BOOLEAN, mensaje TEXT)
LANGUAGE plpgsql
SECURITY DEFINER -- Importante para permitir la eliminación si hay RLS, pero asegúrate de que solo usuarios autenticados/autorizados puedan llamarla desde el frontend/RPC.
AS $$
DECLARE
  _pid UUID;
  _producto_existe BOOLEAN;
  _error_message TEXT;
BEGIN
  -- Iterar a través de cada ID de producto
  FOREACH _pid IN ARRAY _producto_ids
  LOOP
    BEGIN
      -- Verificar si el producto existe
      SELECT EXISTS(SELECT 1 FROM productos WHERE id = _pid) INTO _producto_existe;

      IF NOT _producto_existe THEN
        producto_id := _pid;
        exito := FALSE;
        mensaje := '''El producto no existe.''';
        RETURN NEXT;
        CONTINUE;
      END IF;

      -- Intentar eliminar el producto
      -- NOTA: Si hay tablas que referencian `productos` con claves foráneas
      -- y no tienen `ON DELETE CASCADE` o `ON DELETE SET NULL`, esta operación fallará.
      -- Deberás manejar esas dependencias (ej. ventas_items si un producto está en una venta).
      -- Por ahora, asumimos que se puede eliminar o que las FKs lo permiten.
      -- Una opción más segura sería marcar los productos como "archivados" o "desactivados" en lugar de eliminarlos físicamente
      -- si tienen datos relacionados importantes.

      DELETE FROM productos WHERE id = _pid;

      producto_id := _pid;
      exito := TRUE;
      mensaje := '''Producto eliminado correctamente.''';
      RETURN NEXT;

    EXCEPTION
      WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS _error_message = MESSAGE_TEXT;
        producto_id := _pid;
        exito := FALSE;
        mensaje := '''Error: No se puede eliminar el producto porque está referenciado en otras tablas (ej. ventas). Detalles: ''' || _error_message;
        RETURN NEXT;
      WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS _error_message = MESSAGE_TEXT;
        producto_id := _pid;
        exito := FALSE;
        mensaje := '''Error inesperado al eliminar el producto: ''' || _error_message;
        RETURN NEXT;
    END;
  END LOOP;

  RETURN;
END;
$$;

-- Conceder permisos sobre la función (ajusta según tus políticas de seguridad)
-- Por lo general, para funciones llamadas desde el cliente, se usa `authenticated`
GRANT EXECUTE ON FUNCTION eliminar_productos_batch(UUID[]) TO authenticated;
-- Si necesitas que los usuarios anónimos también puedan (poco probable para esta función):
-- GRANT EXECUTE ON FUNCTION eliminar_productos_batch(UUID[]) TO anon; 