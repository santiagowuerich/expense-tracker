import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { v4 as uuidv4 } from "uuid"

// Función para descontar stock usando lógica LIFO
async function descontarStock(supabase: any, prodId: string, qty: number) {
  let pendiente = qty

  while (pendiente > 0) {
    const { data: compra, error } = await supabase
      .from("compras")
      .select("*")
      .eq("producto_id", prodId)
      .gt("restante", 0)
      .order("created_at", { ascending: false }) // LIFO
      .order("costo_unit", { ascending: false }) // tie-break
      .limit(1)
      .single()

    if (error || !compra) {
      throw new Error("Stock insuficiente")
    }

    const usar = Math.min(pendiente, compra.restante)

    const { error: updateError } = await supabase
      .from("compras")
      .update({ restante: compra.restante - usar })
      .eq("id", compra.id)

    if (updateError) {
      throw new Error("Error al actualizar el stock")
    }

    pendiente -= usar
  }

  // Sincronizar el stock del producto
  await supabase.rpc("update_stock_producto", { _prod_id: prodId })
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const data = await request.json()

    const {
      payment_method,
      tarjeta_id,
      monto,
      fecha,
      descripcion,
      producto_id,
      cantidad,
      en_cuotas,
      cuotas,
      payment_intent_id,
      tipo_transaccion,
    } = data

    // Validar datos básicos
    if (!payment_method || !monto || !fecha) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 })
    }

    // Validar método de pago
    if (!["tarjeta", "efectivo", "transferencia"].includes(payment_method)) {
      return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 })
    }

    // Validar tarjeta_id si el método es tarjeta
    if (payment_method === "tarjeta" && !tarjeta_id) {
      return NextResponse.json({ error: "Se requiere una tarjeta para pagos con tarjeta" }, { status: 400 })
    }

    // Validar tipo de transaccion
    if (!['gasto', 'ingreso'].includes(tipo_transaccion)) {
      return NextResponse.json({ error: "Tipo de transacción inválido" }, { status: 400 })
    }

    // Manejo del stock según el tipo de transacción
    if (producto_id && cantidad > 0) {
      if (tipo_transaccion === 'gasto') {
        // Verificar stock para gasto (solo para pago con tarjeta)
        if (payment_method === 'tarjeta') {
          const { data: producto, error: productoError } = await supabase
            .from('productos')
            .select('stock')
            .eq('id', producto_id)
            .single();

          if (productoError) {
            return NextResponse.json({ error: 'Error al verificar el producto' }, { status: 500 });
          }

          if (!producto || producto.stock < cantidad) {
            return NextResponse.json({ error: 'Stock insuficiente para este producto' }, { status: 400 });
          }
        }

        // Descontar stock usando lógica LIFO
        try {
          await descontarStock(supabase, producto_id, cantidad);
        } catch (error: any) {
          return NextResponse.json({ error: error.message || 'Error al descontar stock' }, { status: 500 });
        }
      } else if (tipo_transaccion === 'ingreso') {
        // Agregar stock directamente a la tabla de productos
        const { error: updateError } = await supabase
          .from('productos')
          .update({ stock: producto.stock + cantidad })
          .eq('id', producto_id);

        if (updateError) {
          return NextResponse.json({ error: 'Error al agregar stock' }, { status: 500 });
        }
      }
    }
    
    // Calcular ciclo de cierre si es tarjeta
    let ciclo_cierre = null
    if (payment_method === "tarjeta") {
      // Obtener información de la tarjeta para calcular el ciclo de cierre
      const { data: tarjeta, error: tarjetaError } = await supabase
        .from("tarjetas")
        .select("cierre_dia")
        .eq("id", tarjeta_id)
        .single()

      if (tarjetaError) {
        return NextResponse.json({ error: "Error al obtener información de la tarjeta" }, { status: 500 })
      }

      // Calcular el ciclo de cierre correctamente
      const fechaGasto = new Date(fecha)
      const corteActual = new Date(fechaGasto.getFullYear(), fechaGasto.getMonth(), tarjeta.cierre_dia)

      // Si la fecha del gasto es posterior al cierre actual, el ciclo es el del mes siguiente
      ciclo_cierre =
        fechaGasto > corteActual
          ? new Date(corteActual.getFullYear(), corteActual.getMonth() + 1, corteActual.getDate())
          : corteActual
    }

    // Determinar si es un pago único o en cuotas
    const esEnCuotas = payment_method === "tarjeta" && en_cuotas && cuotas > 1

    // Datos base para todos los pagos
    const pagoBase = {
      tarjeta_id: payment_method === "tarjeta" ? tarjeta_id : null,
      fecha,
      producto_id: producto_id || null,
      payment_intent_id,
      payment_method,
    }

    if (!esEnCuotas) {
      // Guardar como pago único
      const { error: pagoError } = await supabase.from("pagos").insert({
        ...pagoBase,
        monto,
        descripcion,
        ciclo_cierre: ciclo_cierre ? ciclo_cierre.toISOString() : null,
        cuotas: 1,
        cuota_actual: 1,
        es_cuota: false,
      })

      if (pagoError) {
        return NextResponse.json({ error: pagoError.message }, { status: 500 })
      }
    } else {
      // Solo guardar las cuotas individuales para evitar doble conteo
      const montoPorCuota = Number((monto / cuotas).toFixed(2))
      const cuotasArray = Array.from({ length: cuotas }, (_, i) => i + 1)

      // Crear un array de objetos para inserción masiva
      const cuotasInsert = cuotasArray.map((numeroCuota) => {
        // Calcular la fecha de cierre para esta cuota
        const fechaCuota = new Date(ciclo_cierre as Date)
        fechaCuota.setMonth(ciclo_cierre!.getMonth() + numeroCuota - 1)

        return {
          ...pagoBase,
          monto: montoPorCuota,
          descripcion: `${descripcion} (Cuota ${numeroCuota}/${cuotas})`,
          ciclo_cierre: fechaCuota.toISOString(),
          cuotas,
          cuota_actual: numeroCuota,
          es_cuota: true,
          pago_original_id: null, // No necesitamos esto ya que no guardamos el total
          payment_intent_id: `${payment_intent_id}-cuota-${numeroCuota}`,
        }
      })

      // Insertar todas las cuotas en una sola operación
      const { error: cuotasError } = await supabase.from("pagos").insert(cuotasInsert)

      if (cuotasError) {
        return NextResponse.json({ error: cuotasError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error al procesar la transacción:", error)
    return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 })
  }
}
