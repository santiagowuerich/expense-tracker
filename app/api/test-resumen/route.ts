import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    message: "API funcionando correctamente",
    timestamp: new Date().toISOString(),
    success: true,
  })
}
