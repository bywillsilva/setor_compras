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
  Package,
  Plus,
  ShoppingCart,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CATEGORIA_LABELS, STATUS_BADGE_CLASSES, STATUS_LABELS } from "@/lib/domain"
import type { Compra, Proposta } from "@/lib/types"

export default function PropostaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [proposta, setProposta] = useState<Proposta | null>(null)
  const [compras, setCompras] = useState<Compra[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [togglingArchive, setTogglingArchive] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const [propostaResponse, comprasResponse] = await Promise.all([
          fetch(`/api/propostas/${id}`),
          fetch(`/api/compras?proposta_id=${id}&arquivados=todos`),
        ])

        if (propostaResponse.ok) {
          setProposta(await propostaResponse.json())
        }

        if (comprasResponse.ok) {
          setCompras(await comprasResponse.json())
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  const resumo = useMemo(() => {
    const realizadoPorCategoria = {
      perfis: 0,
      vidros: 0,
      acessorios: 0,
      perdas: 0,
    }

    for (const compra of compras) {
      realizadoPorCategoria[compra.categoria] += Number(compra.valor_total ?? 0)
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

  async function handleDelete() {
    if (!proposta) {
      return
    }

    if (!confirm("Deseja excluir esta proposta permanentemente?")) {
      return
    }

    setDeleting(true)

    try {
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
            <CardTitle className="text-destructive">Proposta não encontrada</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
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
          <Button variant="outline" onClick={handleArchiveToggle} disabled={togglingArchive}>
            {togglingArchive ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : proposta.arquivado ? (
              "Desarquivar"
            ) : (
              "Arquivar"
            )}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir proposta
              </>
            )}
          </Button>
          {!proposta.arquivado && (
            <Link href={`/compras/novo?proposta_id=${proposta.id}&cliente_id=${proposta.cliente_id}`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Compra
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <SummaryCard title="Previsto" value={resumo.valorPrevisto} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} />
        <SummaryCard title="Real comprado" value={resumo.valorRealizado} icon={<ShoppingCart className="h-4 w-4 text-blue-600" />} />
        <SummaryCard title="Perdas/reposição" value={resumo.custoPerdas} icon={<TriangleAlert className="h-4 w-4 text-amber-600" />} />
        <SummaryCard
          title="Diferença"
          value={Math.abs(resumo.diferenca)}
          icon={resumo.dentroOrcamento ? <TrendingDown className="h-4 w-4 text-emerald-600" /> : <TrendingUp className="h-4 w-4 text-red-600" />}
          className={resumo.dentroOrcamento ? "text-emerald-600" : "text-red-600"}
          description={resumo.dentroOrcamento ? "Dentro do orçamento" : "Acima do previsto"}
        />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Utilização</CardTitle>
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
                <p className="font-medium text-emerald-700">Obra dentro do orçamento</p>
                <p className="text-sm text-emerald-700">
                  Saldo disponível: {formatCurrency(resumo.diferenca)}
                </p>
              </div>
            </>
          ) : (
            <>
              <TrendingUp className="h-6 w-6 text-red-600" />
              <div>
                <p className="font-medium text-red-700">Obra acima do orçamento</p>
                <p className="text-sm text-red-700">
                  Excedente atual: {formatCurrency(Math.abs(resumo.diferenca))}
                </p>
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
              <CategoryCard
                title="Perfis"
                previsto={proposta.valor_previsto_perfis}
                realizado={resumo.realizadoPorCategoria.perfis}
              />
              <CategoryCard
                title="Vidros"
                previsto={proposta.valor_previsto_vidros}
                realizado={resumo.realizadoPorCategoria.vidros}
              />
              <CategoryCard
                title="Acessórios"
                previsto={proposta.valor_previsto_acessorios}
                realizado={resumo.realizadoPorCategoria.acessorios}
              />
              <CategoryCard
                title="Perdas"
                previsto={proposta.valor_previsto_outros}
                realizado={resumo.realizadoPorCategoria.perdas}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Período
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <PeriodRow label="Início" value={proposta.data_inicio} />
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
              <Link href={`/compras/novo?proposta_id=${proposta.id}&cliente_id=${proposta.cliente_id}`}>
                <Button variant="link">Criar primeira compra</Button>
              </Link>
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
                  <TableHead className="text-right">Ações</TableHead>
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
                        <Badge className={STATUS_BADGE_CLASSES[compra.status]}>
                          {STATUS_LABELS[compra.status]}
                        </Badge>
                        {compra.arquivado && <Badge variant="outline">Arquivado</Badge>}
                      </div>
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
      <span className="font-medium">
        {value ? format(parseISO(value), "dd/MM/yyyy", { locale: ptBR }) : "Não definida"}
      </span>
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}
