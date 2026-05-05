"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Eye, FileText, Loader2, Plus, Search } from "lucide-react"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { matchesDateRange } from "@/lib/date-range"
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

export default function PropostasPage() {
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [clienteFilter, setClienteFilter] = useState<string>("todos")
  const [archiveFilter, setArchiveFilter] = useState<keyof typeof ARCHIVE_FILTER_LABELS>("ativos")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState(EMPTY_FORM)

  useEffect(() => {
    fetchData()
  }, [archiveFilter])

  async function fetchData() {
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
      await fetchData()
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

  const filteredPropostas = propostas.filter((proposta) => {
    const matchSearch =
      proposta.nome.toLowerCase().includes(search.toLowerCase()) ||
      proposta.cliente_nome?.toLowerCase().includes(search.toLowerCase())

    const matchCliente = clienteFilter === "todos" || proposta.cliente_id.toString() === clienteFilter
    return matchSearch && matchCliente
  }).filter((proposta) => matchesDateRange(proposta.created_at, dateFrom, dateTo))

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Propostas</h1>
          <p className="text-muted-foreground">Controle de obras, orcamento por categoria e reserva de perdas/reposicao.</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Proposta
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
                <Select
                  value={formData.cliente_id}
                  onValueChange={(value) => setFormData((current) => ({ ...current, cliente_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.filter((cliente) => !cliente.arquivado).map((cliente) => (
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
                  <p className="text-sm text-muted-foreground">Preencha as categorias principais da obra e mantenha perdas/reposicao como reserva separada.</p>
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
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou cliente..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={clienteFilter} onValueChange={setClienteFilter}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os clientes</SelectItem>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id.toString()}>
                      {cliente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={archiveFilter} onValueChange={(value) => setArchiveFilter(value as keyof typeof ARCHIVE_FILTER_LABELS)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Arquivamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativos">Ativos</SelectItem>
                  <SelectItem value="arquivados">Arquivados</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
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
          <CardTitle>Lista de propostas</CardTitle>
          <CardDescription>
            {filteredPropostas.length} proposta(s) cadastrada(s) • mostrando {ARCHIVE_FILTER_LABELS[archiveFilter].toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPropostas.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileText className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>{archiveFilter === "arquivados" ? "Nenhuma proposta arquivada." : "Nenhuma proposta cadastrada."}</p>
              {archiveFilter !== "arquivados" && (
                <Button variant="link" onClick={openDialog}>
                  Cadastrar primeira proposta
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposta</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Previsto</TableHead>
                  <TableHead>Perdas/reposicao</TableHead>
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
          )}
        </CardContent>
      </Card>
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
