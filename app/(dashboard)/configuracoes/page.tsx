"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Database, CheckCircle2, AlertCircle, Loader2, RefreshCw, ExternalLink } from "lucide-react"

export default function ConfiguracoesPage() {
  const [checking, setChecking] = useState(false)
  const [dbStatus, setDbStatus] = useState<{
    configured: boolean
    dbType: 'supabase' | 'mysql' | 'none'
    existingTables?: string[]
    missingTables?: string[]
    setupScript?: string
    error?: string
    details?: string
  } | null>(null)
  const [setting, setSetting] = useState(false)

  useEffect(() => {
    checkDatabase()
  }, [])

  async function checkDatabase() {
    setChecking(true)
    try {
      const res = await fetch("/api/setup")
      const data = await res.json()
      setDbStatus(data)
    } catch (error) {
      setDbStatus({ configured: false, dbType: 'none', error: "Erro ao conectar" })
    } finally {
      setChecking(false)
    }
  }

  async function setupDatabase() {
    setSetting(true)
    try {
      const res = await fetch("/api/setup", { method: "POST" })
      const data = await res.json()
      if (data.success) {
        await checkDatabase()
      } else {
        setDbStatus(prev => ({
          ...prev,
          configured: false,
          dbType: prev?.dbType || 'none',
          error: data.details || data.error
        }))
      }
    } catch (error) {
      setDbStatus(prev => ({
        ...prev,
        configured: false,
        dbType: prev?.dbType || 'none',
        error: "Erro ao configurar banco de dados"
      }))
    } finally {
      setSetting(false)
    }
  }

  const dbTypeLabel = {
    supabase: 'Supabase (PostgreSQL)',
    mysql: 'MySQL Hostinger',
    none: 'Não configurado'
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Gerencie as configurações do sistema</p>
      </div>

      {/* Database Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Banco de Dados
            {dbStatus && dbStatus.dbType !== 'none' && (
              <Badge variant="outline" className="ml-2">
                {dbStatus.dbType === 'supabase' ? 'Supabase' : 'MySQL'}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Verifique e configure a conexão com o banco de dados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={checkDatabase} disabled={checking} variant="outline">
              {checking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Verificar Conexão
                </>
              )}
            </Button>
            
            {dbStatus && !dbStatus.configured && dbStatus.dbType === 'mysql' && (
              <Button onClick={setupDatabase} disabled={setting}>
                {setting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Criar Tabelas
                  </>
                )}
              </Button>
            )}
          </div>

          {dbStatus && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                {dbStatus.configured ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-700">
                      Banco de dados configurado ({dbTypeLabel[dbStatus.dbType]})
                    </span>
                  </>
                ) : dbStatus.error ? (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <span className="font-medium text-red-700">Erro na conexão</span>
                  </>
                ) : dbStatus.dbType === 'none' ? (
                  <>
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium text-yellow-700">Nenhum banco configurado</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium text-yellow-700">Tabelas faltando</span>
                  </>
                )}
              </div>

              {dbStatus.error && (
                <p className="text-sm text-red-600">{dbStatus.error}</p>
              )}

              {dbStatus.existingTables && dbStatus.existingTables.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Tabelas existentes:</p>
                  <div className="flex flex-wrap gap-2">
                    {dbStatus.existingTables.map((table) => (
                      <Badge key={table} variant="secondary" className="bg-green-100 text-green-800">
                        {table}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {dbStatus.missingTables && dbStatus.missingTables.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Estruturas pendentes na versao atual:</p>
                  <div className="flex flex-wrap gap-2">
                    {dbStatus.missingTables.map((table) => (
                      <Badge key={table} variant="secondary" className="bg-red-100 text-red-800">
                        {table}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {dbStatus.dbType === 'supabase' && dbStatus.missingTables && dbStatus.missingTables.length > 0 && (
                <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800 mb-2">
                    Primeira instalacao no Supabase:
                  </p>
                  <code className="block bg-amber-100 p-2 rounded text-xs text-amber-900">
                    scripts/setup-database-supabase.sql
                  </code>
                  <p className="mt-3 text-sm text-amber-800 mb-2">
                    Para alinhar uma base existente com a versao atual do sistema, use a migration consolidada:
                  </p>
                  <code className="block bg-amber-100 p-2 rounded text-xs text-amber-900">
                    scripts/migrations/supabase/2026-04-29-upgrade-current-schema.sql
                  </code>
                  <p className="mt-3 text-sm text-amber-800 mb-2">
                    Se quiser resetar tudo e recriar a base do zero na estrutura atual:
                  </p>
                  <code className="block bg-amber-100 p-2 rounded text-xs text-amber-900">
                    scripts/reset-database-supabase.sql
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-amber-700 border-amber-300 hover:bg-amber-100"
                    onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir Supabase Dashboard
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg bg-muted p-4">
            <h4 className="font-medium mb-3">Opções de Configuração</h4>
            
            <div className="space-y-4">
              {/* Supabase Option */}
              <div className="p-3 bg-background rounded-lg border">
                <h5 className="font-medium text-primary mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Recomendado</Badge>
                  Supabase (PostgreSQL)
                </h5>
                <p className="text-sm text-muted-foreground mb-2">
                  Configure as seguintes variáveis de ambiente:
                </p>
                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SECRET_KEY="sb_secret_..."`}
                </pre>
                <p className="mt-2 text-xs text-muted-foreground">
                  Em bases existentes, execute a migration consolidada da versao atual antes de usar o sistema.
                </p>
              </div>

              {/* MySQL Option */}
              <div className="p-3 bg-background rounded-lg border">
                <h5 className="font-medium text-primary mb-2">MySQL Hostinger</h5>
                <p className="text-sm text-muted-foreground mb-2">
                  Configure a variável DATABASE_URL:
                </p>
                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`DATABASE_URL="mysql://usuario:senha@host:porta/banco"

# Exemplo:
DATABASE_URL="mysql://u123456_admin:Senha123@srv123.hostinger.com:3306/u123456_compras"`}
                </pre>
              </div>
              <div className="p-3 bg-background rounded-lg border">
                <h5 className="font-medium text-primary mb-2">AutenticaÃ§Ã£o inicial</h5>
                <p className="text-sm text-muted-foreground mb-2">
                  O sistema cria automaticamente um administrador padrÃ£o quando encontra o banco configurado e ainda nÃ£o existem usuÃ¡rios.
                </p>
                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`AUTH_SECRET="gere-uma-chave-segura"
APP_ADMIN_NAME="Administrador do Sistema"
APP_ADMIN_EMAIL="admin@compras.local"
APP_ADMIN_PASSWORD="admin123456"`}
                </pre>
                <p className="mt-2 text-xs text-muted-foreground">
                  Se vocÃª nÃ£o definir email e senha no ambiente local, o sistema usa <strong>admin@compras.local</strong> e <strong>admin123456</strong> no primeiro acesso.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Versão</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Framework</span>
              <span className="font-medium">Next.js 16</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Banco de Dados</span>
              <span className="font-medium">
                {dbStatus ? dbTypeLabel[dbStatus.dbType] : 'Verificando...'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
