"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Eye, Search } from "lucide-react"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { matchesDateRange } from "@/lib/date-range"
import type { Proposta } from "@/lib/types"

const ARCHIVE_FILTER_LABELS = {
  ativos: "Ativas",
  arquivados: "Arquivadas",
  todos: "Todas",
} as const

export default function OrcamentosPage() {
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [archiveFilter, setArchiveFilter] = useState<keyof typeof ARCHIVE_FILTER_LABELS>("ativos")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  useEffect(() => {
    async function fetchOrcamentos() {
      try {
        setLoading(true)
        const response = await fetch("/api/orcamentos?arquivados=todos")

        if (response.ok) {
          setPropostas(await response.json())
        }
      } finally {
        setLoading(false)
      }
    }

    fetchOrcamentos()
  }, [])

  const filteredPropostas = useMemo(() => {
    const term = search.toLowerCase()

    return propostas
      .filter((proposta) => {
        const matchSearch =
          proposta.nome.toLowerCase().includes(term) ||
          proposta.cliente_nome?.toLowerCase().includes(term)

        const matchArchive =
          archiveFilter === "todos" ||
          (archiveFilter === "arquivados" ? proposta.arquivado : !proposta.arquivado)

        return matchSearch && matchArchive
      })
      .filter((proposta) => matchesDateRange(proposta.created_at, dateFrom, dateTo))
  }, [archiveFilter, dateFrom, dateTo, propostas, search])

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orcamentos</h1>
        <p className="text-muted-foreground">Lance e revise os valores previstos das obras sem entrar no fluxo operacional.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por proposta ou cliente..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={archiveFilter} onValueChange={(value) => setArchiveFilter(value as keyof typeof ARCHIVE_FILTER_LABELS)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Arquivamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativos">Ativas</SelectItem>
                  <SelectItem value="arquivados">Arquivadas</SelectItem>
                  <SelectItem value="todos">Todas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DateRangeFilter
              startDate={dateFrom}
              endDate={dateTo}
              onStartDateChange={setDateFrom}
              onEndDateChange={setDateTo}
              onClear={() => {
                setDateFrom("")
                setDateTo("")
              }}
              startLabel="Cadastro de"
              endLabel="Cadastro ate"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Obras com orcamento</CardTitle>
          <CardDescription>
            {filteredPropostas.length} proposta(s) exibida(s) • mostrando {ARCHIVE_FILTER_LABELS[archiveFilter].toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPropostas.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              Nenhum orcamento encontrado para o filtro atual.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proposta</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Previsto</TableHead>
                    <TableHead>Perdas/reposicao</TableHead>
                    <TableHead>Atualizacao</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPropostas.map((proposta) => (
                    <TableRow key={proposta.id}>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2 font-medium">
                          <span>{proposta.nome}</span>
                          {proposta.arquivado && <Badge variant="outline">Arquivada</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>{proposta.cliente_nome}</TableCell>
                      <TableCell>{formatCurrency(proposta.valor_previsto)}</TableCell>
                      <TableCell>{formatCurrency(proposta.custo_perdas)}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}
