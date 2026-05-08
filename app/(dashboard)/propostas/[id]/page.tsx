"use client"

import { use, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Eye,
  Loader2,
  MoreHorizontal,
  Package,
  Plus,
  Save,
  ShoppingCart,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useCurrentSession } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
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
import { CATEGORIA_LABELS, getCompraCategoriaDistribuicao, STATUS_BADGE_CLASSES, STATUS_LABELS } from "@/lib/domain"
import type { Cliente, Compra, Proposta } from "@/lib/types"

type PropostaFormState = {
  cliente_id: string
  nome: string
  data_inicio: string
  data_fim: string
  valor_previsto_perfis: string
  valor_previsto_vidros: string
  valor_previsto_acessorios: string
  valor_previsto_outros: string
  custo_perdas: string
}

export default function PropostaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const session = useCurrentSession()
  const router = useRouter()
  const [proposta, setProposta] = useState<Proposta | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [compras, setCompras] = useState<Compra[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [togglingArchive, setTogglingArchive] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<PropostaFormState>(emptyForm())
  const isAdmin = session?.perfil === "admin"

  useEffect(() => {
    fetchData()
  }, [id])

  async function fetchData() {
    try {
      setLoading(true)
      const [propostaResponse, comprasResponse, clientesResponse] = await Promise.all([
        fetch(`/api/propostas/${id}`),
        fetch(`/api/compras?proposta_id=${id}&arquivados=todos`),
        fetch("/api/clientes?arquivados=todos"),
      ])

      if (propostaResponse.ok) {
        const propostaPayload = await propostaResponse.json()
        setProposta(propostaPayload)
        setFormData(toFormState(propostaPayload))
      }

      if (comprasResponse.ok) {
        setCompras(await comprasResponse.json())
      }

      if (clientesResponse.ok) {
        setClientes(await clientesResponse.json())
      }
    } finally {
      setLoading(false)
    }
  }

  const resumo = useMemo(() => {
    const realizadoPorCategoria = {
      perfis: 0,
      vidros: 0,
      acessorios: 0,
      perdas: 0,
      outros: 0,
    }

    for (const compra of compras) {
      const distribuicao = getCompraCategoriaDistribuicao(compra)
      realizadoPorCategoria.perfis += distribuicao.valor_categoria_perfis
      realizadoPorCategoria.vidros += distribuicao.valor_categoria_vidros
      realizadoPorCategoria.acessorios += distribuicao.valor_categoria_acessorios
      realizadoPorCategoria.perdas += distribuicao.valor_categoria_perdas
      realizadoPorCategoria.outros += distribuicao.valor_categoria_outros
    }

    const valorRealizado = Object.values(realizadoPorCategoria).reduce((sum, current) => sum + current, 0)
    const custoPerdas = Number(proposta?.custo_perdas ?? 0)
    const valorPrevisto = Number(proposta?.valor_previsto ?? 0)
    const valorConsumido = valorRealizado + custoPerdas
    const diferenca = valorPrevisto - valorConsumido

    return {
      realizadoPorCategoria,
      valorRealizado,
      custoPerdas,
      valorPrevisto,
      valorConsumido,
      diferenca,
      dentroOrcamento: diferenca >= 0,
      percentualUtilizado: valorPrevisto > 0 ? (valorConsumido / valorPrevisto) * 100 : 0,
    }
  }, [compras, proposta])

  const totalCategorias = useMemo(
    () =>
      toNumber(formData.valor_previsto_perfis) +
      toNumber(formData.valor_previsto_vidros) +
      toNumber(formData.valor_previsto_acessorios) +
      toNumber(formData.valor_previsto_outros),
    [
      formData.valor_previsto_acessorios,
      formData.valor_previsto_outros,
      formData.valor_previsto_perfis,
      formData.valor_previsto_vidros,
    ],
  )

  async function handleSave() {
    if (!proposta) {
      return
    }

    if (!formData.cliente_id || !formData.nome.trim()) {
      alert("Cliente e nome sao obrigatorios.")
      return
    }

    setSaving(true)

    try {
      if (!isAdmin) {
        const motivo = window.prompt("Descreva o motivo da alteracao para enviar ao administrador.")
        if (motivo === null) {
          return
        }

        const response = await fetch("/api/solicitacoes-sensiveis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entidade: "proposta",
            entidade_id: proposta.id,
            acao: "editar",
            motivo: motivo.trim() || "Ajuste de cadastro da proposta.",
            payload: {
              cliente_id: Number(formData.cliente_id),
              nome: formData.nome.trim(),
              data_inicio: formData.data_inicio || null,
              data_fim: formData.data_fim || null,
              valor_previsto_perfis: toNumber(formData.valor_previsto_perfis),
              valor_previsto_vidros: toNumber(formData.valor_previsto_vidros),
              valor_previsto_acessorios: toNumber(formData.valor_previsto_acessorios),
              valor_previsto_outros: toNumber(formData.valor_previsto_outros),
              custo_perdas: toNumber(formData.custo_perdas),
            },
          }),
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error || "Erro ao solicitar alteracao da proposta.")
        }

        alert("Solicitacao enviada ao administrador.")
        cancelEditing()
        return
      }

      const response = await fetch(`/api/propostas/${proposta.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: Number(formData.cliente_id),
          nome: formData.nome.trim(),
          data_inicio: formData.data_inicio || null,
          data_fim: formData.data_fim || null,
          valor_previsto_perfis: toNumber(formData.valor_previsto_perfis),
          valor_previsto_vidros: toNumber(formData.valor_previsto_vidros),
          valor_previsto_acessorios: toNumber(formData.valor_previsto_acessorios),
          valor_previsto_outros: toNumber(formData.valor_previsto_outros),
          custo_perdas: toNumber(formData.custo_perdas),
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao salvar proposta.")
      }

      setEditing(false)
      await fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar proposta.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!proposta) {
      return
    }

    setDeleting(true)

    try {
      if (!isAdmin) {
        const motivo = window.prompt("Descreva o motivo da exclusao para enviar ao administrador.")
        if (motivo === null) {
          return
        }

        const response = await fetch("/api/solicitacoes-sensiveis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entidade: "proposta",
            entidade_id: proposta.id,
            acao: "excluir",
            motivo: motivo.trim() || "Exclusao solicitada para a proposta.",
          }),
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error || "Erro ao solicitar exclusao da proposta.")
        }

        alert("Solicitacao enviada ao administrador.")
        return
      }

      if (!confirm("Deseja excluir esta proposta permanentemente?")) {
        return
      }

      const response = await fetch(`/api/propostas/${id}`, { method: "DELETE" })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || "Erro ao excluir proposta.")
      }

      router.push("/propostas")
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao excluir proposta.")
    } finally {
      setDeleting(false)
    }
  }

  async function handleArchiveToggle() {
    if (!proposta) {
      return
    }

    const nextArchivedState = !proposta.arquivado
    const confirmMessage = nextArchivedState
      ? "Deseja arquivar esta proposta?"
      : "Deseja desarquivar esta proposta e voltar com ela para a lista ativa?"

    if (!confirm(confirmMessage)) {
      return
    }

    setTogglingArchive(true)

    try {
      const response = await fetch(`/api/propostas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arquivado: nextArchivedState }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || "Erro ao atualizar arquivamento da proposta.")
      }

      setProposta((current) => (current ? { ...current, arquivado: nextArchivedState } : current))
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao atualizar arquivamento da proposta.")
    } finally {
      setTogglingArchive(false)
    }
  }

  function startEditing() {
    if (!proposta) {
      return
    }

    setFormData(toFormState(proposta))
    setEditing(true)
  }

  function cancelEditing() {
    if (!proposta) {
      return
    }

    setFormData(toFormState(proposta))
    setEditing(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  if (!proposta) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Proposta nao encontrada</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/propostas">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{proposta.nome}</h1>
              {proposta.arquivado && <Badge variant="outline">Arquivada</Badge>}
            </div>
            <p className="text-muted-foreground">{proposta.cliente_nome}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!proposta.arquivado && (
            <Link href={`/compras/novo?proposta_id=${proposta.id}&cliente_id=${proposta.cliente_id}`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Compra
              </Button>
            </Link>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreHorizontal className="mr-2 h-4 w-4" />
                Mais acoes
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={startEditing}>{isAdmin ? "Editar proposta" : "Solicitar alteracao"}</DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchiveToggle} disabled={togglingArchive}>
                {proposta.arquivado ? "Desarquivar proposta" : "Arquivar proposta"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleDelete} disabled={deleting}>
                {isAdmin ? "Excluir proposta" : "Solicitar exclusao"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {editing && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>{isAdmin ? "Edicao da proposta" : "Solicitacao de alteracao da proposta"}</CardTitle>
            <CardDescription>
              {isAdmin
                ? "Edite a proposta com mais seguranca a partir do detalhe, evitando acoes acidentais na lista."
                : "Revise os dados e envie esta alteracao para aprovacao administrativa antes de atualizar a proposta no sistema."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select
                value={formData.cliente_id}
                onValueChange={(value) => setFormData((current) => ({ ...current, cliente_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.filter((cliente) => !cliente.arquivado || cliente.id === proposta.cliente_id).map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id.toString()}>
                      {cliente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nome da proposta *</Label>
              <Input
                value={formData.nome}
                onChange={(event) => setFormData((current) => ({ ...current, nome: event.target.value }))}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Data de inicio">
                <Input
                  type="date"
                  value={formData.data_inicio}
                  onChange={(event) => setFormData((current) => ({ ...current, data_inicio: event.target.value }))}
                />
              </Field>
              <Field label="Data prevista">
                <Input
                  type="date"
                  value={formData.data_fim}
                  onChange={(event) => setFormData((current) => ({ ...current, data_fim: event.target.value }))}
                />
              </Field>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <h3 className="font-medium">Materiais previstos</h3>
                <p className="text-sm text-muted-foreground">Ajuste os valores planejados por categoria.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Perfis">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor_previsto_perfis}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, valor_previsto_perfis: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Vidros">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor_previsto_vidros}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, valor_previsto_vidros: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Acessorios">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor_previsto_acessorios}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, valor_previsto_acessorios: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Outros">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor_previsto_outros}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, valor_previsto_outros: event.target.value }))
                    }
                  />
                </Field>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <StaticValue
                label="Valor previsto total"
                value={formatCurrency(totalCategorias)}
                hint="Calculado automaticamente pela soma das categorias."
              />
              <Field label="Custo de perdas/reposicao">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.custo_perdas}
                  onChange={(event) => setFormData((current) => ({ ...current, custo_perdas: event.target.value }))}
                />
              </Field>
            </div>

            <div className="rounded-lg bg-muted p-3 text-sm">
              <strong>Total previsto calculado:</strong> {formatCurrency(totalCategorias)}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={cancelEditing}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {isAdmin ? "Salvar proposta" : "Enviar para aprovacao"}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        <SummaryCard title="Previsto" value={resumo.valorPrevisto} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} />
        <SummaryCard title="Real comprado" value={resumo.valorRealizado} icon={<ShoppingCart className="h-4 w-4 text-blue-600" />} />
        <SummaryCard title="Perdas/reposicao" value={resumo.custoPerdas} icon={<TriangleAlert className="h-4 w-4 text-amber-600" />} />
        <SummaryCard
          title="Diferenca"
          value={Math.abs(resumo.diferenca)}
          icon={resumo.dentroOrcamento ? <TrendingDown className="h-4 w-4 text-emerald-600" /> : <TrendingUp className="h-4 w-4 text-red-600" />}
          className={resumo.dentroOrcamento ? "text-emerald-600" : "text-red-600"}
          description={resumo.dentroOrcamento ? "Dentro do orcamento" : "Acima do previsto"}
        />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Utilizacao</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">{resumo.percentualUtilizado.toFixed(1)}%</div>
            <Progress
              value={Math.min(resumo.percentualUtilizado, 100)}
              className={resumo.percentualUtilizado > 100 ? "[&>div]:bg-red-500" : ""}
            />
          </CardContent>
        </Card>
      </div>

      <Card className={resumo.dentroOrcamento ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}>
        <CardContent className="flex items-center gap-3 py-4">
          {resumo.dentroOrcamento ? (
            <>
              <TrendingDown className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="font-medium text-emerald-700">Obra dentro do orcamento</p>
                <p className="text-sm text-emerald-700">Saldo disponivel: {formatCurrency(resumo.diferenca)}</p>
              </div>
            </>
          ) : (
            <>
              <TrendingUp className="h-6 w-6 text-red-600" />
              <div>
                <p className="font-medium text-red-700">Obra acima do orcamento</p>
                <p className="text-sm text-red-700">Excedente atual: {formatCurrency(Math.abs(resumo.diferenca))}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Controle por categoria
            </CardTitle>
            <CardDescription>Previsto, realizado e saldo por tipo de material</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <CategoryCard title="Perfis" previsto={proposta.valor_previsto_perfis} realizado={resumo.realizadoPorCategoria.perfis} />
              <CategoryCard title="Vidros" previsto={proposta.valor_previsto_vidros} realizado={resumo.realizadoPorCategoria.vidros} />
              <CategoryCard title="Acessorios" previsto={proposta.valor_previsto_acessorios} realizado={resumo.realizadoPorCategoria.acessorios} />
              <CategoryCard title="Outros" previsto={proposta.valor_previsto_outros} realizado={resumo.realizadoPorCategoria.outros} />
              <CategoryCard title="Perdas/reposicao" previsto={proposta.custo_perdas} realizado={resumo.realizadoPorCategoria.perdas} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Periodo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <PeriodRow label="Inicio" value={proposta.data_inicio} />
              <PeriodRow label="Prevista" value={proposta.data_fim} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Resumo de compras
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <SummaryLine label="Pedidos totais" value={compras.length} />
              <SummaryLine label="Pedidos autorizados" value={compras.filter((compra) => compra.status === "pedido_autorizado").length} />
              <SummaryLine label="Pedidos entregues" value={compras.filter((compra) => compra.status_entrega === "entregue").length} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compras da proposta</CardTitle>
          <CardDescription>{compras.length} pedido(s) vinculados a esta obra</CardDescription>
        </CardHeader>
        <CardContent>
          {compras.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <ShoppingCart className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>Nenhuma compra vinculada.</p>
              {!proposta.arquivado && (
                <Link href={`/compras/novo?proposta_id=${proposta.id}&cliente_id=${proposta.cliente_id}`}>
                  <Button variant="link">Criar primeira compra</Button>
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {compras.map((compra) => (
                  <TableRow key={compra.id}>
                    <TableCell className="font-mono text-sm">#{compra.id}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{CATEGORIA_LABELS[compra.categoria]}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{compra.fornecedor}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
                        {compra.arquivado && <Badge variant="outline">Arquivado</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(compra.valor_total ?? 0)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/compras/${compra.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="mr-2 h-4 w-4" />
                          Ver pedido
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  icon,
  className,
  description,
}: {
  title: string
  value: number
  icon: ReactNode
  className?: string
  description?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${className ?? ""}`}>{formatCurrency(value)}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  )
}

function CategoryCard({
  title,
  previsto,
  realizado,
}: {
  title: string
  previsto: number
  realizado: number
}) {
  const saldo = Number(previsto) - Number(realizado)
  const dentro = saldo >= 0

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">{title}</h3>
        <Badge className={dentro ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
          {dentro ? "No alvo" : "Acima"}
        </Badge>
      </div>
      <div className="space-y-2 text-sm">
        <SummaryLine label="Previsto" value={formatCurrency(previsto)} />
        <SummaryLine label="Realizado" value={formatCurrency(realizado)} />
        <SummaryLine
          label="Saldo"
          value={<span className={dentro ? "text-emerald-600" : "text-red-600"}>{formatCurrency(saldo)}</span>}
        />
      </div>
    </div>
  )
}

function PeriodRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ? format(parseISO(value), "dd/MM/yyyy", { locale: ptBR }) : "Nao definida"}</span>
    </div>
  )
}

function SummaryLine({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
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

function StaticValue({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="rounded-md border bg-background px-3 py-2.5">
        <div className="font-medium text-foreground">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}

function emptyForm(): PropostaFormState {
  return {
    cliente_id: "",
    nome: "",
    data_inicio: "",
    data_fim: "",
    valor_previsto_perfis: "",
    valor_previsto_vidros: "",
    valor_previsto_acessorios: "",
    valor_previsto_outros: "",
    custo_perdas: "",
  }
}

function toFormState(proposta: Proposta): PropostaFormState {
  return {
    cliente_id: proposta.cliente_id.toString(),
    nome: proposta.nome,
    data_inicio: proposta.data_inicio ?? "",
    data_fim: proposta.data_fim ?? "",
    valor_previsto_perfis: proposta.valor_previsto_perfis?.toString() ?? "",
    valor_previsto_vidros: proposta.valor_previsto_vidros?.toString() ?? "",
    valor_previsto_acessorios: proposta.valor_previsto_acessorios?.toString() ?? "",
    valor_previsto_outros: proposta.valor_previsto_outros?.toString() ?? "",
    custo_perdas: proposta.custo_perdas?.toString() ?? "",
  }
}

function toNumber(value: string) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}
