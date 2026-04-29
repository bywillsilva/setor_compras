"use client"

import { Suspense, useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Paperclip, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CATEGORIA_LABELS, CATEGORIA_OPTIONS } from "@/lib/domain"
import type { Cliente, Proposta } from "@/lib/types"

export default function NovaCompraPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando formulário...</div>}>
      <NovaCompraContent />
    </Suspense>
  )
}

function NovaCompraContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [quoteFiles, setQuoteFiles] = useState<File[]>([])
  const [selectedCliente, setSelectedCliente] = useState(searchParams.get("cliente_id") ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    cliente_id: searchParams.get("cliente_id") ?? "",
    proposta_id: searchParams.get("proposta_id") ?? "",
    categoria: "perdas",
    fornecedor: "",
    descricao: "",
    data_envio_fornecedor: "",
  })

  useEffect(() => {
    async function fetchClientes() {
      const response = await fetch("/api/clientes")
      if (response.ok) {
        setClientes(await response.json())
      }
    }

    fetchClientes()
  }, [])

  useEffect(() => {
    async function fetchPropostas() {
      if (!selectedCliente) {
        setPropostas([])
        return
      }

      const response = await fetch(`/api/propostas?cliente_id=${selectedCliente}`)
      if (response.ok) {
        setPropostas(await response.json())
      }
    }

    fetchPropostas()
  }, [selectedCliente])

  function handleClienteChange(value: string) {
    setSelectedCliente(value)
    setFormData((current) => ({
      ...current,
      cliente_id: value,
      proposta_id: value === current.cliente_id ? current.proposta_id : "",
    }))
    clearError("cliente_id")
  }

  function handleChange(field: string, value: string) {
    setFormData((current) => ({ ...current, [field]: value }))
    clearError(field)
  }

  function clearError(field: string) {
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: "" }))
    }
  }

  function validate() {
    const nextErrors: Record<string, string> = {}

    if (!formData.cliente_id) {
      nextErrors.cliente_id = "Selecione um cliente."
    }

    if (!formData.proposta_id) {
      nextErrors.proposta_id = "Selecione uma proposta."
    }

    if (!formData.fornecedor.trim()) {
      nextErrors.fornecedor = "Informe o fornecedor."
    }

    if (!formData.descricao.trim()) {
      nextErrors.descricao = "Informe a descrição da compra."
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    if (!validate()) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: Number(formData.cliente_id),
          proposta_id: Number(formData.proposta_id),
          categoria: formData.categoria,
          fornecedor: formData.fornecedor.trim(),
          descricao: formData.descricao.trim(),
          data_envio_fornecedor: formData.data_envio_fornecedor || null,
        }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || "Erro ao criar compra.")
      }

      const payload = await response.json()

      if (quoteFiles.length > 0) {
        try {
          const uploadData = new FormData()
          uploadData.append("tipo", "cotacao")
          quoteFiles.forEach((file) => uploadData.append("files", file))

          const uploadResponse = await fetch(`/api/compras/${payload.id}/anexos`, {
            method: "POST",
            body: uploadData,
          })

          if (!uploadResponse.ok) {
            const uploadPayload = await uploadResponse.json().catch(() => null)
            throw new Error(uploadPayload?.error || "Compra criada, mas os anexos não puderam ser enviados.")
          }
        } catch (uploadError) {
          alert(uploadError instanceof Error ? uploadError.message : "Compra criada, mas houve erro ao enviar anexos.")
          router.push(`/compras/${payload.id}`)
          return
        }
      }

      router.push(`/compras/${payload.id}`)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao criar compra.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/compras">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nova Compra</h1>
          <p className="text-muted-foreground">Cadastre um novo pedido com vínculo de cliente, proposta e categoria</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Informações do pedido</CardTitle>
            <CardDescription>
              O pedido será criado automaticamente com status <strong>Cotação</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select value={formData.cliente_id} onValueChange={handleClienteChange}>
                  <SelectTrigger className={errors.cliente_id ? "border-destructive" : ""}>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id.toString()}>
                        {cliente.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.cliente_id && <p className="text-sm text-destructive">{errors.cliente_id}</p>}
              </div>

              <div className="space-y-2">
                <Label>Proposta (obra) *</Label>
                <Select
                  value={formData.proposta_id}
                  onValueChange={(value) => handleChange("proposta_id", value)}
                  disabled={!selectedCliente}
                >
                  <SelectTrigger className={errors.proposta_id ? "border-destructive" : ""}>
                    <SelectValue placeholder={selectedCliente ? "Selecione a proposta" : "Selecione o cliente primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {propostas.map((proposta) => (
                      <SelectItem key={proposta.id} value={proposta.id.toString()}>
                        {proposta.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.proposta_id && <p className="text-sm text-destructive">{errors.proposta_id}</p>}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria do material *</Label>
                <Select value={formData.categoria} onValueChange={(value) => handleChange("categoria", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIA_OPTIONS.map((categoria) => (
                      <SelectItem key={categoria} value={categoria}>
                        {CATEGORIA_LABELS[categoria]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_envio">Data de envio ao fornecedor</Label>
                <Input
                  id="data_envio"
                  type="date"
                  value={formData.data_envio_fornecedor}
                  onChange={(event) => handleChange("data_envio_fornecedor", event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fornecedor">Fornecedor *</Label>
              <Input
                id="fornecedor"
                value={formData.fornecedor}
                onChange={(event) => handleChange("fornecedor", event.target.value)}
                placeholder="Nome do fornecedor"
                className={errors.fornecedor ? "border-destructive" : ""}
              />
              {errors.fornecedor && <p className="text-sm text-destructive">{errors.fornecedor}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição da compra *</Label>
              <Textarea
                id="descricao"
                rows={5}
                value={formData.descricao}
                onChange={(event) => handleChange("descricao", event.target.value)}
                placeholder="Descreva os itens, quantidades, referências e contexto da compra"
                className={errors.descricao ? "border-destructive" : ""}
              />
              {errors.descricao && <p className="text-sm text-destructive">{errors.descricao}</p>}
            </div>

            <div className="space-y-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-primary" />
                <Label htmlFor="cotacao_files" className="text-sm font-medium">
                  Anexos da cotação
                </Label>
              </div>
              <Input
                id="cotacao_files"
                type="file"
                multiple
                onChange={(event) => setQuoteFiles(Array.from(event.target.files ?? []))}
              />
              <p className="text-xs text-muted-foreground">
                Envie aqui o material cotado, planilhas, PDFs ou imagens que devem acompanhar o pedido inicial.
              </p>
              {quoteFiles.length > 0 && (
                <p className="text-xs font-medium text-foreground">{quoteFiles.length} arquivo(s) selecionado(s).</p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t pt-4">
              <Link href="/compras">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Criar pedido
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
