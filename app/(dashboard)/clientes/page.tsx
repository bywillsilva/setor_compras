"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Eye, Loader2, Plus, Users } from "lucide-react"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { ListFilterField, ListFilterGrid, ListFilterPanel } from "@/components/shared/list-filter-panel"
import { PageHeader, SectionCard } from "@/components/shared/page-layout"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Cliente } from "@/lib/types"

const ARCHIVE_FILTER_LABELS = {
  ativos: "Ativos",
  arquivados: "Arquivados",
  todos: "Todos",
} as const

type SortColumn = "nome" | "documento" | "cadastro"

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filters, setFilters] = useState({
    nome: "",
    documento: "",
    contato: "",
    email: "",
    archive: "ativos" as keyof typeof ARCHIVE_FILTER_LABELS,
    createdFrom: "",
    createdTo: "",
  })
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: "nome",
    direction: "asc",
  })
  const [formData, setFormData] = useState({
    nome: "",
    documento: "",
    contato: "",
    email: "",
  })

  useEffect(() => {
    void fetchClientes(filters.archive)
  }, [filters.archive])

  async function fetchClientes(archiveFilter = filters.archive) {
    try {
      setLoading(true)
      const query = archiveFilter === "ativos" ? "" : `?arquivados=${archiveFilter}`
      const response = await fetch(`/api/clientes${query}`)
      if (response.ok) {
        setClientes(await response.json())
      }
    } catch (error) {
      console.error("Erro ao carregar clientes:", error)
    } finally {
      setLoading(false)
    }
  }

  function openDialog() {
    setFormData({ nome: "", documento: "", contato: "", email: "" })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.nome.trim()) {
      alert("Nome e obrigatorio")
      return
    }

    setSaving(true)

    try {
      const response = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Erro ao salvar cliente")
      }

      setDialogOpen(false)
      await fetchClientes(filters.archive)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar cliente")
    } finally {
      setSaving(false)
    }
  }

  const filteredClientes = useMemo(() => {
    return [...clientes]
      .filter((cliente) => {
        const matchesNome = !filters.nome || cliente.nome.toLowerCase().includes(filters.nome.toLowerCase())
        const matchesDocumento =
          !filters.documento || (cliente.documento ?? "").toLowerCase().includes(filters.documento.toLowerCase())
        const matchesContato =
          !filters.contato || (cliente.contato ?? "").toLowerCase().includes(filters.contato.toLowerCase())
        const matchesEmail = !filters.email || (cliente.email ?? "").toLowerCase().includes(filters.email.toLowerCase())
        const matchesCreatedFrom = !filters.createdFrom || cliente.created_at.slice(0, 10) >= filters.createdFrom
        const matchesCreatedTo = !filters.createdTo || cliente.created_at.slice(0, 10) <= filters.createdTo

        return matchesNome && matchesDocumento && matchesContato && matchesEmail && matchesCreatedFrom && matchesCreatedTo
      })
      .sort((left, right) => sortClientes(left, right, sort))
  }, [clientes, filters, sort])

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
        title="Clientes"
        description="Cadastre clientes e acompanhe o resumo de propostas, compras e gastos."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Novo cliente
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo cliente</DialogTitle>
                <DialogDescription>Preencha os dados para cadastrar um novo cliente.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(event) => setFormData((current) => ({ ...current, nome: event.target.value }))}
                    placeholder="Nome do cliente"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="documento">CNPJ/CPF</Label>
                  <Input
                    id="documento"
                    value={formData.documento}
                    onChange={(event) => setFormData((current) => ({ ...current, documento: event.target.value }))}
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contato">Contato</Label>
                  <Input
                    id="contato"
                    value={formData.contato}
                    onChange={(event) => setFormData((current) => ({ ...current, contato: event.target.value }))}
                    placeholder="Nome do contato ou telefone"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                    placeholder="email@exemplo.com"
                  />
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
        title="Lista de clientes"
        description={`${filteredClientes.length} cliente(s) mostrando ${ARCHIVE_FILTER_LABELS[filters.archive].toLowerCase()}`}
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
          <ListFilterGrid columns="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <ListFilterField label="Nome">
              <TableFilterInput
                value={filters.nome}
                onChange={(value) => setFilters((current) => ({ ...current, nome: value }))}
                placeholder="Filtrar nome"
              />
            </ListFilterField>

            <ListFilterField label="Documento">
              <TableFilterInput
                value={filters.documento}
                onChange={(value) => setFilters((current) => ({ ...current, documento: value }))}
                placeholder="Filtrar documento"
              />
            </ListFilterField>

            <ListFilterField label="Contato">
              <TableFilterInput
                value={filters.contato}
                onChange={(value) => setFilters((current) => ({ ...current, contato: value }))}
                placeholder="Filtrar contato"
              />
            </ListFilterField>

            <ListFilterField label="E-mail">
              <TableFilterInput
                value={filters.email}
                onChange={(value) => setFilters((current) => ({ ...current, email: value }))}
                placeholder="Filtrar e-mail"
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
        {filteredClientes.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto mb-2 h-12 w-12 opacity-50" />
            <p>{filters.archive === "arquivados" ? "Nenhum cliente arquivado." : "Nenhum cliente cadastrado."}</p>
            {filters.archive !== "arquivados" ? (
              <Button variant="link" onClick={openDialog}>
                Cadastrar primeiro cliente
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
                      label="Nome"
                      isActive={sort.column === "nome"}
                      direction={sort.direction}
                      onClick={() => toggleSort("nome")}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableTableHead
                      label="Documento"
                      isActive={sort.column === "documento"}
                      direction={sort.direction}
                      onClick={() => toggleSort("documento")}
                    />
                  </TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>E-mail</TableHead>
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
                {filteredClientes.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        <span>{cliente.nome}</span>
                        {cliente.arquivado ? <Badge variant="outline">Arquivado</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>{cliente.documento || "-"}</TableCell>
                    <TableCell>{cliente.contato || "-"}</TableCell>
                    <TableCell>{cliente.email || "-"}</TableCell>
                    <TableCell>{formatCadastro(cliente.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/clientes/${cliente.id}`}>
                        <Button variant="ghost" size="icon" aria-label={`Abrir resumo do cliente ${cliente.nome}`} title="Abrir resumo">
                          <Eye className="h-4 w-4" />
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

function sortClientes(left: Cliente, right: Cliente, sort: { column: SortColumn; direction: SortDirection }) {
  const modifier = sort.direction === "asc" ? 1 : -1

  switch (sort.column) {
    case "documento":
      return ((left.documento ?? "").localeCompare(right.documento ?? "", "pt-BR")) * modifier
    case "cadastro":
      return (new Date(left.created_at).getTime() - new Date(right.created_at).getTime()) * modifier
    case "nome":
    default:
      return left.nome.localeCompare(right.nome, "pt-BR") * modifier
  }
}

function formatCadastro(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}
