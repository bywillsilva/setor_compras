"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Edit2, Eye, FileText, Loader2, Plus, Search, Trash2 } from "lucide-react"
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
import type { Cliente, Proposta } from "@/lib/types"

const ARCHIVE_FILTER_LABELS = {
  ativos: "Ativos",
  arquivados: "Arquivados",
  todos: "Todos",
} as const

export default function PropostasPage() {
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [clienteFilter, setClienteFilter] = useState<string>("todos")
  const [archiveFilter, setArchiveFilter] = useState<keyof typeof ARCHIVE_FILTER_LABELS>("ativos")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProposta, setEditingProposta] = useState<Proposta | null>(null)

  const [formData, setFormData] = useState({
    cliente_id: "",
    nome: "",
    data_inicio: "",
    data_fim: "",
    valor_previsto: "",
    valor_previsto_perfis: "",
    valor_previsto_vidros: "",
    valor_previsto_acessorios: "",
    valor_previsto_outros: "",
    custo_perdas: "",
  })

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

  function openDialog(proposta?: Proposta) {
    if (proposta) {
      setEditingProposta(proposta)
      setFormData({
        cliente_id: proposta.cliente_id.toString(),
        nome: proposta.nome,
        data_inicio: proposta.data_inicio ?? "",
        data_fim: proposta.data_fim ?? "",
        valor_previsto: proposta.valor_previsto?.toString() ?? "",
        valor_previsto_perfis: proposta.valor_previsto_perfis?.toString() ?? "",
        valor_previsto_vidros: proposta.valor_previsto_vidros?.toString() ?? "",
        valor_previsto_acessorios: proposta.valor_previsto_acessorios?.toString() ?? "",
        valor_previsto_outros: proposta.valor_previsto_outros?.toString() ?? "",
        custo_perdas: proposta.custo_perdas?.toString() ?? "",
      })
    } else {
      setEditingProposta(null)
      setFormData({
        cliente_id: "",
        nome: "",
        data_inicio: "",
        data_fim: "",
        valor_previsto: "",
        valor_previsto_perfis: "",
        valor_previsto_vidros: "",
        valor_previsto_acessorios: "",
        valor_previsto_outros: "",
        custo_perdas: "",
      })
    }

    setDialogOpen(true)
  }

  const clientesDisponiveis =
    editingProposta
      ? clientes.filter((cliente) => !cliente.arquivado || cliente.id === editingProposta.cliente_id)
      : clientes.filter((cliente) => !cliente.arquivado)

  async function handleSave() {
    if (!formData.cliente_id || !formData.nome.trim()) {
      alert("Cliente e nome são obrigatórios.")
      return
    }

    setSaving(true)

    try {
      const response = await fetch(editingProposta ? `/api/propostas/${editingProposta.id}` : "/api/propostas", {
        method: editingProposta ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: Number(formData.cliente_id),
          nome: formData.nome.trim(),
          data_inicio: formData.data_inicio || null,
          data_fim: formData.data_fim || null,
          valor_previsto: toNumber(formData.valor_previsto),
          valor_previsto_perfis: toNumber(formData.valor_previsto_perfis),
          valor_previsto_vidros: toNumber(formData.valor_previsto_vidros),
          valor_previsto_acessorios: toNumber(formData.valor_previsto_acessorios),
          valor_previsto_outros: toNumber(formData.valor_previsto_outros),
          custo_perdas: toNumber(formData.custo_perdas),
        }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || "Erro ao salvar proposta.")
      }

      setDialogOpen(false)
      await fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar proposta.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Deseja realmente excluir esta proposta?")) {
      return
    }

    try {
      const response = await fetch(`/api/propostas/${id}`, { method: "DELETE" })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || "Erro ao excluir proposta.")
      }

      await fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao excluir proposta.")
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
  })

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
          <p className="text-muted-foreground">Controle de obras, orçamento por categoria e perdas</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Proposta
            </Button>
          </DialogTrigger>

          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingProposta ? "Editar proposta" : "Nova proposta"}</DialogTitle>
              <DialogDescription>Configure cliente, período e orçamento da obra.</DialogDescription>
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
                    {clientesDisponiveis.map((cliente) => (
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
                <Field label="Data de início">
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
                  <p className="text-sm text-muted-foreground">Preencha por categoria para acompanhar o orçamento da obra.</p>
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

                  <Field label="Acessórios">
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
                <Field label="Valor previsto total">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor_previsto}
                    onChange={(event) => setFormData((current) => ({ ...current, valor_previsto: event.target.value }))}
                    placeholder={totalCategorias > 0 ? totalCategorias.toFixed(2) : "0,00"}
                  />
                </Field>

                <Field label="Custo de perdas/reposição">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.custo_perdas}
                    onChange={(event) => setFormData((current) => ({ ...current, custo_perdas: event.target.value }))}
                  />
                </Field>
              </div>

              <div className="rounded-lg bg-muted p-3 text-sm">
                <strong>Total por categorias:</strong>{" "}
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(totalCategorias)}
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
                <Button variant="link" onClick={() => openDialog()}>
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
                  <TableHead>Período</TableHead>
                  <TableHead>Previsto</TableHead>
                  <TableHead>Perdas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
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
                        <>Início: {format(parseISO(proposta.data_inicio), "dd/MM/yy", { locale: ptBR })}</>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(proposta.valor_previsto)}
                    </TableCell>
                    <TableCell>{formatCurrency(proposta.custo_perdas)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/propostas/${proposta.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => openDialog(proposta)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(proposta.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

function toNumber(value: string) {
  const current = Number(value)
  return Number.isFinite(current) ? current : 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}
