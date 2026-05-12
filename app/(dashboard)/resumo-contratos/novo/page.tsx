"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, FileStack, Loader2, Plus, ReceiptText, Target, Trash2 } from "lucide-react"
import { ContractSummaryItems } from "@/components/resumo-contratos/contract-summary-items"
import { SearchableSelect } from "@/components/shared/searchable-select"
import { FormSectionCard, PageHeader, SectionCard, SummaryMetricCard } from "@/components/shared/page-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ResumoContratoFormData, ResumoContratoReferencia } from "@/lib/types"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

type SelectedItem = ResumoContratoReferencia & {
  valor_contrato: string
}

export default function NovoResumoContratoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [references, setReferences] = useState<ResumoContratoReferencia[]>([])
  const [selectedPropostaId, setSelectedPropostaId] = useState("")
  const [formData, setFormData] = useState({
    titulo: "",
    periodo_referencia: "",
  })
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])

  async function fetchReferences() {
    try {
      setLoading(true)
      const response = await fetch("/api/resumo-contratos/referencias", { cache: "no-store" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao carregar obras disponíveis.")
      }

      setReferences(Array.isArray(payload) ? payload : [])
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao carregar obras disponíveis.")
      setReferences([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchReferences()
  }, [])

  const availableOptions = useMemo(() => {
    const selectedIds = new Set(selectedItems.map((item) => item.proposta_id))
    return references
      .filter((item) => !selectedIds.has(item.proposta_id))
      .map((item) => ({
        value: String(item.proposta_id),
        label: `${item.cliente_nome} - ${item.proposta_nome}`,
        description: `Gasto real atual: ${formatCurrency(item.valor_real_gasto)}`,
      }))
  }, [references, selectedItems])

  const overview = useMemo(() => {
    return selectedItems.reduce(
      (accumulator, item) => {
        const valorContrato = Number(item.valor_contrato || 0)
        accumulator.valor_total_contrato += valorContrato
        accumulator.valor_total_real_gasto += item.valor_real_gasto
        accumulator.lucro_bruto_total += valorContrato - item.valor_real_gasto
        return accumulator
      },
      {
        valor_total_contrato: 0,
        valor_total_real_gasto: 0,
        lucro_bruto_total: 0,
      },
    )
  }, [selectedItems])

  const averageGrossPerWork = useMemo(() => {
    if (selectedItems.length === 0) {
      return 0
    }

    return overview.lucro_bruto_total / selectedItems.length
  }, [overview.lucro_bruto_total, selectedItems.length])

  function handleAddSelectedProposal() {
    const propostaId = Number(selectedPropostaId)
    if (!Number.isFinite(propostaId) || propostaId <= 0) {
      return
    }

    const reference = references.find((item) => item.proposta_id === propostaId)
    if (!reference) {
      return
    }

    setSelectedItems((current) => [...current, { ...reference, valor_contrato: "" }])
    setSelectedPropostaId("")
  }

  function handleRemoveSelectedProposal(propostaId: number) {
    setSelectedItems((current) => current.filter((item) => item.proposta_id !== propostaId))
  }

  function handleContractValueChange(propostaId: number, value: string) {
    setSelectedItems((current) =>
      current.map((item) => (item.proposta_id === propostaId ? { ...item, valor_contrato: value } : item)),
    )
  }

  async function handleSave() {
    const payload: ResumoContratoFormData = {
      titulo: formData.titulo.trim(),
      periodo_referencia: formData.periodo_referencia,
      itens: selectedItems.map((item) => ({
        proposta_id: item.proposta_id,
        valor_contrato: Number(item.valor_contrato || 0),
      })),
    }

    setSaving(true)
    try {
      const response = await fetch("/api/resumo-contratos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(result?.error || "Erro ao salvar resumo de contratos.")
      }

      router.push(`/resumo-contratos/${result.id}`)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar resumo de contratos.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Nova seleção de contratos"
        description="Monte um agrupamento administrativo de obras, informe os contratos fechados e acompanhe o lucro bruto consolidado sem misturar com a lista de seleções já salvas."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/resumo-contratos">Cancelar</Link>
            </Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar seleção
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <SummaryMetricCard title="Obras selecionadas" value={selectedItems.length} description="Quantidade de obras já incluídas nesta montagem." />
        <SummaryMetricCard title="Contrato total" value={formatCurrency(overview.valor_total_contrato)} description="Soma dos contratos informados na seleção atual." />
        <SummaryMetricCard title="Gasto real total" value={formatCurrency(overview.valor_total_real_gasto)} description="Compras já registradas nas obras selecionadas." />
        <SummaryMetricCard
          title="Lucro bruto total"
          value={formatCurrency(overview.lucro_bruto_total)}
          description="Diferença entre contrato fechado e gasto real acumulado."
          tone={overview.lucro_bruto_total < 0 ? "danger" : "default"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.9fr)]">
        <FormSectionCard
          title="Workspace da seleção"
          description="Pesquise a proposta, adicione à lista e defina o valor do contrato fechado de cada obra."
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <SearchableSelect
              value={selectedPropostaId}
              onValueChange={setSelectedPropostaId}
              options={availableOptions}
              placeholder={loading ? "Carregando obras..." : "Pesquisar cliente ou proposta"}
              searchPlaceholder="Buscar por cliente ou proposta"
              emptyLabel="Nenhuma obra disponível"
              disabled={loading}
            />
            <Button type="button" variant="outline" onClick={handleAddSelectedProposal} disabled={!selectedPropostaId}>
              <Plus className="mr-2 h-4 w-4" />
              Inserir na lista
            </Button>
          </div>

          <ContractSummaryItems
            items={selectedItems}
            editable
            onContractValueChange={handleContractValueChange}
            onRemove={handleRemoveSelectedProposal}
            emptyLabel="Nenhuma obra adicionada ainda."
          />
        </FormSectionCard>

        <div className="space-y-4">
          <FormSectionCard title="Identificação" description="Dê um nome e um período de referência para o agrupamento que será salvo.">
            <div className="space-y-4">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Título</span>
                <Input
                  value={formData.titulo}
                  onChange={(event) => setFormData((current) => ({ ...current, titulo: event.target.value }))}
                  placeholder="Ex.: Contratos fechados de maio"
                />
              </label>
              <label className="space-y-1.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <CalendarDays className="h-4 w-4" />
                  Mês/ano de referência
                </span>
                <Input
                  type="month"
                  value={formData.periodo_referencia}
                  onChange={(event) => setFormData((current) => ({ ...current, periodo_referencia: event.target.value }))}
                />
              </label>
            </div>
          </FormSectionCard>

          <SectionCard title="Resumo da montagem" description="Leitura rápida da seleção que será salva pelo administrador.">
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <FileStack className="h-4 w-4 text-primary" />
                  Obras selecionadas
                </span>
                <strong>{selectedItems.length}</strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <ReceiptText className="h-4 w-4 text-primary" />
                  Lucro médio por obra
                </span>
                <strong>{formatCurrency(averageGrossPerWork)}</strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Target className="h-4 w-4 text-primary" />
                  Lucro bruto total
                </span>
                <strong className={overview.lucro_bruto_total < 0 ? "text-red-500 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"}>
                  {formatCurrency(overview.lucro_bruto_total)}
                </strong>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-muted-foreground">
                Esta área é exclusiva para montar uma nova seleção. Os resumos já salvos continuam separados na listagem principal para não confundir o fluxo do administrador.
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
