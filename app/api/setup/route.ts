import { NextResponse } from 'next/server'
import { getDatabaseType } from '@/lib/db'
import { getSetupStatus, setupDatabase } from '@/lib/repositories'

export async function GET() {
  try {
    const status = await getSetupStatus()

    return NextResponse.json({
      configured: status.configured,
      dbType: status.dbType,
      existingTables: status.existingTables,
      missingTables: status.missingTables,
      setupScript: status.setupScript,
    })
  } catch (error) {
    return NextResponse.json(
      {
        configured: false,
        dbType: getDatabaseType(),
        error: 'Erro ao verificar banco de dados.',
        details: error instanceof Error ? error.message : 'Erro desconhecido.',
      },
      { status: 500 },
    )
  }
}

export async function POST() {
  try {
    const result = await setupDatabase()

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      dbType: result.dbType,
      message:
        result.dbType === 'mysql'
          ? 'Banco MySQL configurado com sucesso.'
          : 'Conexão com Supabase validada com sucesso.',
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        dbType: getDatabaseType(),
        error: 'Erro ao configurar banco de dados.',
        details: error instanceof Error ? error.message : 'Erro desconhecido.',
      },
      { status: 500 },
    )
  }
}
