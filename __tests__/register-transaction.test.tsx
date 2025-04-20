import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import RegisterTransactionDialog from "@/components/register-transaction-dialog"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi } from "vitest"

// Mock de fetch para simular la respuesta de la API
global.fetch = vi.fn()

// Mock de los hooks y componentes necesarios
vi.mock("@/lib/supabase-browser", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { cierre_dia: 15 },
            error: null,
          })),
        })),
        order: vi.fn(() => ({
          data: [
            { id: "1", alias: "Visa" },
            { id: "2", alias: "Mastercard" },
          ],
          error: null,
        })),
      })),
    })),
  })),
}))

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

vi.mock("@/lib/queries", () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
  },
}))

describe("RegisterTransactionDialog", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    // Reset mocks
    vi.clearAllMocks()

    // Mock fetch response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
  })

  it("renders the dialog when triggered", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <RegisterTransactionDialog>
          <button>Open Dialog</button>
        </RegisterTransactionDialog>
      </QueryClientProvider>,
    )

    // Dialog should be closed initially
    expect(screen.queryByText("Registrar Transacción")).not.toBeInTheDocument()

    // Open dialog
    fireEvent.click(screen.getByText("Open Dialog"))

    // Dialog should be open
    expect(screen.getByText("Registrar Transacción")).toBeInTheDocument()
  })

  it("shows tarjeta field only when payment method is tarjeta", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <RegisterTransactionDialog>
          <button>Open Dialog</button>
        </RegisterTransactionDialog>
      </QueryClientProvider>,
    )

    // Open dialog
    fireEvent.click(screen.getByText("Open Dialog"))

    // Tarjeta field should be visible initially (default is tarjeta)
    expect(screen.getByText("Tarjeta")).toBeInTheDocument()

    // Change payment method to efectivo
    fireEvent.click(screen.getByText("Tarjeta"))
    fireEvent.click(screen.getByText("Efectivo"))

    // Tarjeta field should not be visible
    expect(screen.queryByText("Tarjeta")).not.toBeInTheDocument()

    // Change payment method back to tarjeta
    fireEvent.click(screen.getByText("Efectivo"))
    fireEvent.click(screen.getByText("Tarjeta"))

    // Tarjeta field should be visible again
    expect(screen.getByText("Tarjeta")).toBeInTheDocument()
  })

  it("submits the form with correct data", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <RegisterTransactionDialog>
          <button>Open Dialog</button>
        </RegisterTransactionDialog>
      </QueryClientProvider>,
    )

    // Open dialog
    fireEvent.click(screen.getByText("Open Dialog"))

    // Fill the form
    fireEvent.click(screen.getByText("Tarjeta"))
    fireEvent.click(screen.getByText("Tarjeta")) // Select tarjeta as payment method

    // Select a tarjeta
    fireEvent.click(screen.getByRole("combobox", { name: /tarjeta/i }))
    fireEvent.click(screen.getByText("Visa"))

    // Enter monto
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "100.50" } })

    // Enter descripcion
    fireEvent.change(screen.getByPlaceholderText("Descripción (opcional)"), { target: { value: "Test transaction" } })

    // Submit form
    fireEvent.click(screen.getByText("Registrar Transacción"))

    // Check if fetch was called with correct data
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/register-transaction",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: expect.stringContaining('"payment_method":"tarjeta"'),
        }),
      )
    })

    const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body)
    expect(requestBody).toMatchObject({
      payment_method: "tarjeta",
      tarjeta_id: "1", // Visa
      monto: 100.5,
      descripcion: "Test transaction",
      en_cuotas: false,
      cuotas: 1,
    })
  })
})
