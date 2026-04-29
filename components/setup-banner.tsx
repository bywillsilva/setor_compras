"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Database, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface SetupBannerProps {
  onSetupComplete?: () => void
}

interface SetupStatus {
  dbType: "supabase" | "mysql" | "none"
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
      const response = await fetch("/api/setup")
      const payload = await response.json()
      setStatus(payload)

      if (payload.configured) {
        setSuccess(true)
        setTimeout(() => onSetupComplete?.(), 1000)
      }
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Erro ao verificar banco")
    } finally {
      setChecking(false)
    }
  }

  async function handleSetup() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/setup", { method: "POST" })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.details || payload.error || "Erro ao configurar banco de dados")
      }

      setSuccess(true)
      setTimeout(() => onSetupComplete?.(), 1500)
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Erro desconhecido")
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
            Verificando banco de dados...
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
            Banco de dados configurado
          </CardTitle>
          <CardDescription className="text-green-600">
            {status?.dbType === "supabase" ? "Supabase/PostgreSQL" : "MySQL"} verificado com sucesso. Redirecionando...
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const isSupabase = status?.dbType === "supabase"
  const isMySQL = status?.dbType === "mysql"
  const isNone = status?.dbType === "none"

  return (
    <Card className="border-primary/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Configuracao inicial
          {isSupabase && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">Supabase</span>}
          {isMySQL && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">MySQL</span>}
        </CardTitle>
        <CardDescription>
          {isNone
            ? "Nenhum banco de dados detectado. Configure as variaveis de ambiente."
            : isSupabase && status?.missingTables?.length
              ? "O Supabase esta conectado, mas a estrutura da versao atual ainda nao foi aplicada."
              : "O banco de dados precisa estar alinhado com a versao atual do sistema."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isNone && (
          <div className="rounded-lg bg-muted p-4">
            <h4 className="mb-2 font-medium">Configure uma das opcoes abaixo:</h4>
            <div className="space-y-3">
              <div>
                <h5 className="text-sm font-medium text-primary">Opcao 1: Supabase</h5>
                <ul className="ml-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  <li><code className="rounded bg-background px-1">NEXT_PUBLIC_SUPABASE_URL</code></li>
                  <li><code className="rounded bg-background px-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code></li>
                  <li><code className="rounded bg-background px-1">SUPABASE_SECRET_KEY</code></li>
                </ul>
              </div>
              <div>
                <h5 className="text-sm font-medium text-primary">Opcao 2: MySQL</h5>
                <ul className="ml-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  <li><code className="rounded bg-background px-1">DATABASE_URL</code> = mysql://usuario:senha@host:porta/banco</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {isSupabase && status?.missingTables?.length && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h4 className="mb-2 font-medium text-amber-800">Estrutura atual nao aplicada no Supabase</h4>
            <p className="mb-3 text-sm text-amber-700">
              Para base nova, rode o setup completo. Para base existente, rode a migration consolidada da versao atual:
            </p>
            <code className="mb-3 block rounded bg-amber-100 p-2 text-xs text-amber-900">
              {status?.setupScript || "scripts/setup-database-supabase.sql"}
            </code>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={() => window.open("https://supabase.com/dashboard", "_blank")}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir Supabase Dashboard
            </Button>
          </div>
        )}

        {isMySQL && (
          <div className="rounded-lg bg-muted p-4">
            <h4 className="mb-2 font-medium">MySQL detectado</h4>
            <p className="text-sm text-muted-foreground">
              Clique no botao abaixo para criar ou alinhar a estrutura da versao atual.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-destructive">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Erro na configuracao</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {(isMySQL || (isSupabase && !status?.missingTables?.length)) && (
          <Button onClick={handleSetup} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Configurando...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                {isSupabase ? "Verificar conexao" : "Criar estrutura no MySQL"}
              </>
            )}
          </Button>
        )}

        {isSupabase && status?.missingTables?.length && (
          <Button onClick={checkStatus} disabled={checking} variant="outline" className="w-full">
            {checking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Verificar novamente
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
