"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Loader2, Phone, Mail, MapPin, Plus, ShoppingCart } from "lucide-react";

import { useClientes } from "@/hooks/useClientes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import ClienteVentasDialog from "@/components/cliente-ventas-dialog";
import { Cliente } from "@/types/venta";
import { RealizarVentaButton } from "@/components/ventas/RealizarVentaButton";

export default function ClientesPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState<string>("");
  
  const { data: clientes, isLoading, error } = useClientes(searchTerm);
  
  // Estado para controlar el diálogo de compras
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [dialogoComprasAbierto, setDialogoComprasAbierto] = useState(false);

  const mostrarComprasCliente = (cliente: Cliente) => {
    setClienteSeleccionado(cliente);
    setDialogoComprasAbierto(true);
  };

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/ventas')}
            className="mr-2 sm:mr-4 h-9 w-9 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5"
            aria-label="Volver a ventas"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden sm:inline ml-2">Volver</span>
          </Button>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary truncate">Directorio de Clientes</h1>
        </div>
      </div>

      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <Input
          type="search"
          placeholder="Buscar por nombre o CUIT/DNI..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full sm:w-80 lg:w-96"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
          <p>Error al cargar los clientes: {error instanceof Error ? error.message : String(error)}</p>
        </div>
      ) : !clientes || clientes.length === 0 ? (
        <EmptyState
          title="No se encontraron clientes"
          description={
            searchTerm 
              ? "No hay clientes que coincidan con tu búsqueda." 
              : "No hay clientes registrados en el sistema."
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientes.map((cliente) => (
            <Card key={cliente.id} className="overflow-hidden hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-4">
                <h2 className="text-lg font-semibold mb-1 truncate" title={cliente.nombre}>
                  {cliente.nombre}
                </h2>
                <p className="text-sm text-muted-foreground mb-3 truncate">
                  {cliente.dni_cuit}
                </p>
                <div className="space-y-2">
                  {cliente.telefono && (
                    <div className="flex items-center text-sm">
                      <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>{cliente.telefono}</span>
                    </div>
                  )}
                  {cliente.email && (
                    <div className="flex items-center text-sm">
                      <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="truncate">{cliente.email}</span>
                    </div>
                  )}
                  {cliente.direccion && (
                    <div className="flex items-start text-sm">
                      <MapPin className="h-4 w-4 mr-2 text-muted-foreground mt-0.5" />
                      <span className="truncate">
                        {cliente.direccion}
                        {cliente.ciudad && `, ${cliente.ciudad}`}
                        {cliente.codigo_postal && ` (${cliente.codigo_postal})`}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t border-border space-y-2">
                  <RealizarVentaButton 
                    clienteId={cliente.id} 
                    className="w-full"
                  />
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="w-full"
                    onClick={() => mostrarComprasCliente(cliente)}
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Ver compras asociadas
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Diálogo para mostrar las compras del cliente */}
      {clienteSeleccionado && (
        <ClienteVentasDialog 
          cliente={clienteSeleccionado}
          open={dialogoComprasAbierto}
          onOpenChange={setDialogoComprasAbierto}
        />
      )}
    </div>
  );
} 