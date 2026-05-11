"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckCircle2, ClipboardList, Eye, Loader2, Plus } from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { ListFilterField, ListFilterGrid, ListFilterPanel } from "@/components/shared/list-filter-panel"
import { PageHeader, SectionCard, SummaryMetricCard } from "@/components/shared/page-layout"
import { RowActionsMenu } from "@/components/shared/row-actions-menu"
import { TableTextPreview } from "@/components/shared/table-text-preview"
import { SortableTableHead, TableFilterInput, type SortDirection } from "@/components/shared/table-tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { hasFeatureAccess } from "@/lib/auth/permissions"
import {
  ETAPA_FLUXO_BADGE_CLASSES,
  ETAPA_FLUXO_LABELS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from "@/lib/domain"
import type { Compra } from "@/lib/types"

type SortColumn = "solicitacao" | "cliente" | "fornecedor" | "atualizado"

export default function SolicitacoesPage() {
  const session = useCurrentSession()
  const [compras, setCompras] = useState<Compra[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [filters, setFilters] = useState({
    solicitacao: "",
    cliente: "",
    fornecedor: "",
    etapa: "todos",
    updatedFrom: "",
    updatedTo: "",
  })
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: "atualizado",
    direction: "desc",
  })

  const canCreateSolicitacao = Boolean(session && hasFeatureAccess(session.perfil, "solicitacoes", session.features))

  async function fetchSolicitacoes() {
    try {
      setLoading(true)
      const response = await fetch("/api/solicitacoes")
      if (!response.ok) {
        throw new Error("Erro ao carregar solicitacoes.")
      }

      setCompras(await response.json())
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchSolicitacoes()
  }, [])

  async function handleApprove(compraId: number) {
    setProcessingId(compraId)

    try {
      const response = await fetch(`/api/solicitacoes/${compraId}/aprovar`, { method: "POST" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao aprovar solicitacao.")
      }

      await fetchSolicitacoes()
      alert("Solicitacao aprovada para seguir ao administrativo.")
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao aprovar solicitacao.")
    } finally {
      setProcessingId(null)
    }
  }

  const filteredCompras = useMemo(() => {
    return [...compras]
      .filter((compra) => {
        const matchesSolicitacao =
          !filters.solicitacao ||
          `#${compra.id}`.toLowerCase().includes(filters.solicitacao.toLowerCase()) ||
          (compra.proposta_nome ?? "").toLowerCase().includes(filters.solicitacao.toLowerCase())

        const matchesCliente =
          !filters.cliente || (compra.cliente_nome ?? "").toLowerCase().includes(filters.cliente.toLowerCase())

        const matchesFornecedor =
          !filters.fornecedor ||
          compra.fornecedor.toLowerCase().includes(filters.fornecedor.toLowerCase()) ||
          compra.descricao.toLowerCase().includes(filters.fornecedor.toLowerCase())

        const matchesEtapa = filters.etapa === "todos" || compra.etapa_fluxo === filters.etapa
        const matchesUpdatedFrom = !filters.updatedFrom || compra.updated_at.slice(0, 10) >= filters.updatedFrom
        const matchesUpdatedTo = !filters.updatedTo || compra.updated_at.slice(0, 10) <= filters.updatedTo

        return (
          matchesSolicitacao &&
          matchesCliente &&
          matchesFornecedor &&
          matchesEtapa &&
          matchesUpdatedFrom &&
          matchesUpdatedTo
        )
      })
      .sort((left, right) => sortCompras(left, right, sort))
  }, [compras, filters, sort])

  const resumo = useMemo(
    () => ({
      total: filteredCompras.length,
      emCotacao: filteredCompras.filter((compra) =>
        ["solicitacao_registrada", "cotacao_em_andamento", "retificacao"].includes(compra.etapa_fluxo),
      ).length,
      emAnalise: filteredCompras.filter((compra) => compra.etapa_fluxo === "analise_solicitante").length,
      aprovadas: filteredCompras.filter((compra) =>
        ["aprovada_solicitante", "aguardando_admin", "aprovada_admin", "aguardando_financeiro", "liberada_para_fornecedor", "pedido_autorizado"].includes(
          compra.etapa_fluxo,
        ),
      ).length,
    }),
    [filteredCompras],
  )

  function toggleSort(column: SortColumn) {
    setSort((current) => ({
      column,
      direction: current.column === column && current.direction === "asc" ? "desc" : "asc",
    }))
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Solicitacoes"
        description="Registre a necessidade de material da obra e acompanhe a aprovacao da cotacao pelo seu setor."
        actions={
          canCreateSolicitacao ? (
            <Link href="/solicitacoes/novo">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova solicitacao
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryMetricCard title="Registradas" value={resumo.total} description="Solicitacoes abertas nesta visao" />
        <SummaryMetricCard title="Em cotacao" value={resumo.emCotacao} description="Aguardando retorno do comprador" />
        <SummaryMetricCard title="Em analise" value={resumo.emAnalise} description="Aguardando sua assinatura" />
      </div>

      <SectionCard title="Fila de solicitacoes" description={`${filteredCompras.length} pedido(s) nesta visao`}>
        <ListFilterPanel
          trailing={
            <DateRangeFilter
              startDate={filters.updatedFrom}
              endDate={filters.updatedTo}
              onStartDateChange={(value) => setFilters((current) => ({ ...current, updatedFrom: value }))}
              onEndDateChange={(value) => setFilters((current) => ({ ...current, updatedTo: value }))}
              onClear={() => setFilters((current) => ({ ...current, updatedFrom: "", updatedTo: "" }))}
              startLabel="Atualizado de"
              endLabel="Atualizado ate"
            />
          }
        >
          <ListFilterGrid columns="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ListFilterField label="Solicitacao">
              <TableFilterInput
                value={filters.solicitacao}
                onChange={(value) => setFilters((current) => ({ ...current, solicitacao: value }))}
                placeholder="ID ou proposta"
              />
            </ListFilterField>

            <ListFilterField label="Cliente">
              <TableFilterInput
                value={filters.cliente}
                onChange={(value) => setFilters((current) => ({ ...current, cliente: value }))}
                placeholder="Filtrar cliente"
              />
            </ListFilterField>

            <ListFilterField label="Fornecedor ou material">
              <TableFilterInput
                value={filters.fornecedor}
                onChange={(value) => setFilters((current) => ({ ...current, fornecedor: value }))}
                placeholder="Fornecedor ou material"
              />
            </ListFilterField>

            <ListFilterField label="Etapa">
              <Select value={filters.etapa} onValueChange={(value) => setFilters((current) => ({ ...current, etapa: value }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="solicitacao_registrada">Registrada</SelectItem>
                  <SelectItem value="cotacao_em_andamento">Em cotacao</SelectItem>
                  <SelectItem value="analise_solicitante">Em analise</SelectItem>
                  <SelectItem value="retificacao">Retificacao</SelectItem>
                  <SelectItem value="aprovada_solicitante">Aprovada</SelectItem>
                </SelectContent>
              </Select>
            </ListFilterField>
          </ListFilterGrid>
        </ListFilterPanel>
        {filteredCompras.length === 0 ? (
          <div className="space-y-4 rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            <p>Nenhuma solicitacao encontrada para os filtros atuais.</p>
            {canCreateSolicitacao ? (
              <Link href="/solicitacoes/novo">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Registrar nova solicitacao
                </Button>
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortableTableHead
                      label="Solicitacao"
                      isActive={sort.column === "solicitacao"}
                      direction={sort.direction}
                      onClick={() => toggleSort("solicitacao")}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableTableHead
                      label="Cliente"
                      isActive={sort.column === "cliente"}
                      direction={sort.direction}
                      onClick={() => toggleSort("cliente")}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableTableHead
                      label="Fornecedor"
                      isActive={sort.column === "fornecedor"}
                      direction={sort.direction}
                      onClick={() => toggleSort("fornecedor")}
                    />
                  </TableHead>
                  <TableHead>Situacao</TableHead>
                  <TableHead>
                    <SortableTableHead
                      label="Atualizado"
                      isActive={sort.column === "atualizado"}
                      direction={sort.direction}
                      onClick={() => toggleSort("atualizado")}
                    />
                  </TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompras.map((compra) => {
                  const isProcessing = processingId === compra.id
                  const canApprove = session?.userId === compra.solicitante_id && compra.etapa_fluxo === "analise_solicitante"

                  return (
                    <TableRow key={compra.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-mono text-sm font-medium">#{compra.id}</div>
                          <TableTextPreview
                            text={compra.proposta_nome}
                            fallback="Sem proposta"
                            className="max-w-[190px]"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{compra.cliente_nome}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div>{compra.fornecedor}</div>
                          <TableTextPreview text={compra.descricao} className="max-w-[220px]" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Badge className={ETAPA_FLUXO_BADGE_CLASSES[compra.etapa_fluxo]}>
                            {ETAPA_FLUXO_LABELS[compra.etapa_fluxo]}
                          </Badge>
                          {shouldShowSolicitacaoStatus(compra) ? (
                            <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(compra.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu label={`Acoes da solicitacao ${compra.id}`}>
                          <DropdownMenuItem asChild>
                            <Link href={`/solicitacoes/${compra.id}`}>
                              <Eye className="h-4 w-4" />
                              Abrir solicitacao
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />

                          {canApprove ? (
                            <DropdownMenuItem onClick={() => handleApprove(compra.id)} disabled={isProcessing}>
                              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              {isProcessing ? "Aprovando..." : "Aprovar solicitacao de compra"}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem disabled>
                              <ClipboardList className="h-4 w-4" />
                              Sem acao imediata
                            </DropdownMenuItem>
                          )}
                        </RowActionsMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function sortCompras(
  left: Compra,
  right: Compra,
  sort: { column: SortColumn; direction: SortDirection },
) {
  const modifier = sort.direction === "asc" ? 1 : -1

  switch (sort.column) {
    case "solicitacao":
      return (`#${left.id}`.localeCompare(`#${right.id}`, "pt-BR")) * modifier
    case "cliente":
      return ((left.cliente_nome ?? "").localeCompare(right.cliente_nome ?? "", "pt-BR")) * modifier
    case "fornecedor":
      return left.fornecedor.localeCompare(right.fornecedor, "pt-BR") * modifier
    case "atualizado":
    default:
      return (new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime()) * modifier
  }
}

function shouldShowSolicitacaoStatus(compra: Compra) {
  if (compra.etapa_fluxo === "cotacao_em_andamento" && compra.status === "cotacao") {
    return false
  }

  if (compra.etapa_fluxo === "analise_solicitante" && compra.status === "em_analise") {
    return false
  }

  if (compra.etapa_fluxo === "retificacao" && compra.status === "retificacao") {
    return false
  }

  if (compra.etapa_fluxo === "pedido_autorizado" && compra.status === "pedido_autorizado") {
    return false
  }

  return true
}
