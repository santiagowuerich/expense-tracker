"use client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

// Datos de ejemplo - en una implementación real, estos vendrían de la API
const mockData = [
  { tarjeta: "Visa", monto: 1250.75 },
  { tarjeta: "Mastercard", monto: 875.3 },
  { tarjeta: "American Express", monto: 2340.0 },
]

export default function ExpenseSummary() {
  // En una implementación real, usaríamos React Query:
  // const { data, isLoading, error } = useQuery('resumen', fetchResumen)

  const total = mockData.reduce((sum, item) => sum + item.monto, 0)

  return (
    <div className="space-y-6">
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={mockData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="tarjeta" />
            <YAxis />
            <Tooltip formatter={(value) => [`$${value}`, "Monto"]} />
            <Bar dataKey="monto" fill="#8b5cf6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tarjeta</TableHead>
            <TableHead className="text-right">Monto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mockData.map((item) => (
            <TableRow key={item.tarjeta}>
              <TableCell>{item.tarjeta}</TableCell>
              <TableCell className="text-right">${item.monto.toFixed(2)}</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="font-bold">Total</TableCell>
            <TableCell className="text-right font-bold">${total.toFixed(2)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
