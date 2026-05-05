import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ error: "Relatorios foram removidos desta versao do sistema." }, { status: 410 })
}
