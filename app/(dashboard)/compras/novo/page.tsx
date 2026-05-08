"use client"

import { Suspense, useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Paperclip, Save } from "lucide-react"
import { CompraRateioFields, type CompraRateioFormState } from "@/components/compras/compra-rateio-fields"
import { FormSectionCard, PageHeader } from "@/components/shared/page-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Cliente, Proposta } from "@/lib/types"

export default function NovaCompraPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando formulario...</div>}>
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

  const [formData, setFormData] = useState<{
    cliente_id: string
    proposta_id: string
    fornecedor: string
    descricao: string
    data_envio_fornecedor: string
    valor_categoria_perfis: string
    valor_categoria_vidros: string
    valor_categoria_acessorios: string
    valor_categoria_perdas: string
    valor_categoria_outros: string
  }>({
    cliente_id: searchParams.get("cliente_id") ?? "",
    proposta_id: searchParams.get("proposta_id") ?? "",
    fornecedor: "",
    descricao: "",
    data_envio_fornecedor: "",
    valor_categoria_perfis: "",
    valor_categoria_vidros: "",
    valor_categoria_acessorios: "",
    valor_categoria_perdas: "",
    valor_categoria_outros: "",
  })

  useEffect(() => {
    async function fetchClientes() {
      const response = await fetch("/api/clientes")
      if (response.ok) {
        setClientes(await response.json())
      }
    }

    void fetchClientes()
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

    void fetchPropostas()
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

  function handleChange(field: keyof typeof formData, value: string) {
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
      nextErrors.descricao = "Informe a descricao da compra."
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
          fornecedor: formData.fornecedor.trim(),
          descricao: formData.descricao.trim(),
          data_envio_fornecedor: formData.data_envio_fornecedor || null,
          valor_categoria_perfis: toNumber(formData.valor_categoria_perfis),
          valor_categoria_vidros: toNumber(formData.valor_categoria_vidros),
          valor_categoria_acessorios: toNumber(formData.valor_categoria_acessorios),
          valor_categoria_perdas: toNumber(formData.valor_categoria_perdas),
          valor_categoria_outros: toNumber(formData.valor_categoria_outros),
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
            throw new Error(uploadPayload?.error || "Compra criada, mas os anexos nao puderam ser enviados.")
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
      <PageHeader
        title="Nova compra"
        description="Cadastre o pedido inicial com cliente, proposta, fornecedor e material a ser cotado."
        actions={
          <Link href="/compras">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <FormSectionCard
          title="Dados do pedido"
          description="O pedido sera criado automaticamente com status Cotacao."
        >
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
            <Label htmlFor="descricao">Descricao da compra *</Label>
            <Textarea
              id="descricao"
              rows={5}
              value={formData.descricao}
              onChange={(event) => handleChange("descricao", event.target.value)}
              placeholder="Descreva os itens, quantidades, referencias e contexto da compra."
              className={errors.descricao ? "border-destructive" : ""}
            />
            {errors.descricao && <p className="text-sm text-destructive">{errors.descricao}</p>}
          </div>

          <CompraRateioFields
            values={formData}
            onChange={(field, value) => setFormData((current) => ({ ...current, [field]: value }))}
            description="Se o comprador ja souber como esta compra sera distribuida, pode informar agora. Se preferir, esse rateio ainda pode ser ajustado depois na fase de cotacao."
          />
        </FormSectionCard>

        <FormSectionCard
          title="Anexos da cotacao"
          description="Envie aqui o material de apoio que precisa acompanhar o pedido inicial."
          className="border-dashed border-primary/30 bg-primary/5"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-primary" />
              <Label htmlFor="cotacao_files" className="text-sm font-medium">
                Arquivos da cotacao
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
        </FormSectionCard>

        <div className="flex justify-end gap-3">
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
      </form>
    </div>
  )
}

function toNumber(value: string) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}
