-- Función para calcular el valor total del inventario
create or replace function calcular_valor_inventario()
returns numeric language sql as $$
  select coalesce(sum(stock * costo_unit), 0)
  from public.productos
  where stock > 0 and costo_unit is not null;
$$;

-- Función para actualizar el stock de un producto basado en las compras
create or replace function update_stock_producto(_prod_id uuid)
returns void language plpgsql as $$
begin
  update public.productos
  set stock = coalesce(
      (select sum(restante) from public.compras where producto_id = _prod_id),0)
  where id = _prod_id;
end;
$$;

-- Función auxiliar para comparar campos
create or replace function least_fields(a text, b text)
returns int language plpgsql as $$
begin
  return (select least(
    (select (r->>'stock')::int from (select row_to_json(productos) as r from productos where id = current_setting('request.jwt.claims')::json->>'sub') t),
    (select (r->>'stock_min')::int from (select row_to_json(productos) as r from productos where id = current_setting('request.jwt.claims')::json->>'sub') t)
  ));
exception
  when others then
    return 0;
end;
$$;
