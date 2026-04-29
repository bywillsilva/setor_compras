"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, Database, Loader2, ExternalLink } from "lucide-react"

interface SetupBannerProps {
  onSetupComplete?: () => void
}

interface SetupStatus {
  dbType: 'supabase' | 'mysql' | 'none'
  configured: boolean
  missingTables?: string[]
  setupScript?: string
  error?: string
  details?: string
}

export function SetupBanner({ onSetupComplete }: SetupBannerProps) {
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [status, setStatus] = useState<SetupStatus | null>(null)

  useEffect(() => {
    checkStatus()
  }, [])

  async function checkStatus() {
    setChecking(true)
    try {
      const res = await fetch("/api/setup")
      const data = await res.json()
      setStatus(data)
      
      if (data.configured) {
        setSuccess(true)
        setTimeout(() => {
          onSetupComplete?.()
        }, 1000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao verificar banco")
    } finally {
      setChecking(false)
    }
  }

  async function handleSetup() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/setup", { method: "POST" })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.details || data.error || "Erro ao configurar banco de dados")
      }

      setSuccess(true)
      setTimeout(() => {
        onSetupComplete?.()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Verificando Banco de Dados...
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (success) {
    return (
      <Card className="border-green-500/50 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            Banco de Dados Configurado
          </CardTitle>
          <CardDescription className="text-green-600">
            {status?.dbType === 'supabase' ? 'Supabase/PostgreSQL' : 'MySQL'} verificado com sucesso. Redirecionando...
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const isSupabase = status?.dbType === 'supabase'
  const isMySQL = status?.dbType === 'mysql'
  const isNone = status?.dbType === 'none'

  return (
    <Card className="border-primary/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Configuração Inicial
          {isSupabase && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Supabase</span>}
          {isMySQL && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">MySQL</span>}
        </CardTitle>
        <CardDescription>
          {isNone 
            ? "Nenhum banco de dados detectado. Configure as variáveis de ambiente."
            : isSupabase && status?.missingTables?.length
              ? "O Supabase está conectado, mas as tabelas precisam ser criadas."
              : "O banco de dados precisa ser configurado. Clique no botão abaixo para criar as tabelas."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isNone && (
          <div className="rounded-lg bg-muted p-4">
            <h4 className="font-medium mb-2">Configure uma das opções abaixo:</h4>
            <div className="space-y-3">
              <div>
                <h5 className="text-sm font-medium text-primary">Opção 1: Supabase (Recomendado)</h5>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2">
                  <li><code className="bg-background px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code></li>
                  <li><code className="bg-background px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
                  <li><code className="bg-background px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code></li>
                </ul>
              </div>
              <div>
                <h5 className="text-sm font-medium text-primary">Opção 2: MySQL Hostinger</h5>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2">
                  <li><code className="bg-background px-1 rounded">DATABASE_URL</code> = mysql://usuario:senha@host:porta/banco</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {isSupabase && status?.missingTables?.length && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <h4 className="font-medium mb-2 text-amber-800">Tabelas não encontradas no Supabase</h4>
            <p className="text-sm text-amber-700 mb-3">
              Execute o script SQL no SQL Editor do Supabase para criar as tabelas:
            </p>
            <code className="block bg-amber-100 p-2 rounded text-xs text-amber-900 mb-3">
              scripts/setup-database-supabase.sql
            </code>
            <Button
              variant="outline"
              size="sm"
              className="text-amber-700 border-amber-300 hover:bg-amber-100"
              onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir Supabase Dashboard
            </Button>
          </div>
        )}

        {isMySQL && (
          <div className="rounded-lg bg-muted p-4">
            <h4 className="font-medium mb-2">MySQL detectado</h4>
            <p className="text-sm text-muted-foreground">
              Clique no botão abaixo para criar automaticamente todas as tabelas necessárias.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Erro na configuração</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {(isMySQL || (isSupabase && !status?.missingTables?.length)) && (
          <Button 
            onClick={handleSetup} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Configurando...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                {isSupabase ? 'Verificar Conexão' : 'Criar Tabelas no MySQL'}
              </>
            )}
          </Button>
        )}

        {isSupabase && status?.missingTables?.length && (
          <Button 
            onClick={checkStatus} 
            disabled={checking}
            variant="outline"
            className="w-full"
          >
            {checking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Verificar Novamente
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
