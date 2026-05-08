"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, Eye } from "lucide-react"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { ListFilterField, ListFilterGrid, ListFilterPanel } from "@/components/shared/list-filter-panel"
import { PageHeader, SectionCard, SummaryMetricCard } from "@/components/shared/page-layout"
import { SortableTableHead, TableFilterInput, type SortDirection } from "@/components/shared/table-tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Proposta } from "@/lib/types"

type SortColumn = "proposta" | "cliente" | "criacao" | "atualizacao"

export default function OrcamentosPage() {
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    proposta: "",
    cliente: "",
    createdFrom: "",
    createdTo: "",
  })
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: "criacao",
    direction: "desc",
  })

  useEffect(() => {
    async function fetchOrcamentos() {
      try {
        setLoading(true)
        const response = await fetch("/api/orcamentos")

        if (response.ok) {
          setPropostas(await response.json())
        }
      } finally {
        setLoading(false)
      }
    }

    void fetchOrcamentos()
  }, [])

  const pendingPropostas = useMemo(() => propostas.filter((proposta) => isOrcamentoPendente(proposta)), [propostas])

  const filteredPropostas = useMemo(() => {
    return [...pendingPropostas]
      .filter((proposta) => {
        const matchesProposta =
          !filters.proposta || proposta.nome.toLowerCase().includes(filters.proposta.toLowerCase())
        const matchesCliente =
          !filters.cliente || (proposta.cliente_nome ?? "").toLowerCase().includes(filters.cliente.toLowerCase())
        const matchesCreatedFrom = !filters.createdFrom || proposta.created_at.slice(0, 10) >= filters.createdFrom
        const matchesCreatedTo = !filters.createdTo || proposta.created_at.slice(0, 10) <= filters.createdTo

        return matchesProposta && matchesCliente && matchesCreatedFrom && matchesCreatedTo
      })
      .sort((left, right) => sortPropostas(left, right, sort))
  }, [filters, pendingPropostas, sort])

  const resumo = useMemo(
    () => ({
      pendentes: pendingPropostas.length,
      filtradas: filteredPropostas.length,
    }),
    [filteredPropostas.length, pendingPropostas.length],
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
        title="Orcamentos"
        description="A fila mostra apenas propostas que ainda aguardam o lancamento do previsto de materiais."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryMetricCard title="Pendentes" value={resumo.pendentes} description="Propostas aguardando orcamento inicial" />
        <SummaryMetricCard title="Na visao atual" value={resumo.filtradas} description="Pendencias depois dos filtros aplicados" />
      </div>

      <SectionCard
        title="Fila pendente de orcamentos"
        description={`${filteredPropostas.length} proposta(s) aguardando o preenchimento do previsto`}
      >
        <ListFilterPanel
          trailing={
            <DateRangeFilter
              startDate={filters.createdFrom}
              endDate={filters.createdTo}
              onStartDateChange={(value) => setFilters((current) => ({ ...current, createdFrom: value }))}
              onEndDateChange={(value) => setFilters((current) => ({ ...current, createdTo: value }))}
              onClear={() => setFilters((current) => ({ ...current, createdFrom: "", createdTo: "" }))}
              startLabel="Cadastro de"
              endLabel="Cadastro ate"
            />
          }
        >
          <ListFilterGrid columns="grid gap-3 md:grid-cols-2">
            <ListFilterField label="Proposta">
              <TableFilterInput
                value={filters.proposta}
                onChange={(value) => setFilters((current) => ({ ...current, proposta: value }))}
                placeholder="Filtrar proposta"
              />
            </ListFilterField>

            <ListFilterField label="Cliente">
              <TableFilterInput
                value={filters.cliente}
                onChange={(value) => setFilters((current) => ({ ...current, cliente: value }))}
                placeholder="Filtrar cliente"
              />
            </ListFilterField>
          </ListFilterGrid>
        </ListFilterPanel>
        {filteredPropostas.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            Nenhuma proposta pendente para o filtro atual.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortableTableHead
                      label="Proposta"
                      isActive={sort.column === "proposta"}
                      direction={sort.direction}
                      onClick={() => toggleSort("proposta")}
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
                  <TableHead>Situacao</TableHead>
                  <TableHead>
                    <SortableTableHead
                      label="Criacao"
                      isActive={sort.column === "criacao"}
                      direction={sort.direction}
                      onClick={() => toggleSort("criacao")}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableTableHead
                      label="Atualizacao"
                      isActive={sort.column === "atualizacao"}
                      direction={sort.direction}
                      onClick={() => toggleSort("atualizacao")}
                    />
                  </TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPropostas.map((proposta) => (
                  <TableRow key={proposta.id}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        <span>{proposta.nome}</span>
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                          Pendente
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{proposta.cliente_nome}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        Aguardando lancamento do previsto
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(proposta.created_at)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(proposta.updated_at)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/orcamentos/${proposta.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="mr-2 h-4 w-4" />
                          Abrir
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function isOrcamentoPendente(proposta: Proposta) {
  if (proposta.arquivado) {
    return false
  }

  const totalPrevisto =
    Number(proposta.valor_previsto_perfis || 0) +
    Number(proposta.valor_previsto_vidros || 0) +
    Number(proposta.valor_previsto_acessorios || 0) +
    Number(proposta.valor_previsto_outros || 0)

  return totalPrevisto <= 0
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}

function sortPropostas(
  left: Proposta,
  right: Proposta,
  sort: { column: SortColumn; direction: SortDirection },
) {
  const modifier = sort.direction === "asc" ? 1 : -1

  switch (sort.column) {
    case "proposta":
      return left.nome.localeCompare(right.nome, "pt-BR") * modifier
    case "cliente":
      return ((left.cliente_nome ?? "").localeCompare(right.cliente_nome ?? "", "pt-BR")) * modifier
    case "atualizacao":
      return (new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime()) * modifier
    case "criacao":
    default:
      return (new Date(left.created_at).getTime() - new Date(right.created_at).getTime()) * modifier
  }
}
