"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea'; // Para las notas
import { useToast } from '@/components/ui/use-toast';
import { createClient } from '@/lib/supabase-browser';
import { queryClient } from '@/lib/queries'; // Import queryClient
import type { ProductoInventario, AjusteStockFormValues, TipoMovimientoStock } from '@/types/inventario.types';

// Esquema de validación con Zod
const ajusteStockSchema = z.object({
  producto_id: z.string().uuid({ message: 'ID de producto no válido.' }),
  tipo_movimiento: z.enum([
    'stock_inicial',
    'entrada_compra',
    'ajuste_manual_positivo',
    'ajuste_manual_negativo',
    'devolucion_cliente',
    'perdida_rotura',
    // 'salida_venta' no se manejaría manualmente desde aquí usualmente
  ], { required_error: 'Debe seleccionar un tipo de movimiento.' }),
  cantidad: z.coerce
    .number({ invalid_type_error: 'La cantidad debe ser un número.' })
    .int({ message: 'La cantidad debe ser un número entero.' })
    .positive({ message: 'La cantidad debe ser un número positivo.' })
    .min(1, { message: 'La cantidad debe ser al menos 1.' }),
  notas: z.string().optional(),
});

interface AjusteStockModalProps {
  producto: ProductoInventario | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void; // Callback opcional al tener éxito
}

const tiposDeMovimientoManual: { value: AjusteStockFormValues['tipo_movimiento']; label: string }[] = [
  { value: 'ajuste_manual_positivo', label: 'Ajuste Manual: Entrada (+)' },
  { value: 'ajuste_manual_negativo', label: 'Ajuste Manual: Salida (-)' },
  { value: 'entrada_compra', label: 'Entrada por Compra' },
  { value: 'perdida_rotura', label: 'Pérdida / Rotura' },
  { value: 'devolucion_cliente', label: 'Devolución de Cliente' },
  { value: 'stock_inicial', label: 'Stock Inicial' },
];

export default function AjusteStockModal({
  producto,
  open,
  onOpenChange,
  onSuccess,
}: AjusteStockModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof ajusteStockSchema>>({
    resolver: zodResolver(ajusteStockSchema),
    defaultValues: {
      producto_id: producto?.id || '',
      tipo_movimiento: undefined,
      cantidad: 0,
      notas: '',
    },
  });

  useEffect(() => {
    if (producto) {
      form.reset({
        producto_id: producto.id,
        tipo_movimiento: undefined,
        cantidad: 0,
        notas: '',
      });
    }
  }, [producto, form, open]); // Resetear el form cuando el producto cambia o el modal se abre

  const onSubmit = async (values: z.infer<typeof ajusteStockSchema>) => {
    if (!producto) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se ha seleccionado ningún producto.' });
      return;
    }
    setIsSubmitting(true);

    let cantidadMovimiento = values.cantidad;
    // La función de BD espera cantidad negativa para salidas
    if (values.tipo_movimiento === 'ajuste_manual_negativo' || values.tipo_movimiento === 'perdida_rotura') {
      cantidadMovimiento = -Math.abs(values.cantidad);
    }

    try {
      const supabase = createClient();
      const { data, error, status } = await supabase.rpc('registrar_movimiento_stock', {
        p_producto_id: values.producto_id,
        p_tipo_movimiento: values.tipo_movimiento,
        p_cantidad_movimiento: cantidadMovimiento,
        p_notas: values.notas || null,
        // p_referencia_id: null, // Podríamos añadirlo si es necesario
      });

      if (error || (status !== 200 && !data?.[0]?.movimiento_id) ) { // Chequeo más robusto
        console.error('Error RPC registrar_movimiento_stock:', error, data);
        const errorMessage = (data as any)?.[0]?.mensaje || error?.message || 'Ocurrió un error desconocido.';
        toast({
          variant: 'destructive',
          title: 'Error al ajustar stock',
          description: errorMessage,
        });
      } else {
        toast({
          title: 'Stock Ajustado',
          description: `El stock de ${producto.nombre} ha sido actualizado. Nuevo stock: ${data[0]?.nuevo_stock_calculado ?? 'N/A'}`,
        });
        // Invalidar queries para refrescar datos
        await queryClient.invalidateQueries({ queryKey: ['productos'] });
        await queryClient.invalidateQueries({ queryKey: ['producto-details', producto.id] }); // Si tienes un query para detalles individuales
        await queryClient.invalidateQueries({ queryKey: ['movimientos_stock', producto.id] });
        
        form.reset();
        onOpenChange(false); // Cerrar el modal
        if (onSuccess) onSuccess();
      }
    } catch (e: any) {
      console.error('Excepción en onSubmit de AjusteStockModal:', e);
      toast({
        variant: 'destructive',
        title: 'Error Inesperado',
        description: e.message || 'Ocurrió una excepción al procesar la solicitud.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null; // No renderizar si no está abierto para asegurar el reset del form

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Ajustar Stock de: {producto?.nombre || 'Producto'}</DialogTitle>
          <DialogDescription>
            Modifica la cantidad de stock para el producto seleccionado. El stock actual es: {producto?.stock ?? 'N/A'}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* producto_id está oculto o no se muestra ya que viene del producto seleccionado */}
            <input type="hidden" {...form.register('producto_id')} />

            <FormField
              control={form.control}
              name="tipo_movimiento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Movimiento</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un tipo..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {tiposDeMovimientoManual.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cantidad"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cantidad</FormLabel>
                  <FormControl>
                    <Input 
                      type="text" 
                      inputMode="numeric"
                      placeholder="Ej: 10" 
                      {...field} 
                      onChange={event => {
                        const value = event.target.value;
                        if (value === '' || /^[0-9]+$/.test(value)) {
                          field.onChange(value === '' ? '' : Number(value)); 
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      onWheel={(event) => (event.target as HTMLElement).blur()}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Ej: Conteo anual de inventario" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar Ajuste'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 