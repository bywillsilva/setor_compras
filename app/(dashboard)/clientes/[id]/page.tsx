"use client"

import { use, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ArrowLeft,
  CircleDollarSign,
  Eye,
  FileStack,
  Loader2,
  Mail,
  Package,
  Phone,
  Plus,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  UserRound,
} from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { RowActionsMenu } from "@/components/shared/row-actions-menu"
import { DeliveryStatusBadge } from "@/components/compras/delivery-status-badge"
import { ListPaginationBar, useListPagination } from "@/components/shared/list-pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CATEGORIA_LABELS, STATUS_BADGE_CLASSES, STATUS_LABELS, getCompraCategoriaDistribuicao, getDeliverySituation } from "@/lib/domain"
import type { Cliente, Compra, Proposta } from "@/lib/types"

type PropostaResumo = {
  proposta: Proposta
  valorRealizado: number
  diferenca: number
  totalPedidos: number
  pedidosEntregues: number
}

export default function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const session = useCurrentSession()
  const router = useRouter()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [compras, setCompras] = useState<Compra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingArchive, setTogglingArchive] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formData, setFormData] = useState({
    nome: "",
    documento: "",
    contato: "",
    email: "",
  })
  const isAdmin = session?.perfil === "admin"

  useEffect(() => {
    let active = true

    async function fetchData() {
      setLoading(true)
      setError(null)

      try {
        const [clienteData, propostasData, comprasData] = await Promise.all([
          fetchJson<Cliente>(`/api/clientes/${id}`, "Nao foi possivel carregar o cliente."),
          fetchJson<Proposta[]>(`/api/propostas?cliente_id=${id}&arquivados=todos`, "Nao foi possivel carregar as propostas."),
          fetchJson<Compra[]>(`/api/compras?cliente_id=${id}&arquivados=todos`, "Nao foi possivel carregar as compras."),
        ])

        if (!active) {
          return
        }

        setCliente(clienteData)
        setFormData({
          nome: clienteData.nome,
          documento: clienteData.documento ?? "",
          contato: clienteData.contato ?? "",
          email: clienteData.email ?? "",
        })
        setPropostas(propostasData)
        setCompras(comprasData)
      } catch (requestError) {
        if (!active) {
          return
        }

        setError(requestError instanceof Error ? requestError.message : "Erro ao carregar os dados do cliente.")
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      active = false
    }
  }, [id])

  const comprasOrdenadas = useMemo(
    () =>
      [...compras].sort(
        (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
      ),
    [compras],
  )

  const propostasResumo = useMemo<PropostaResumo[]>(
    () =>
      [...propostas]
        .map((proposta) => {
          const comprasDaProposta = compras.filter((compra) => compra.proposta_id === proposta.id)
          const valorRealizado = comprasDaProposta.reduce((sum, compra) => sum + Number(compra.valor_total ?? 0), 0)
          const diferenca = Number(proposta.valor_previsto) - (valorRealizado + Number(proposta.custo_perdas ?? 0))

          return {
            proposta,
            valorRealizado,
            diferenca,
            totalPedidos: comprasDaProposta.length,
            pedidosEntregues: comprasDaProposta.filter((compra) => compra.status_entrega === "entregue").length,
          }
        })
        .sort((left, right) => left.proposta.nome.localeCompare(right.proposta.nome)),
    [propostas, compras],
  )
  const propostasPagination = useListPagination(propostasResumo, {
    storageKey: `cliente-${id}-propostas-page-size`,
  })
  const comprasPagination = useListPagination(comprasOrdenadas, {
    storageKey: `cliente-${id}-compras-page-size`,
  })

  const resumo = useMemo(() => {
    const gastoPorCategoria = {
      perfis: 0,
      vidros: 0,
      acessorios: 0,
      perdas: 0,
      outros: 0,
    }

    for (const compra of compras) {
      const distribuicao = getCompraCategoriaDistribuicao(compra)
      gastoPorCategoria.perfis += distribuicao.valor_categoria_perfis
      gastoPorCategoria.vidros += distribuicao.valor_categoria_vidros
      gastoPorCategoria.acessorios += distribuicao.valor_categoria_acessorios
      gastoPorCategoria.perdas += distribuicao.valor_categoria_perdas
      gastoPorCategoria.outros += distribuicao.valor_categoria_outros
    }

    const valorPrevisto = propostas.reduce((sum, proposta) => sum + Number(proposta.valor_previsto ?? 0), 0)
    const valorComprado = compras.reduce((sum, compra) => sum + Number(compra.valor_total ?? 0), 0)
    const custoPerdas = propostas.reduce((sum, proposta) => sum + Number(proposta.custo_perdas ?? 0), 0)
    const valorConsumido = valorComprado + custoPerdas
    const diferenca = valorPrevisto - valorConsumido

    return {
      totalPropostas: propostas.length,
      totalCompras: compras.length,
      pedidosAutorizados: compras.filter((compra) => compra.status === "pedido_autorizado").length,
      pedidosEntregues: compras.filter((compra) => compra.status_entrega === "entregue").length,
      pedidosEmCotacao: compras.filter((compra) => compra.status === "cotacao").length,
      pedidosEmAnalise: compras.filter((compra) => compra.status === "em_analise").length,
      pedidosAtrasados: compras.filter((compra) => getDeliverySituation(compra) === "atrasado").length,
      pedidosProximos: compras.filter((compra) => getDeliverySituation(compra) === "proximo").length,
      fornecedoresAtivos: new Set(compras.map((compra) => compra.fornecedor.trim().toLowerCase()).filter(Boolean)).size,
      valorPrevisto,
      valorComprado,
      custoPerdas,
      valorConsumido,
      diferenca,
      dentroOrcamento: diferenca >= 0,
      percentualUtilizado: valorPrevisto > 0 ? (valorConsumido / valorPrevisto) * 100 : 0,
      gastoPorCategoria,
    }
  }, [compras, propostas])

  async function handleArchiveToggle() {
    if (!cliente) {
      return
    }

    const nextArchivedState = !cliente.arquivado
    const confirmMessage = nextArchivedState
      ? "Deseja arquivar este cliente?"
      : "Deseja desarquivar este cliente e voltar com ele para a lista ativa?"

    if (!confirm(confirmMessage)) {
      return
    }

    setTogglingArchive(true)

    try {
      const response = await fetch(`/api/clientes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arquivado: nextArchivedState }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || "Erro ao atualizar arquivamento do cliente.")
      }

      setCliente((current) => (current ? { ...current, arquivado: nextArchivedState } : current))
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao atualizar arquivamento do cliente.")
    } finally {
      setTogglingArchive(false)
    }
  }

  async function handleSave() {
    if (!formData.nome.trim()) {
      alert("Nome e obrigatorio.")
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
            entidade: "cliente",
            entidade_id: Number(id),
            acao: "editar",
            motivo: motivo.trim() || "Ajuste de cadastro do cliente.",
            payload: {
              nome: formData.nome.trim(),
              documento: formData.documento || null,
              contato: formData.contato || null,
              email: formData.email || null,
            },
          }),
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error || "Erro ao solicitar alteracao do cliente.")
        }

        alert("Solicitacao enviada ao administrador.")
        cancelEditing()
        return
      }

      const response = await fetch(`/api/clientes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formData.nome.trim(),
          documento: formData.documento || null,
          contato: formData.contato || null,
          email: formData.email || null,
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao salvar cliente.")
      }

      setCliente((current) =>
        current
          ? {
              ...current,
              nome: formData.nome.trim(),
              documento: formData.documento || null,
              contato: formData.contato || null,
              email: formData.email || null,
            }
          : current,
      )
      setEditing(false)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar cliente.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
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
            entidade: "cliente",
            entidade_id: Number(id),
            acao: "excluir",
            motivo: motivo.trim() || "Exclusao solicitada para o cliente.",
          }),
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error || "Erro ao solicitar exclusao do cliente.")
        }

        alert("Solicitacao enviada ao administrador.")
        return
      }

      if (!confirm("Deseja realmente excluir este cliente? A exclusao so e permitida quando nao houver propostas ou compras vinculadas.")) {
        return
      }

      const response = await fetch(`/api/clientes/${id}`, { method: "DELETE" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao excluir cliente.")
      }

      router.push("/clientes")
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao excluir cliente.")
    } finally {
      setDeleting(false)
    }
  }

  function startEditing() {
    if (!cliente) {
      return
    }

    setFormData({
      nome: cliente.nome,
      documento: cliente.documento ?? "",
      contato: cliente.contato ?? "",
      email: cliente.email ?? "",
    })
    setEditing(true)
  }

  function cancelEditing() {
    if (!cliente) {
      return
    }

    setFormData({
      nome: cliente.nome,
      documento: cliente.documento ?? "",
      contato: cliente.contato ?? "",
      email: cliente.email ?? "",
    })
    setEditing(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  if (error || !cliente) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <Link href="/clientes">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para clientes
          </Button>
        </Link>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Nao foi possivel abrir o resumo do cliente</CardTitle>
            <CardDescription>{error ?? "Cliente nao encontrado."}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/clientes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{cliente.nome}</h1>
              {cliente.arquivado && <Badge variant="outline">Arquivado</Badge>}
            </div>
            <p className="text-muted-foreground">Resumo de propostas, pedidos e gastos deste cliente</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!cliente.arquivado && !editing && (
            <Link href={`/compras/novo?cliente_id=${cliente.id}`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova compra
              </Button>
            </Link>
          )}

          {editing ? (
            <>
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
                  isAdmin ? "Salvar" : "Enviar para aprovacao"
                )}
              </Button>
            </>
          ) : (
            <RowActionsMenu label={`Acoes do cliente ${cliente.nome}`}>
              <DropdownMenuItem onClick={startEditing}>{isAdmin ? "Editar cadastro" : "Solicitar alteracao"}</DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchiveToggle} disabled={togglingArchive}>
                {togglingArchive ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : cliente.arquivado ? (
                  "Desarquivar cliente"
                ) : (
                  "Arquivar cliente"
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleDelete} disabled={deleting}>
                {isAdmin ? "Excluir cliente" : "Solicitar exclusao"}
              </DropdownMenuItem>
            </RowActionsMenu>
          )}
        </div>
      </div>

      {editing && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Edicao do cliente</CardTitle>
            <CardDescription>Faça ajustes no cadastro a partir do detalhe para reduzir o risco de alteracoes acidentais.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Nome *">
              <Input value={formData.nome} onChange={(event) => setFormData((current) => ({ ...current, nome: event.target.value }))} />
            </Field>
            <Field label="Documento">
              <Input
                value={formData.documento}
                onChange={(event) => setFormData((current) => ({ ...current, documento: event.target.value }))}
              />
            </Field>
            <Field label="Contato">
              <Input value={formData.contato} onChange={(event) => setFormData((current) => ({ ...current, contato: event.target.value }))} />
            </Field>
            <Field label="E-mail">
              <Input value={formData.email} onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))} />
            </Field>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          title="Propostas"
          value={resumo.totalPropostas}
          description="Obras vinculadas"
          icon={<FileStack className="h-4 w-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="Pedidos"
          value={resumo.totalCompras}
          description={`${resumo.fornecedoresAtivos} fornecedor(es) ativos`}
          icon={<ShoppingCart className="h-4 w-4 text-blue-600" />}
        />
        <SummaryCard
          title="Previsto total"
          value={formatCurrency(resumo.valorPrevisto)}
          icon={<CircleDollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="Comprado"
          value={formatCurrency(resumo.valorComprado)}
          icon={<Package className="h-4 w-4 text-blue-600" />}
        />
        <SummaryCard
          title="Perdas/reposicao"
          value={formatCurrency(resumo.custoPerdas)}
          icon={<TriangleAlert className="h-4 w-4 text-amber-600" />}
        />
        <SummaryCard
          title="Diferenca"
          value={formatCurrency(Math.abs(resumo.diferenca))}
          description={resumo.dentroOrcamento ? "Saldo disponivel" : "Acima do previsto"}
          className={resumo.dentroOrcamento ? "text-emerald-600" : "text-red-600"}
          icon={
            resumo.dentroOrcamento ? (
              <TrendingDown className="h-4 w-4 text-emerald-600" />
            ) : (
              <TrendingUp className="h-4 w-4 text-red-600" />
            )
          }
        />
      </div>

      <Card className={resumo.dentroOrcamento ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}>
        <CardContent className="space-y-4 py-4">
          <div className="flex items-start gap-3">
            {resumo.dentroOrcamento ? (
              <TrendingDown className="mt-0.5 h-6 w-6 text-emerald-600" />
            ) : (
              <TrendingUp className="mt-0.5 h-6 w-6 text-red-600" />
            )}
            <div className="space-y-1">
              <p className={`font-medium ${resumo.dentroOrcamento ? "text-emerald-700" : "text-red-700"}`}>
                {resumo.dentroOrcamento ? "Cliente dentro do orcamento previsto" : "Cliente acima do orcamento previsto"}
              </p>
              <p className={`text-sm ${resumo.dentroOrcamento ? "text-emerald-700" : "text-red-700"}`}>
                {resumo.dentroOrcamento
                  ? `Saldo disponivel atual: ${formatCurrency(resumo.diferenca)}`
                  : `Excedente atual: ${formatCurrency(Math.abs(resumo.diferenca))}`}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className={resumo.dentroOrcamento ? "text-emerald-700" : "text-red-700"}>Utilizacao consolidada</span>
              <span className="font-medium">{resumo.percentualUtilizado.toFixed(1)}%</span>
            </div>
            <Progress
              value={Math.min(resumo.percentualUtilizado, 100)}
              className={resumo.percentualUtilizado > 100 ? "[&>div]:bg-red-500" : ""}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Informacoes do cliente</CardTitle>
            <CardDescription>Dados gerais e ultimo movimento registrado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow
              icon={<UserRound className="h-4 w-4 text-muted-foreground" />}
              label="Documento"
              value={cliente.documento || "Nao informado"}
            />
            <InfoRow
              icon={<Phone className="h-4 w-4 text-muted-foreground" />}
              label="Contato"
              value={cliente.contato || "Nao informado"}
            />
            <InfoRow
              icon={<Mail className="h-4 w-4 text-muted-foreground" />}
              label="E-mail"
              value={cliente.email || "Nao informado"}
            />
            <InfoRow
              icon={<FileStack className="h-4 w-4 text-muted-foreground" />}
              label="Ultima atualizacao"
              value={formatDate(comprasOrdenadas[0]?.updated_at ?? cliente.updated_at)}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Panorama operacional</CardTitle>
              <CardDescription>Situacao atual das compras deste cliente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <SummaryLine label="Pedidos em cotacao" value={resumo.pedidosEmCotacao} />
              <SummaryLine label="Pedidos em analise" value={resumo.pedidosEmAnalise} />
              <SummaryLine label="Pedidos autorizados" value={resumo.pedidosAutorizados} />
              <SummaryLine label="Pedidos entregues" value={resumo.pedidosEntregues} />
              <SummaryLine
                label="Alertas de entrega"
                value={
                  <span className="text-right">
                    {resumo.pedidosAtrasados} atrasado(s)
                    {resumo.pedidosProximos > 0 ? ` / ${resumo.pedidosProximos} proximo(s)` : ""}
                  </span>
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gastos por categoria</CardTitle>
              <CardDescription>Quanto ja foi comprado em cada grupo de material</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <SummaryLine label="Perfis" value={formatCurrency(resumo.gastoPorCategoria.perfis)} />
              <SummaryLine label="Vidros" value={formatCurrency(resumo.gastoPorCategoria.vidros)} />
              <SummaryLine label="Acessorios" value={formatCurrency(resumo.gastoPorCategoria.acessorios)} />
              <SummaryLine label="Outros" value={formatCurrency(resumo.gastoPorCategoria.outros)} />
              <SummaryLine label="Perdas/reposicao" value={formatCurrency(resumo.gastoPorCategoria.perdas)} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Propostas vinculadas</CardTitle>
          <CardDescription>{propostasResumo.length} proposta(s) cadastrada(s) para este cliente</CardDescription>
        </CardHeader>
        <CardContent>
          {propostasResumo.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileStack className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>Nenhuma proposta vinculada a este cliente.</p>
              <Link href="/propostas">
                <Button variant="link">Ir para cadastro de propostas</Button>
              </Link>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proposta</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Previsto</TableHead>
                    <TableHead>Comprado</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Pedidos</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propostasPagination.items.map(({ proposta, valorRealizado, diferenca, totalPedidos, pedidosEntregues }) => {
                    const dentro = diferenca >= 0

                    return (
                      <TableRow key={proposta.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{proposta.nome}</div>
                            <div className="text-xs text-muted-foreground">
                              {pedidosEntregues} entregue(s) de {totalPedidos}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{formatPeriod(proposta.data_inicio, proposta.data_fim)}</TableCell>
                        <TableCell>{formatCurrency(proposta.valor_previsto)}</TableCell>
                        <TableCell>{formatCurrency(valorRealizado)}</TableCell>
                        <TableCell>
                          <Badge className={dentro ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                            {formatCurrency(diferenca)}
                          </Badge>
                        </TableCell>
                        <TableCell>{totalPedidos}</TableCell>
                        <TableCell className="text-right">
                          <Link href={`/propostas/${proposta.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <div className="mt-4">
                <ListPaginationBar
                  currentPage={propostasPagination.currentPage}
                  endItem={propostasPagination.endItem}
                  itemLabel="proposta(s)"
                  onPageChange={propostasPagination.setPage}
                  onPageSizeChange={propostasPagination.setPageSize}
                  pageSize={propostasPagination.pageSize}
                  startItem={propostasPagination.startItem}
                  totalItems={propostasPagination.totalItems}
                  totalPages={propostasPagination.totalPages}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compras do cliente</CardTitle>
          <CardDescription>{comprasOrdenadas.length} pedido(s) vinculados a este cliente</CardDescription>
        </CardHeader>
        <CardContent>
          {comprasOrdenadas.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <ShoppingCart className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>Nenhuma compra registrada para este cliente.</p>
              <Link href={`/compras/novo?cliente_id=${cliente.id}`}>
                <Button variant="link">Cadastrar primeira compra</Button>
              </Link>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Proposta</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comprasPagination.items.map((compra) => (
                    <TableRow key={compra.id}>
                      <TableCell className="font-mono text-sm">#{compra.id}</TableCell>
                      <TableCell>{compra.proposta_nome || "-"}</TableCell>
                      <TableCell className="font-medium">{compra.fornecedor}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{CATEGORIA_LABELS[compra.categoria]}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
                          {compra.arquivado && <Badge variant="outline">Arquivado</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DeliveryStatusBadge compra={compra} />
                      </TableCell>
                      <TableCell>{formatCurrency(compra.valor_total ?? 0)}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/compras/${compra.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4">
                <ListPaginationBar
                  currentPage={comprasPagination.currentPage}
                  endItem={comprasPagination.endItem}
                  itemLabel="pedido(s)"
                  onPageChange={comprasPagination.setPage}
                  onPageSizeChange={comprasPagination.setPageSize}
                  pageSize={comprasPagination.pageSize}
                  startItem={comprasPagination.startItem}
                  totalItems={comprasPagination.totalItems}
                  totalPages={comprasPagination.totalPages}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

async function fetchJson<T>(url: string, fallbackMessage: string): Promise<T> {
  const response = await fetch(url)

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error || fallbackMessage)
  }

  return response.json()
}

function SummaryCard({
  title,
  value,
  icon,
  description,
  className,
}: {
  title: string
  value: ReactNode
  icon: ReactNode
  description?: string
  className?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${className ?? ""}`}>{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  )
}

function SummaryLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
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

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function formatDate(value: string | null) {
  if (!value) {
    return "Nao informada"
  }

  return format(parseISO(value), "dd/MM/yyyy", { locale: ptBR })
}

function formatPeriod(start: string | null, end: string | null) {
  if (!start && !end) {
    return "Nao definido"
  }

  const startLabel = start ? formatDate(start) : "sem inicio"
  const endLabel = end ? formatDate(end) : "sem previsao"
  return `${startLabel} ate ${endLabel}`
}
