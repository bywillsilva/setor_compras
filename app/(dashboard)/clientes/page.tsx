"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Edit2, Eye, Loader2, Plus, Search, Trash2, Users } from "lucide-react"
import type { Cliente } from "@/lib/types"

const ARCHIVE_FILTER_LABELS = {
  ativos: "Ativos",
  arquivados: "Arquivados",
  todos: "Todos",
} as const

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [archiveFilter, setArchiveFilter] = useState<keyof typeof ARCHIVE_FILTER_LABELS>("ativos")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    nome: "",
    documento: "",
    contato: "",
    email: "",
  })

  useEffect(() => {
    fetchClientes()
  }, [archiveFilter])

  async function fetchClientes() {
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

  function openDialog(cliente?: Cliente) {
    if (cliente) {
      setEditingCliente(cliente)
      setFormData({
        nome: cliente.nome,
        documento: cliente.documento || "",
        contato: cliente.contato || "",
        email: cliente.email || "",
      })
    } else {
      setEditingCliente(null)
      setFormData({ nome: "", documento: "", contato: "", email: "" })
    }

    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.nome.trim()) {
      alert("Nome e obrigatorio")
      return
    }

    setSaving(true)

    try {
      const url = editingCliente ? `/api/clientes/${editingCliente.id}` : "/api/clientes"

      const response = await fetch(url, {
        method: editingCliente ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Erro ao salvar cliente")
      }

      setDialogOpen(false)
      await fetchClientes()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar cliente")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Deseja realmente excluir este cliente? A exclusao so e permitida quando nao houver propostas ou compras vinculadas.")) {
      return
    }

    try {
      const response = await fetch(`/api/clientes/${id}`, { method: "DELETE" })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Erro ao excluir cliente")
      }

      await fetchClientes()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao excluir cliente")
    }
  }

  const filteredClientes = clientes.filter((cliente) => {
    const normalizedSearch = search.toLowerCase()

    return (
      cliente.nome.toLowerCase().includes(normalizedSearch) ||
      cliente.documento?.toLowerCase().includes(normalizedSearch) ||
      cliente.email?.toLowerCase().includes(normalizedSearch)
    )
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
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">Cadastre clientes e acompanhe o resumo de propostas, compras e gastos</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCliente ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
              <DialogDescription>
                {editingCliente
                  ? "Atualize as informacoes do cliente"
                  : "Preencha os dados para cadastrar um novo cliente"}
              </DialogDescription>
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
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, documento ou e-mail..."
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
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>
            {filteredClientes.length} cliente(s) cadastrado(s) • mostrando {ARCHIVE_FILTER_LABELS[archiveFilter].toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredClientes.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>{archiveFilter === "arquivados" ? "Nenhum cliente arquivado." : "Nenhum cliente cadastrado"}</p>
              {archiveFilter !== "arquivados" && (
                <Button variant="link" onClick={() => openDialog()}>
                  Cadastrar primeiro cliente
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClientes.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        <span>{cliente.nome}</span>
                        {cliente.arquivado && <Badge variant="outline">Arquivado</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{cliente.documento || "-"}</TableCell>
                    <TableCell>{cliente.contato || "-"}</TableCell>
                    <TableCell>{cliente.email || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/clientes/${cliente.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="mr-2 h-4 w-4" />
                            Abrir
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => openDialog(cliente)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(cliente.id)}
                          className="text-destructive hover:text-destructive"
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
