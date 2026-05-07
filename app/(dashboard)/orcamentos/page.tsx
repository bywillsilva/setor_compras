"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, Eye, Search } from "lucide-react"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

const SORT_OPTIONS = {
  cadastro_desc: "Cadastro mais recente",
  cadastro_asc: "Cadastro mais antigo",
  proposta_az: "Proposta A-Z",
  cliente_az: "Cliente A-Z",
} as const

type SortOption = keyof typeof SORT_OPTIONS

export default function OrcamentosPage() {
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("cadastro_desc")

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

    fetchOrcamentos()
  }, [])

  const pendingPropostas = useMemo(
    () => propostas.filter((proposta) => isOrcamentoPendente(proposta)),
    [propostas],
  )

  const filteredPropostas = useMemo(() => {
    const term = search.toLowerCase()

    return pendingPropostas
        .filter((proposta) => {
          const matchSearch =
            proposta.nome.toLowerCase().includes(term) ||
            proposta.cliente_nome?.toLowerCase().includes(term)
          return matchSearch
        })
        .filter((proposta) => matchesDateRange(proposta.created_at, dateFrom, dateTo))
        .sort((left, right) => sortPropostas(left, right, sortBy))
  }, [dateFrom, dateTo, pendingPropostas, search, sortBy])

  const resumo = useMemo(
    () => ({
      pendentes: pendingPropostas.length,
      filtradas: filteredPropostas.length,
    }),
    [filteredPropostas.length, pendingPropostas.length],
  )

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
        <p className="text-muted-foreground">A fila mostra apenas propostas que ainda aguardam o lancamento do previsto de materiais.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard title="Pendentes" value={resumo.pendentes} description="Propostas aguardando orcamento inicial" />
        <SummaryCard title="Na visao atual" value={resumo.filtradas} description="Pendencias depois da busca e do filtro de data" />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por proposta ou cliente..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="w-full md:w-[220px]">
                <SelectValue placeholder="Ordenacao" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
          <CardTitle>Fila pendente de orcamentos</CardTitle>
          <CardDescription>{filteredPropostas.length} proposta(s) aguardando o preenchimento do previsto</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPropostas.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              Nenhuma proposta pendente para o filtro atual.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proposta</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Situacao</TableHead>
                    <TableHead>Criacao</TableHead>
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
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string
  value: number | string
  description: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
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

function sortPropostas(left: Proposta, right: Proposta, sortBy: SortOption) {
  switch (sortBy) {
    case "cadastro_asc":
      return new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    case "proposta_az":
      return left.nome.localeCompare(right.nome, "pt-BR")
    case "cliente_az":
      return (left.cliente_nome ?? "").localeCompare(right.cliente_nome ?? "", "pt-BR")
    case "cadastro_desc":
    default:
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  }
}
