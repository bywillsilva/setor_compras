"use client"

import { useEffect, useState, type ReactNode } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Database,
  ExternalLink,
  Loader2,
  RefreshCw,
  Settings2,
  Users,
} from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  FEATURE_DESCRIPTIONS,
  FEATURE_GROUPS,
  FEATURE_LABELS,
  LOCKED_ADMIN_FEATURES,
  PERFIL_LABELS,
} from "@/lib/auth/permissions"
import type { AppFeature, PerfilUsuario } from "@/lib/types"

type DatabaseStatus = {
  configured: boolean
  dbType: "supabase" | "mysql" | "none"
  existingTables?: string[]
  missingTables?: string[]
  setupScript?: string
  error?: string
  details?: string
}

type UsuarioResumo = {
  id: number
  nome: string
  email: string
  perfil: PerfilUsuario
  ativo: boolean
  created_at: string
  updated_at: string
}

type PerfilFeatureMatrix = Record<PerfilUsuario, AppFeature[]>

const PERFIS_ORDENADOS: PerfilUsuario[] = ["admin", "comprador", "orcamentista", "solicitante", "financeiro"]

const EMPTY_USER_FORM = {
  nome: "",
  email: "",
  senha: "",
  perfil: "comprador" as PerfilUsuario,
  ativo: "ativo",
}

export default function ConfiguracoesPage() {
  const session = useCurrentSession()
  const [checking, setChecking] = useState(false)
  const [setting, setSetting] = useState(false)
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null)
  const [usuarios, setUsuarios] = useState<UsuarioResumo[]>([])
  const [perfilPermissoes, setPerfilPermissoes] = useState<PerfilFeatureMatrix | null>(null)
  const [loadingUsuarios, setLoadingUsuarios] = useState(false)
  const [loadingPermissoes, setLoadingPermissoes] = useState(false)
  const [savingUsuario, setSavingUsuario] = useState(false)
  const [savingPermissoes, setSavingPermissoes] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUsuario, setEditingUsuario] = useState<UsuarioResumo | null>(null)
  const [userFormData, setUserFormData] = useState(EMPTY_USER_FORM)

  useEffect(() => {
    checkDatabase()
  }, [])

  useEffect(() => {
    if (session?.perfil === "admin") {
      fetchUsuarios()
      fetchPerfilPermissoes()
    }
  }, [session?.perfil])

  async function checkDatabase() {
    setChecking(true)
    try {
      const res = await fetch("/api/setup")
      const data = await res.json()
      setDbStatus(data)
    } catch {
      setDbStatus({ configured: false, dbType: "none", error: "Erro ao conectar" })
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
        setDbStatus((current) => ({
          ...current,
          configured: false,
          dbType: current?.dbType || "none",
          error: data.details || data.error,
        }))
      }
    } catch {
      setDbStatus((current) => ({
        ...current,
        configured: false,
        dbType: current?.dbType || "none",
        error: "Erro ao configurar banco de dados",
      }))
    } finally {
      setSetting(false)
    }
  }

  async function fetchUsuarios() {
    setLoadingUsuarios(true)
    try {
      const response = await fetch("/api/usuarios")

      if (response.ok) {
        setUsuarios(await response.json())
      }
    } finally {
      setLoadingUsuarios(false)
    }
  }

  async function fetchPerfilPermissoes() {
    setLoadingPermissoes(true)
    try {
      const response = await fetch("/api/configuracoes/permissoes")
      if (!response.ok) {
        throw new Error("Erro ao carregar permissoes por perfil.")
      }

      setPerfilPermissoes(await response.json())
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao carregar permissoes por perfil.")
    } finally {
      setLoadingPermissoes(false)
    }
  }

  function handleTogglePermissao(perfil: PerfilUsuario, feature: AppFeature, checked: boolean) {
    setPerfilPermissoes((current) => {
      if (!current) {
        return current
      }

      const currentFeatures = new Set(current[perfil] ?? [])
      if (checked) {
        currentFeatures.add(feature)
      } else {
        currentFeatures.delete(feature)
      }

      if (perfil === "admin" && LOCKED_ADMIN_FEATURES.includes(feature)) {
        currentFeatures.add(feature)
      }

      return {
        ...current,
        [perfil]: Array.from(currentFeatures),
      }
    })
  }

  async function handleSavePermissoes() {
    if (!perfilPermissoes) {
      return
    }

    setSavingPermissoes(true)

    try {
      const response = await fetch("/api/configuracoes/permissoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(perfilPermissoes),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao salvar permissoes.")
      }

      setPerfilPermissoes(payload.permissoes)
      alert("Permissoes atualizadas com sucesso.")
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar permissoes.")
    } finally {
      setSavingPermissoes(false)
    }
  }

  function openUserDialog(usuario?: UsuarioResumo) {
    if (usuario) {
      setEditingUsuario(usuario)
      setUserFormData({
        nome: usuario.nome,
        email: usuario.email,
        senha: "",
        perfil: usuario.perfil,
        ativo: usuario.ativo ? "ativo" : "inativo",
      })
    } else {
      setEditingUsuario(null)
      setUserFormData(EMPTY_USER_FORM)
    }

    setDialogOpen(true)
  }

  async function handleSaveUsuario() {
    if (!userFormData.nome.trim() || !userFormData.email.trim()) {
      alert("Nome e email sao obrigatorios.")
      return
    }

    if (!editingUsuario && !userFormData.senha.trim()) {
      alert("Senha obrigatoria para criar usuario.")
      return
    }

    setSavingUsuario(true)

    try {
      const response = await fetch(editingUsuario ? `/api/usuarios/${editingUsuario.id}` : "/api/usuarios", {
        method: editingUsuario ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: userFormData.nome.trim(),
          email: userFormData.email.trim(),
          senha: userFormData.senha.trim() || null,
          perfil: userFormData.perfil,
          ativo: userFormData.ativo === "ativo",
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao salvar usuario.")
      }

      setDialogOpen(false)
      setEditingUsuario(null)
      setUserFormData(EMPTY_USER_FORM)
      await fetchUsuarios()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar usuario.")
    } finally {
      setSavingUsuario(false)
    }
  }

  const dbTypeLabel = {
    supabase: "Supabase (PostgreSQL)",
    mysql: "MySQL Hostinger",
    none: "Nao configurado",
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuracoes</h1>
        <p className="text-muted-foreground">Banco de dados, acesso inicial e administracao do sistema.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Banco de dados
            {dbStatus && dbStatus.dbType !== "none" && (
              <Badge variant="outline" className="ml-2">
                {dbStatus.dbType === "supabase" ? "Supabase" : "MySQL"}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Verifique a conexao e alinhe o banco com a estrutura atual do sistema.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={checkDatabase} disabled={checking} variant="outline">
              {checking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Verificar conexao
                </>
              )}
            </Button>

            {dbStatus && !dbStatus.configured && dbStatus.dbType === "mysql" && (
              <Button onClick={setupDatabase} disabled={setting}>
                {setting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Criar tabelas
                  </>
                )}
              </Button>
            )}
          </div>

          {dbStatus && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                {dbStatus.configured ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-700">
                      Banco configurado ({dbTypeLabel[dbStatus.dbType]})
                    </span>
                  </>
                ) : dbStatus.error ? (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <span className="font-medium text-red-700">Erro na conexao</span>
                  </>
                ) : dbStatus.dbType === "none" ? (
                  <>
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium text-yellow-700">Nenhum banco configurado</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium text-yellow-700">Estrutura pendente</span>
                  </>
                )}
              </div>

              {dbStatus.error && <p className="text-sm text-red-600">{dbStatus.error}</p>}

              {dbStatus.existingTables && dbStatus.existingTables.length > 0 && (
                <InfoBlock
                  title="Tabelas existentes"
                  badges={dbStatus.existingTables}
                  className="bg-green-100 text-green-800"
                />
              )}

              {dbStatus.missingTables && dbStatus.missingTables.length > 0 && (
                <InfoBlock
                  title="Estruturas pendentes na versao atual"
                  badges={dbStatus.missingTables}
                  className="bg-red-100 text-red-800"
                />
              )}

              {dbStatus.dbType === "supabase" && dbStatus.missingTables && dbStatus.missingTables.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="mb-2 text-sm text-amber-800">Primeira instalacao no Supabase:</p>
                  <code className="block rounded bg-amber-100 p-2 text-xs text-amber-900">
                    scripts/setup-database-supabase.sql
                  </code>
                  <p className="mb-2 mt-3 text-sm text-amber-800">Para alinhar uma base existente com a versao atual:</p>
                  <code className="block rounded bg-amber-100 p-2 text-xs text-amber-900">
                    scripts/migrations/supabase/2026-04-29-upgrade-current-schema.sql
                  </code>
                  <p className="mb-2 mt-3 text-sm text-amber-800">Para liberar permissoes por modulo entre perfis:</p>
                  <code className="block rounded bg-amber-100 p-2 text-xs text-amber-900">
                    scripts/migrations/supabase/2026-05-07-profile-feature-access.sql
                  </code>
                  <p className="mb-2 mt-3 text-sm text-amber-800">Para ativar o fluxo novo de solicitacoes, aprovacao ADM e financeiro:</p>
                  <code className="block rounded bg-amber-100 p-2 text-xs text-amber-900">
                    scripts/migrations/supabase/2026-05-07-workflow-signatures.sql
                  </code>
                  <p className="mb-2 mt-3 text-sm text-amber-800">Se quiser resetar tudo e recriar do zero:</p>
                  <code className="block rounded bg-amber-100 p-2 text-xs text-amber-900">
                    scripts/reset-database-supabase.sql
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-100"
                    onClick={() => window.open("https://supabase.com/dashboard", "_blank")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir Supabase Dashboard
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg bg-muted p-4">
            <h4 className="mb-3 font-medium">Configuracao recomendada</h4>
            <div className="space-y-4">
              <div className="rounded-lg border bg-background p-3">
                <h5 className="mb-2 flex items-center gap-2 font-medium text-primary">
                  <Badge variant="outline" className="text-xs">
                    Recomendado
                  </Badge>
                  Supabase
                </h5>
                <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
{`NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SECRET_KEY="sb_secret_..."`}
                </pre>
              </div>

              <div className="rounded-lg border bg-background p-3">
                <h5 className="mb-2 font-medium text-primary">MySQL</h5>
                <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
{`DATABASE_URL="mysql://usuario:senha@host:porta/banco"`}
                </pre>
              </div>

              <div className="rounded-lg border bg-background p-3">
                <h5 className="mb-2 font-medium text-primary">Autenticacao inicial</h5>
                <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
{`AUTH_SECRET="gere-uma-chave-segura"
APP_ADMIN_NAME="Administrador do Sistema"
APP_ADMIN_EMAIL="admin@compras.local"
APP_ADMIN_PASSWORD="admin123456"`}
                </pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {session?.perfil === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Modulos por perfil
            </CardTitle>
            <CardDescription>
              O administrador define quais modulos e acoes cada perfil pode acessar. As alteracoes passam a valer nas proximas navegacoes do usuario.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={fetchPerfilPermissoes} disabled={loadingPermissoes || savingPermissoes}>
                {loadingPermissoes ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recarregando...
                  </>
                ) : (
                  "Recarregar"
                )}
              </Button>
              <Button onClick={handleSavePermissoes} disabled={!perfilPermissoes || loadingPermissoes || savingPermissoes}>
                {savingPermissoes ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar permissoes"
                )}
              </Button>
            </div>

            {loadingPermissoes || !perfilPermissoes ? (
              <div className="flex min-h-[180px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                {PERFIS_ORDENADOS.map((perfil) => (
                  <div key={perfil} className="rounded-xl border p-4">
                    <div className="mb-4">
                      <h3 className="font-semibold text-foreground">{PERFIL_LABELS[perfil]}</h3>
                      <p className="text-sm text-muted-foreground">
                        Selecione os modulos e as acoes que este perfil podera usar no sistema.
                      </p>
                    </div>

                    <div className="space-y-5">
                      {FEATURE_GROUPS.map((group) => (
                        <div key={group.id} className="space-y-3">
                          <div className="text-sm font-medium text-foreground">{group.label}</div>
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {group.features.map((feature) => {
                              const checked = perfilPermissoes[perfil]?.includes(feature) ?? false
                              const isLocked = perfil === "admin" && LOCKED_ADMIN_FEATURES.includes(feature)

                              return (
                                <label
                                  key={`${perfil}-${feature}`}
                                  className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/20"
                                >
                                  <Checkbox
                                    checked={checked}
                                    disabled={isLocked || savingPermissoes}
                                    onCheckedChange={(value) => handleTogglePermissao(perfil, feature, value === true)}
                                  />
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-foreground">{FEATURE_LABELS[feature]}</span>
                                      {isLocked && (
                                        <Badge variant="outline" className="text-[10px]">
                                          Fixo no ADM
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">{FEATURE_DESCRIPTIONS[feature]}</p>
                                  </div>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {session?.perfil === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuarios e perfis
            </CardTitle>
            <CardDescription>Crie e ajuste acessos para administrador, comprador, solicitante, financeiro e orcamentista.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => openUserDialog()}>
                    <Settings2 className="mr-2 h-4 w-4" />
                    Novo usuario
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingUsuario ? "Editar usuario" : "Novo usuario"}</DialogTitle>
                    <DialogDescription>
                      {editingUsuario
                        ? "Ajuste perfil, status e, se precisar, redefina a senha."
                        : "Crie um novo acesso para o sistema."}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-2">
                    <Field label="Nome">
                      <Input
                        value={userFormData.nome}
                        onChange={(event) => setUserFormData((current) => ({ ...current, nome: event.target.value }))}
                      />
                    </Field>

                    <Field label="Email">
                      <Input
                        type="email"
                        value={userFormData.email}
                        onChange={(event) => setUserFormData((current) => ({ ...current, email: event.target.value }))}
                      />
                    </Field>

                    <Field label={editingUsuario ? "Nova senha (opcional)" : "Senha"}>
                      <Input
                        type="password"
                        value={userFormData.senha}
                        onChange={(event) => setUserFormData((current) => ({ ...current, senha: event.target.value }))}
                      />
                    </Field>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Perfil">
                        <Select
                          value={userFormData.perfil}
                          onValueChange={(value) =>
                            setUserFormData((current) => ({ ...current, perfil: value as PerfilUsuario }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="comprador">Comprador</SelectItem>
                            <SelectItem value="orcamentista">Orcamentista</SelectItem>
                            <SelectItem value="solicitante">Solicitante</SelectItem>
                            <SelectItem value="financeiro">Financeiro</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field label="Status">
                        <Select
                          value={userFormData.ativo}
                          onValueChange={(value) => setUserFormData((current) => ({ ...current, ativo: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ativo">Ativo</SelectItem>
                            <SelectItem value="inativo">Inativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveUsuario} disabled={savingUsuario}>
                      {savingUsuario ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        "Salvar usuario"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {loadingUsuarios ? (
              <div className="flex min-h-[180px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((usuario) => (
                    <TableRow key={usuario.id}>
                      <TableCell className="font-medium">{usuario.nome}</TableCell>
                      <TableCell>{usuario.email}</TableCell>
                      <TableCell>{PERFIL_LABELS[usuario.perfil]}</TableCell>
                      <TableCell>
                        <Badge variant={usuario.ativo ? "default" : "outline"}>{usuario.ativo ? "Ativo" : "Inativo"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openUserDialog(usuario)}>
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Informacoes do sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <InfoLine label="Versao" value="1.0.0" />
            <InfoLine label="Framework" value="Next.js 16" />
            <InfoLine label="Banco de dados" value={dbStatus ? dbTypeLabel[dbStatus.dbType] : "Verificando..."} />
            <InfoLine label="Perfil atual" value={session ? PERFIL_LABELS[session.perfil] : "Sem sessao"} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function InfoBlock({ title, badges, className }: { title: string; badges: string[]; className: string }) {
  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">{title}:</p>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <Badge key={badge} variant="secondary" className={className}>
            {badge}
          </Badge>
        ))}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
