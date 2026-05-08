"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Loader2, Paperclip, Save } from "lucide-react"
import { PageHeader, FormSectionCard } from "@/components/shared/page-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type Cliente = { id: number; nome: string }
type Proposta = { id: number; cliente_id: number; nome: string }

export default function NovaSolicitacaoPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState<{
    cliente_id: string
    proposta_id: string
    fornecedor: string
    descricao: string
  }>({
    cliente_id: "",
    proposta_id: "",
    fornecedor: "",
    descricao: "",
  })

  useEffect(() => {
    async function fetchReferences() {
      try {
        const response = await fetch("/api/solicitacoes/referencias")
        if (!response.ok) {
          throw new Error("Erro ao carregar referencias.")
        }

        const payload = await response.json()
        setClientes(payload.clientes ?? [])
        setPropostas(payload.propostas ?? [])
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    fetchReferences()
  }, [])

  const propostasDisponiveis = useMemo(
    () => propostas.filter((proposta) => proposta.cliente_id.toString() === formData.cliente_id),
    [formData.cliente_id, propostas],
  )

  function handleChange<Field extends keyof typeof formData>(field: Field, value: (typeof formData)[Field]) {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: "" }))
  }

  function validate() {
    const nextErrors: Record<string, string> = {}

    if (!formData.cliente_id) nextErrors.cliente_id = "Selecione o cliente."
    if (!formData.proposta_id) nextErrors.proposta_id = "Selecione a proposta."
    if (!formData.fornecedor.trim()) nextErrors.fornecedor = "Informe o fornecedor sugerido."

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!validate()) {
      return
    }

    setSaving(true)

    try {
      const response = await fetch("/api/solicitacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: Number(formData.cliente_id),
          proposta_id: Number(formData.proposta_id),
          fornecedor: formData.fornecedor.trim(),
          descricao: formData.descricao.trim(),
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao criar solicitacao.")
      }

      if (files.length > 0) {
        const uploadData = new FormData()
        uploadData.append("tipo", "outro")
        files.forEach((file) => uploadData.append("files", file))

        const uploadResponse = await fetch(`/api/compras/${payload.id}/anexos`, {
          method: "POST",
          body: uploadData,
        })

        if (!uploadResponse.ok) {
          const uploadPayload = await uploadResponse.json().catch(() => null)
          throw new Error(uploadPayload?.error || "Solicitacao criada, mas os anexos nao puderam ser enviados.")
        }
      }

      window.location.href = `/solicitacoes/${payload.id}`
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao criar solicitacao.")
    } finally {
      setSaving(false)
    }
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
        title="Nova solicitacao"
        description="Registre a necessidade de compra e anexe o material de referencia para o setor de compras."
        actions={
          <Link href="/solicitacoes">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <FormSectionCard
          title="Dados da solicitacao"
          description="O pedido sera criado como solicitacao registrada e seguira o fluxo normal."
        >
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select
                  value={formData.cliente_id}
                  onValueChange={(value) => {
                    handleChange("cliente_id", value)
                    handleChange("proposta_id", "")
                  }}
                >
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
                  disabled={!formData.cliente_id}
                >
                  <SelectTrigger className={errors.proposta_id ? "border-destructive" : ""}>
                    <SelectValue placeholder={formData.cliente_id ? "Selecione a proposta" : "Selecione o cliente primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {propostasDisponiveis.map((proposta) => (
                      <SelectItem key={proposta.id} value={proposta.id.toString()}>
                        {proposta.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.proposta_id && <p className="text-sm text-destructive">{errors.proposta_id}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fornecedor">Fornecedor sugerido *</Label>
              <Input
                id="fornecedor"
                value={formData.fornecedor}
                onChange={(event) => handleChange("fornecedor", event.target.value)}
                placeholder="Nome do fornecedor que deve receber a solicitacao"
                className={errors.fornecedor ? "border-destructive" : ""}
              />
              {errors.fornecedor && <p className="text-sm text-destructive">{errors.fornecedor}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Observacoes da solicitacao</Label>
              <Textarea
                id="descricao"
                rows={5}
                value={formData.descricao}
                onChange={(event) => handleChange("descricao", event.target.value)}
                placeholder="Se precisar, descreva observacoes complementares. O material pode ser enviado apenas pelo anexo."
              />
              <p className="text-xs text-muted-foreground">
                Esse campo e opcional. Quando houver desenho, memorial, PDF ou imagem, priorize o anexo da solicitacao.
              </p>
            </div>
        </FormSectionCard>

        <FormSectionCard
          title="Anexos da solicitacao"
          description="Envie aqui o material que o comprador vai usar como base para cotacao."
          className="border-dashed border-primary/30 bg-primary/5"
        >
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-primary" />
                <Label htmlFor="cotacao_files" className="text-sm font-medium">
                  Anexo da solicitacao
                </Label>
              </div>
              <Input
                id="cotacao_files"
                type="file"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              />
              <p className="text-xs text-muted-foreground">
                Envie desenhos, planilhas, PDFs, imagens ou qualquer material que represente o pedido a ser cotado.
              </p>
              {files.length > 0 && (
                <p className="text-xs font-medium text-foreground">{files.length} arquivo(s) selecionado(s).</p>
              )}
            </div>
        </FormSectionCard>

        <div className="flex justify-end gap-3">
          <Link href="/solicitacoes">
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? "Salvando..." : "Salvar solicitacao"}
          </Button>
        </div>
      </form>
    </div>
  )
}
