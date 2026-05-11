"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Eye, FileText, Loader2, Plus } from "lucide-react"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { ListFilterField, ListFilterGrid, ListFilterPanel } from "@/components/shared/list-filter-panel"
import { PageHeader, SectionCard } from "@/components/shared/page-layout"
import { SearchableSelect } from "@/components/shared/searchable-select"
import { SortableTableHead, TableFilterInput, type SortDirection } from "@/components/shared/table-tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Cliente, Proposta } from "@/lib/types"

const ARCHIVE_FILTER_LABELS = {
  ativos: "Ativos",
  arquivados: "Arquivados",
  todos: "Todos",
} as const

const EMPTY_FORM = {
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

type SortColumn = "proposta" | "cliente" | "cadastro" | "previsto"

export default function PropostasPage() {
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [filters, setFilters] = useState({
    proposta: "",
    cliente: "",
    archive: "ativos" as keyof typeof ARCHIVE_FILTER_LABELS,
    createdFrom: "",
    createdTo: "",
  })
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: "proposta",
    direction: "asc",
  })
  const [formData, setFormData] = useState(EMPTY_FORM)

  useEffect(() => {
    void fetchData(filters.archive)
  }, [filters.archive])

  async function fetchData(archiveFilter = filters.archive) {
    try {
      setLoading(true)
      const propostasQuery = archiveFilter === "ativos" ? "" : `?arquivados=${archiveFilter}`
      const [propostasResponse, clientesResponse] = await Promise.all([
        fetch(`/api/propostas${propostasQuery}`),
        fetch("/api/clientes?arquivados=todos"),
      ])

      if (propostasResponse.ok) {
        setPropostas(await propostasResponse.json())
      }

      if (clientesResponse.ok) {
        setClientes(await clientesResponse.json())
      }
    } finally {
      setLoading(false)
    }
  }

  function openDialog() {
    setFormData(EMPTY_FORM)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.cliente_id || !formData.nome.trim()) {
      alert("Cliente e nome sao obrigatorios.")
      return
    }

    setSaving(true)

    try {
      const response = await fetch("/api/propostas", {
        method: "POST",
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

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Erro ao salvar proposta.")
      }

      setDialogOpen(false)
      setFormData(EMPTY_FORM)
      await fetchData(filters.archive)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar proposta.")
    } finally {
      setSaving(false)
    }
  }

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

  const filteredPropostas = useMemo(() => {
    return [...propostas]
      .filter((proposta) => {
        const matchesProposta = !filters.proposta || proposta.nome.toLowerCase().includes(filters.proposta.toLowerCase())
        const matchesCliente =
          !filters.cliente || (proposta.cliente_nome ?? "").toLowerCase().includes(filters.cliente.toLowerCase())
        const matchesCreatedFrom = !filters.createdFrom || proposta.created_at.slice(0, 10) >= filters.createdFrom
        const matchesCreatedTo = !filters.createdTo || proposta.created_at.slice(0, 10) <= filters.createdTo

        return matchesProposta && matchesCliente && matchesCreatedFrom && matchesCreatedTo
      })
      .sort((left, right) => sortPropostas(left, right, sort))
  }, [filters, propostas, sort])

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
        title="Propostas"
        description="Controle de obras, orcamento por categoria e reserva de perdas/reposicao."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Nova proposta
              </Button>
            </DialogTrigger>

            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nova proposta</DialogTitle>
                <DialogDescription>Configure cliente, periodo e orcamento da obra.</DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <SearchableSelect
                    value={formData.cliente_id}
                    onValueChange={(value) => setFormData((current) => ({ ...current, cliente_id: value }))}
                    options={clientes
                      .filter((cliente) => !cliente.arquivado)
                      .map((cliente) => ({
                        value: cliente.id.toString(),
                        label: cliente.nome,
                        description: cliente.documento,
                      }))}
                    placeholder="Selecione o cliente"
                    searchPlaceholder="Pesquisar cliente..."
                    emptyLabel="Nenhum cliente encontrado."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nome da proposta *</Label>
                  <Input
                    value={formData.nome}
                    onChange={(event) => setFormData((current) => ({ ...current, nome: event.target.value }))}
                    placeholder="Ex: PP-2026-014 - Torre Norte"
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
                    <p className="text-sm text-muted-foreground">
                      Preencha as categorias principais da obra e mantenha perdas/reposicao como reserva separada.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Perfis">
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.valor_previsto_perfis}
                        onChange={(event) => setFormData((current) => ({ ...current, valor_previsto_perfis: event.target.value }))}
                      />
                    </Field>

                    <Field label="Vidros">
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.valor_previsto_vidros}
                        onChange={(event) => setFormData((current) => ({ ...current, valor_previsto_vidros: event.target.value }))}
                      />
                    </Field>

                    <Field label="Acessorios">
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.valor_previsto_acessorios}
                        onChange={(event) => setFormData((current) => ({ ...current, valor_previsto_acessorios: event.target.value }))}
                      />
                    </Field>

                    <Field label="Outros">
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.valor_previsto_outros}
                        onChange={(event) => setFormData((current) => ({ ...current, valor_previsto_outros: event.target.value }))}
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
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <SectionCard
        title="Lista de propostas"
        description={`${filteredPropostas.length} proposta(s) mostrando ${ARCHIVE_FILTER_LABELS[filters.archive].toLowerCase()}`}
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
          <ListFilterGrid columns="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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

            <ListFilterField label="Visualizacao">
              <Select
                value={filters.archive}
                onValueChange={(value) =>
                  setFilters((current) => ({ ...current, archive: value as keyof typeof ARCHIVE_FILTER_LABELS }))
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Ativos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativos">Ativos</SelectItem>
                  <SelectItem value="arquivados">Arquivados</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
            </ListFilterField>
          </ListFilterGrid>
        </ListFilterPanel>
        {filteredPropostas.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <FileText className="mx-auto mb-2 h-12 w-12 opacity-50" />
            <p>{filters.archive === "arquivados" ? "Nenhuma proposta arquivada." : "Nenhuma proposta cadastrada."}</p>
            {filters.archive !== "arquivados" ? (
              <Button variant="link" onClick={openDialog}>
                Cadastrar primeira proposta
              </Button>
            ) : null}
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
                  <TableHead>Periodo</TableHead>
                  <TableHead>
                    <SortableTableHead
                      label="Previsto"
                      isActive={sort.column === "previsto"}
                      direction={sort.direction}
                      onClick={() => toggleSort("previsto")}
                    />
                  </TableHead>
                  <TableHead>Perdas/reposicao</TableHead>
                  <TableHead>
                    <SortableTableHead
                      label="Cadastro"
                      isActive={sort.column === "cadastro"}
                      direction={sort.direction}
                      onClick={() => toggleSort("cadastro")}
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
                        {proposta.arquivado ? <Badge variant="outline">Arquivada</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>{proposta.cliente_nome}</TableCell>
                    <TableCell>
                      {proposta.data_inicio && proposta.data_fim ? (
                        <>
                          {format(parseISO(proposta.data_inicio), "dd/MM/yy", { locale: ptBR })} -{" "}
                          {format(parseISO(proposta.data_fim), "dd/MM/yy", { locale: ptBR })}
                        </>
                      ) : proposta.data_inicio ? (
                        <>Inicio: {format(parseISO(proposta.data_inicio), "dd/MM/yy", { locale: ptBR })}</>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(proposta.valor_previsto)}</TableCell>
                    <TableCell>{formatCurrency(proposta.custo_perdas)}</TableCell>
                    <TableCell>{formatCadastro(proposta.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/propostas/${proposta.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="mr-2 h-4 w-4" />
                          Ver detalhes
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function StaticValue({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="rounded-md border bg-muted/30 px-3 py-2.5">
        <div className="font-medium text-foreground">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
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

function formatCadastro(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}

function sortPropostas(left: Proposta, right: Proposta, sort: { column: SortColumn; direction: SortDirection }) {
  const modifier = sort.direction === "asc" ? 1 : -1

  switch (sort.column) {
    case "cliente":
      return ((left.cliente_nome ?? "").localeCompare(right.cliente_nome ?? "", "pt-BR")) * modifier
    case "cadastro":
      return (new Date(left.created_at).getTime() - new Date(right.created_at).getTime()) * modifier
    case "previsto":
      return (Number(left.valor_previsto) - Number(right.valor_previsto)) * modifier
    case "proposta":
    default:
      return left.nome.localeCompare(right.nome, "pt-BR") * modifier
  }
}
