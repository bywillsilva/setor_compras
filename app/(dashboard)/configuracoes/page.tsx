"use client"

import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Database,
  ExternalLink,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldCheck,
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
import { PageHeader, SummaryMetricCard } from "@/components/shared/page-layout"
import {
  FEATURE_DESCRIPTIONS,
  FEATURE_GROUPS,
  FEATURE_LABELS,
  LOCKED_ADMIN_FEATURES,
  normalizeFeatureList,
  PERFIL_LABELS,
} from "@/lib/auth/permissions"
import type { AppFeature, PerfilUsuario, SolicitacaoSensivel } from "@/lib/types"

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
type UsuarioPermissoesPayload = {
  userId: number
  perfil: PerfilUsuario
  features: AppFeature[]
  profileFeatures: AppFeature[]
}

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
  const [pendingSensitiveRequests, setPendingSensitiveRequests] = useState<SolicitacaoSensivel[]>([])
  const [loadingSensitiveRequests, setLoadingSensitiveRequests] = useState(false)
  const [sensitiveRequestsError, setSensitiveRequestsError] = useState<string | null>(null)
  const [perfilDialogOpen, setPerfilDialogOpen] = useState(false)
  const [editingPerfil, setEditingPerfil] = useState<PerfilUsuario | null>(null)
  const [perfilDraft, setPerfilDraft] = useState<AppFeature[]>([])
  const [userAccessDialogOpen, setUserAccessDialogOpen] = useState(false)
  const [editingUserAccess, setEditingUserAccess] = useState<UsuarioResumo | null>(null)
  const [userFeatureDraft, setUserFeatureDraft] = useState<AppFeature[]>([])
  const [baseProfileFeatures, setBaseProfileFeatures] = useState<AppFeature[]>([])
  const [loadingUserFeatures, setLoadingUserFeatures] = useState(false)
  const [savingUserFeatures, setSavingUserFeatures] = useState(false)

  useEffect(() => {
    checkDatabase()
  }, [])

  useEffect(() => {
    if (session?.perfil === "admin") {
      fetchUsuarios()
      fetchPerfilPermissoes()
      fetchPendingSensitiveRequests()
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

  async function fetchPendingSensitiveRequests() {
    setLoadingSensitiveRequests(true)
    setSensitiveRequestsError(null)

    try {
      const response = await fetch("/api/solicitacoes-sensiveis?status=pendente", { cache: "no-store" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao carregar fila administrativa.")
      }

      setPendingSensitiveRequests(Array.isArray(payload) ? payload : [])
    } catch (error) {
      setSensitiveRequestsError(error instanceof Error ? error.message : "Erro ao carregar fila administrativa.")
      setPendingSensitiveRequests([])
    } finally {
      setLoadingSensitiveRequests(false)
    }
  }

  async function persistPerfilPermissoes(nextMatrix: PerfilFeatureMatrix) {
    setSavingPermissoes(true)

    try {
      const response = await fetch("/api/configuracoes/permissoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextMatrix),
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

  function openPerfilDialog(perfil: PerfilUsuario) {
    if (!perfilPermissoes) {
      return
    }

    setEditingPerfil(perfil)
    setPerfilDraft([...(perfilPermissoes[perfil] ?? [])])
    setPerfilDialogOpen(true)
  }

  async function handleSavePerfilDialog() {
    if (!perfilPermissoes || !editingPerfil) {
      return
    }

    const nextMatrix = {
      ...perfilPermissoes,
      [editingPerfil]: normalizeFeatureList(perfilDraft, editingPerfil),
    }

    await persistPerfilPermissoes(nextMatrix)
    setPerfilDialogOpen(false)
  }

  function toggleFeatureSelection(
    currentFeatures: AppFeature[],
    feature: AppFeature,
    checked: boolean,
    perfil: PerfilUsuario,
  ) {
    const next = new Set(currentFeatures)

    if (checked) {
      next.add(feature)
    } else {
      next.delete(feature)
    }

    if (perfil === "admin" && LOCKED_ADMIN_FEATURES.includes(feature)) {
      next.add(feature)
    }

    return normalizeFeatureList(Array.from(next), perfil)
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

  async function openUserAccessDialog(usuario: UsuarioResumo) {
    setEditingUserAccess(usuario)
    setUserAccessDialogOpen(true)
    setLoadingUserFeatures(true)

    try {
      const response = await fetch(`/api/usuarios/${usuario.id}/permissoes`, { cache: "no-store" })
      const payload = (await response.json().catch(() => null)) as UsuarioPermissoesPayload | { error?: string } | null

      if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error || "Erro ao carregar modulos do usuario.")
      }

      const featurePayload = payload as UsuarioPermissoesPayload | null
      setUserFeatureDraft(Array.isArray(featurePayload?.features) ? featurePayload.features : [])
      setBaseProfileFeatures(Array.isArray(featurePayload?.profileFeatures) ? featurePayload.profileFeatures : [])
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao carregar modulos do usuario.")
      setUserAccessDialogOpen(false)
      setEditingUserAccess(null)
    } finally {
      setLoadingUserFeatures(false)
    }
  }

  async function handleSaveUserFeatures() {
    if (!editingUserAccess) {
      return
    }

    setSavingUserFeatures(true)

    try {
      const response = await fetch(`/api/usuarios/${editingUserAccess.id}/permissoes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: userFeatureDraft }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao salvar modulos do usuario.")
      }

      setUserAccessDialogOpen(false)
      setEditingUserAccess(null)
      setBaseProfileFeatures([])
      setUserFeatureDraft([])
      alert("Modulos do usuario atualizados com sucesso.")
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar modulos do usuario.")
    } finally {
      setSavingUserFeatures(false)
    }
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

  const totalUsuarios = usuarios.length
  const usuariosAtivos = usuarios.filter((usuario) => usuario.ativo).length
  const perfisBaseConfigurados = perfilPermissoes
    ? PERFIS_ORDENADOS.filter((perfil) => (perfilPermissoes[perfil] ?? []).length > 0).length
    : 0

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Configuracoes"
        description="Gerencie acessos, fila administrativa e verificacoes tecnicas do sistema."
      />

      {session?.perfil === "admin" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryMetricCard
            title="Usuarios ativos"
            value={loadingUsuarios ? "..." : usuariosAtivos}
            description="Acessos atualmente liberados para uso."
          />
          <SummaryMetricCard
            title="Perfis base"
            value={loadingPermissoes ? "..." : perfisBaseConfigurados}
            description="Perfis padrao com modulos configurados."
          />
          <SummaryMetricCard
            title="Fila administrativa"
            value={loadingSensitiveRequests ? "..." : pendingSensitiveRequests.length}
            description="Solicitacoes sensiveis aguardando decisao."
            tone={pendingSensitiveRequests.length > 0 ? "warning" : "default"}
          />
        </div>
      ) : null}

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
          <CardDescription>Acompanhe o status tecnico do ambiente e alinhe o banco quando houver pendencias.</CardDescription>
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

              {dbStatus.missingTables && dbStatus.missingTables.length > 0 && (
                <InfoBlock
                  title="Pendencias encontradas"
                  badges={dbStatus.missingTables}
                  className="bg-red-100 text-red-800"
                />
              )}

              {dbStatus.dbType === "supabase" && dbStatus.missingTables && dbStatus.missingTables.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="mb-3 text-sm font-medium text-amber-900">Acoes recomendadas no Supabase</p>
                  <div className="space-y-3">
                    <ScriptHint label="Base nova" script="scripts/setup-database-supabase.sql" />
                    <ScriptHint label="Atualizacao estrutural" script="scripts/migrations/supabase/2026-04-29-upgrade-current-schema.sql" />
                    <ScriptHint label="Fluxo de aprovacoes" script="scripts/migrations/supabase/2026-05-07-workflow-signatures.sql" />
                    <ScriptHint label="Fila administrativa" script="scripts/migrations/supabase/2026-05-08-sensitive-change-requests.sql" />
                    <ScriptHint label="Permissoes por usuario" script="scripts/migrations/supabase/2026-05-11-user-feature-access.sql" />
                  </div>
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
        </CardContent>
      </Card>

      {session?.perfil === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Autorizacoes administrativas
              <Badge variant="outline" className="ml-2">
                {loadingSensitiveRequests ? "..." : pendingSensitiveRequests.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Acompanhe pedidos de exclusao e alteracao sensivel antes de liberar qualquer mudanca definitiva.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Central de aprovacao para ajustes que exigem rastreabilidade.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchPendingSensitiveRequests} disabled={loadingSensitiveRequests}>
                  {loadingSensitiveRequests ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    "Atualizar fila"
                  )}
                </Button>
                <Button asChild>
                  <Link href="/configuracoes/solicitacoes-sensiveis">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Revisar solicitacoes
                  </Link>
                </Button>
              </div>
            </div>

            {sensitiveRequestsError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {sensitiveRequestsError}
              </div>
            ) : loadingSensitiveRequests ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Carregando fila administrativa...
              </div>
            ) : pendingSensitiveRequests.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Nenhuma solicitacao sensivel pendente no momento.
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="text-sm font-medium text-foreground">
                  {pendingSensitiveRequests.length} solicitacao(oes) aguardando aprovacao
                </div>
                <div className="space-y-2">
                  {pendingSensitiveRequests.slice(0, 3).map((request) => (
                    <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{request.solicitante_nome}</span>{" "}
                        <span className="text-muted-foreground">
                          solicitou {request.acao} de {request.entidade}
                        </span>
                      </div>
                      <Badge variant="outline">#{request.id}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {session?.perfil === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Perfis base de acesso
            </CardTitle>
            <CardDescription>
              Defina o conjunto base de modulos para cada perfil. Ajustes finos ficam na configuracao individual do usuario.
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
                  "Recarregar perfis"
                )}
              </Button>
            </div>

            {loadingPermissoes || !perfilPermissoes ? (
              <div className="flex min-h-[180px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {PERFIS_ORDENADOS.map((perfil) => {
                  const perfilFeatures = perfilPermissoes[perfil] ?? []

                  return (
                    <div key={perfil} className="rounded-xl border p-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-foreground">{PERFIL_LABELS[perfil]}</h3>
                            <Badge variant="outline">{perfilFeatures.length} modulos</Badge>
                          </div>
                        <p className="text-sm text-muted-foreground">Base usada para novos usuarios deste perfil.</p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {perfilFeatures.slice(0, 4).map((feature) => (
                          <Badge key={`${perfil}-${feature}`} variant="secondary">
                            {FEATURE_LABELS[feature]}
                          </Badge>
                        ))}
                        {perfilFeatures.length > 4 ? (
                          <Badge variant="outline">+{perfilFeatures.length - 4} restantes</Badge>
                        ) : null}
                      </div>

                      <Button className="mt-4 w-full" variant="outline" onClick={() => openPerfilDialog(perfil)}>
                        Configurar perfil base
                      </Button>
                    </div>
                  )
                })}
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
                <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
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

            <Dialog
              open={userAccessDialogOpen}
              onOpenChange={(open) => {
                setUserAccessDialogOpen(open)
                if (!open) {
                  setEditingUserAccess(null)
                  setBaseProfileFeatures([])
                  setUserFeatureDraft([])
                }
              }}
            >
              <DialogContent className="flex max-h-[88vh] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <DialogHeader className="border-b px-5 py-4 text-left">
                  <DialogTitle>Modulos por usuario</DialogTitle>
                  <DialogDescription>
                    Ajuste os acessos deste usuario sem mexer no perfil base dos demais.
                  </DialogDescription>
                </DialogHeader>

                {loadingUserFeatures || !editingUserAccess ? (
                  <div className="flex min-h-[220px] items-center justify-center px-5 py-6">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto px-5 py-4">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3">
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">{editingUserAccess.nome}</div>
                          <div className="text-sm text-muted-foreground">
                            {PERFIL_LABELS[editingUserAccess.perfil]} · {userFeatureDraft.length} acesso(s) liberado(s)
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{baseProfileFeatures.length} do perfil</Badge>
                          <Button size="sm" variant="outline" onClick={() => setUserFeatureDraft([...baseProfileFeatures])}>
                            Restaurar perfil
                          </Button>
                        </div>
                      </div>

                      <FeatureChecklist
                        perfil={editingUserAccess.perfil}
                        features={userFeatureDraft}
                        disabled={savingUserFeatures}
                        onToggle={(feature, checked) =>
                          setUserFeatureDraft((current) =>
                            toggleFeatureSelection(current, feature, checked, editingUserAccess.perfil),
                          )
                        }
                      />
                    </div>
                  </div>
                )}

                <DialogFooter className="border-t px-5 py-4">
                  <Button variant="outline" onClick={() => setUserAccessDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveUserFeatures} disabled={loadingUserFeatures || savingUserFeatures}>
                    {savingUserFeatures ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar modulos"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={perfilDialogOpen}
              onOpenChange={(open) => {
                setPerfilDialogOpen(open)
                if (!open) {
                  setEditingPerfil(null)
                  setPerfilDraft([])
                }
              }}
            >
              <DialogContent className="flex max-h-[88vh] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <DialogHeader className="border-b px-5 py-4 text-left">
                  <DialogTitle>Perfil base</DialogTitle>
                  <DialogDescription>
                    Ajuste o conjunto inicial de acessos para este perfil.
                  </DialogDescription>
                </DialogHeader>

                {editingPerfil ? (
                  <div className="flex-1 overflow-y-auto px-5 py-4">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3">
                        <div>
                          <div className="font-medium text-foreground">{PERFIL_LABELS[editingPerfil]}</div>
                          <div className="text-sm text-muted-foreground">
                            Base aplicada a novos usuarios deste perfil.
                          </div>
                        </div>
                        <Badge variant="secondary">{perfilDraft.length} acesso(s)</Badge>
                      </div>

                      <FeatureChecklist
                        perfil={editingPerfil}
                        features={perfilDraft}
                        disabled={savingPermissoes}
                        onToggle={(feature, checked) =>
                          setPerfilDraft((current) => toggleFeatureSelection(current, feature, checked, editingPerfil))
                        }
                      />
                    </div>
                  </div>
                ) : null}

                <DialogFooter className="border-t px-5 py-4">
                  <Button variant="outline" onClick={() => setPerfilDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSavePerfilDialog} disabled={!editingPerfil || savingPermissoes}>
                    {savingPermissoes ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar perfil base"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openUserAccessDialog(usuario)}>
                            Acessos
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openUserDialog(usuario)}>
                            Editar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

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

function ScriptHint({ label, script }: { label: string; script: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-amber-900/80">{label}</p>
      <code className="block rounded bg-amber-100 px-2 py-1.5 text-xs text-amber-900">{script}</code>
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

function FeatureChecklist({
  perfil,
  features,
  disabled,
  onToggle,
}: {
  perfil: PerfilUsuario
  features: AppFeature[]
  disabled?: boolean
  onToggle: (feature: AppFeature, checked: boolean) => void
}) {
  return (
    <div className="space-y-4">
      {FEATURE_GROUPS.map((group) => (
        <div key={`${perfil}-${group.id}`} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</div>
            <Badge variant="outline" className="text-[10px]">
              {group.features.filter((feature) => features.includes(feature)).length}/{group.features.length}
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.features.map((feature) => {
              const checked = features.includes(feature)
              const isLocked = perfil === "admin" && LOCKED_ADMIN_FEATURES.includes(feature)

              return (
                <label
                  key={`${perfil}-${feature}`}
                  className="flex min-h-[60px] items-start gap-3 rounded-md border px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-muted/10"
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled || isLocked}
                    onCheckedChange={(value) => onToggle(feature, value === true)}
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium leading-tight text-foreground">{FEATURE_LABELS[feature]}</span>
                      {isLocked ? (
                        <Badge variant="outline" className="text-[10px]">
                          Fixo no ADM
                        </Badge>
                      ) : null}
                    </div>
                    <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                      {FEATURE_DESCRIPTIONS[feature]}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
