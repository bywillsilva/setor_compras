"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowLeft, CalendarDays, FileStack, Loader2, PencilLine, Plus, ReceiptText, Save, Target, Trash2, X } from "lucide-react"
import { ContractSummaryItems } from "@/components/resumo-contratos/contract-summary-items"
import { SearchableSelect } from "@/components/shared/searchable-select"
import { ListPaginationBar, useListPagination } from "@/components/shared/list-pagination"
import { FormSectionCard, PageHeader, SectionCard, SummaryMetricCard } from "@/components/shared/page-layout"
import { useLiveRefresh } from "@/components/shared/use-live-refresh"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ResumoContratoDetalhe, ResumoContratoFormData, ResumoContratoReferencia } from "@/lib/types"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatPeriodo(periodo: string) {
  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    return periodo
  }

  const [year, month] = periodo.split("-")
  return format(new Date(Number(year), Number(month) - 1, 1), "MMMM 'de' yyyy", { locale: ptBR })
}

type EditableItem = ResumoContratoReferencia & {
  valor_contrato: string
}

export default function ResumoContratoDetalhePage() {
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const [data, setData] = useState<ResumoContratoDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [references, setReferences] = useState<ResumoContratoReferencia[]>([])
  const [loadingReferences, setLoadingReferences] = useState(false)
  const [selectedPropostaId, setSelectedPropostaId] = useState("")
  const [editForm, setEditForm] = useState({
    titulo: "",
    periodo_referencia: "",
  })
  const [editItems, setEditItems] = useState<EditableItem[]>([])

  async function fetchData(options: { silent?: boolean } = {}) {
    const { silent = false } = options
    try {
      if (!silent) {
        setLoading(true)
      }

      const response = await fetch(`/api/resumo-contratos/${id}`, { cache: "no-store" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao carregar resumo de contratos.")
      }

      setData(payload)
    } catch (error) {
      if (!silent) {
        alert(error instanceof Error ? error.message : "Erro ao carregar resumo de contratos.")
      }
      setData(null)
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  async function fetchReferences() {
    try {
      setLoadingReferences(true)
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
      setLoadingReferences(false)
    }
  }

  useEffect(() => {
    if (Number.isFinite(id) && id > 0) {
      void fetchData()
    }
  }, [id])

  useLiveRefresh(() => fetchData({ silent: true }), {
    enabled: Number.isFinite(id) && id > 0 && !editing && !saving,
    intervalMs: 25000,
  })

  const margemBruta = useMemo(() => {
    if (!data || data.valor_total_contrato <= 0) {
      return 0
    }

    return (data.lucro_bruto_total / data.valor_total_contrato) * 100
  }, [data])

  const highestContractItem = useMemo(() => {
    if (!data?.itens.length) {
      return null
    }

    return [...data.itens].sort((left, right) => right.valor_contrato - left.valor_contrato)[0]
  }, [data])

  const highestCostItem = useMemo(() => {
    if (!data?.itens.length) {
      return null
    }

    return [...data.itens].sort((left, right) => right.valor_real_gasto - left.valor_real_gasto)[0]
  }, [data])

  const pagination = useListPagination(data?.itens ?? [], {
    storageKey: `resumo-contratos-${id}-page-size`,
    resetKey: String(data?.updated_at ?? ""),
  })

  const editOverview = useMemo(() => {
    return editItems.reduce(
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
  }, [editItems])

  const availableOptions = useMemo(() => {
    const selectedIds = new Set(editItems.map((item) => item.proposta_id))
    return references
      .filter((item) => !selectedIds.has(item.proposta_id))
      .map((item) => ({
        value: String(item.proposta_id),
        label: `${item.cliente_nome} - ${item.proposta_nome}`,
        description: `Gasto real atual: ${formatCurrency(item.valor_real_gasto)}`,
      }))
  }, [editItems, references])

  function startEditing() {
    if (!data) {
      return
    }

    setEditForm({
      titulo: data.titulo,
      periodo_referencia: data.periodo_referencia,
    })
    setEditItems(
      data.itens.map((item) => ({
        proposta_id: item.proposta_id,
        proposta_nome: item.proposta_nome,
        cliente_id: item.cliente_id,
        cliente_nome: item.cliente_nome,
        valor_real_gasto: item.valor_real_gasto,
        valor_previsto: 0,
        data_inicio: item.data_inicio,
        data_fim: item.data_fim,
        valor_contrato: String(item.valor_contrato),
      })),
    )
    setSelectedPropostaId("")
    setEditing(true)
    void fetchReferences()
  }

  function cancelEditing() {
    setEditing(false)
    setSelectedPropostaId("")
  }

  function handleAddSelectedProposal() {
    const propostaId = Number(selectedPropostaId)
    if (!Number.isFinite(propostaId) || propostaId <= 0) {
      return
    }

    const reference = references.find((item) => item.proposta_id === propostaId)
    if (!reference) {
      return
    }

    setEditItems((current) => [...current, { ...reference, valor_contrato: "" }])
    setSelectedPropostaId("")
  }

  function handleRemoveSelectedProposal(propostaId: number) {
    setEditItems((current) => current.filter((item) => item.proposta_id !== propostaId))
  }

  function handleContractValueChange(propostaId: number, value: string) {
    setEditItems((current) =>
      current.map((item) => (item.proposta_id === propostaId ? { ...item, valor_contrato: value } : item)),
    )
  }

  async function handleSave() {
    const payload: ResumoContratoFormData = {
      titulo: editForm.titulo.trim(),
      periodo_referencia: editForm.periodo_referencia,
      itens: editItems.map((item) => ({
        proposta_id: item.proposta_id,
        valor_contrato: Number(item.valor_contrato || 0),
      })),
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/resumo-contratos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(result?.error || "Erro ao atualizar resumo de contratos.")
      }

      setEditing(false)
      await fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao atualizar resumo de contratos.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!data) {
      return
    }

    const confirmed = window.confirm(`Deseja excluir o resumo "${data.titulo}"? Esta ação removerá a seleção inteira.`)
    if (!confirmed) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/resumo-contratos/${id}`, {
        method: "DELETE",
      })
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(result?.error || "Erro ao excluir resumo de contratos.")
      }

      window.location.href = "/resumo-contratos"
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao excluir resumo de contratos.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={data?.titulo ?? "Resumo de Contratos"}
        description={
          data
            ? `Seleção de ${formatPeriodo(data.periodo_referencia)}, criada por ${data.created_by_nome} e atualizada em ${format(parseISO(data.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}.`
            : "Carregando seleção..."
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/resumo-contratos">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>
            {!loading && data ? (
              editing ? (
                <>
                  <Button variant="outline" onClick={cancelEditing} disabled={saving}>
                    <X className="mr-2 h-4 w-4" />
                    Cancelar edição
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar alterações
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={handleDelete} disabled={deleting}>
                    {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Excluir seleção
                  </Button>
                  <Button onClick={startEditing}>
                    <PencilLine className="mr-2 h-4 w-4" />
                    Editar resumo
                  </Button>
                </>
              )
            ) : null}
          </>
        }
      />

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !data ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Resumo de contratos não encontrado.
        </div>
      ) : editing ? (
        <>
          <div className="grid gap-4 xl:grid-cols-4">
            <SummaryMetricCard title="Obras em edição" value={editItems.length} description="Quantidade de obras que permanecerão neste resumo." />
            <SummaryMetricCard title="Contrato total" value={formatCurrency(editOverview.valor_total_contrato)} description="Soma dos contratos fechados informados nesta revisão." />
            <SummaryMetricCard title="Gasto real total" value={formatCurrency(editOverview.valor_total_real_gasto)} description="Compras já registradas nas obras selecionadas." />
            <SummaryMetricCard
              title="Lucro bruto total"
              value={formatCurrency(editOverview.lucro_bruto_total)}
              description="Resultado bruto previsto após esta edição."
              tone={editOverview.lucro_bruto_total < 0 ? "danger" : "default"}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.9fr)]">
            <FormSectionCard title="Editar obras do resumo" description="Adicione, remova ou ajuste os contratos fechados das obras selecionadas.">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <SearchableSelect
                  value={selectedPropostaId}
                  onValueChange={setSelectedPropostaId}
                  options={availableOptions}
                  placeholder={loadingReferences ? "Carregando obras..." : "Pesquisar cliente ou proposta"}
                  searchPlaceholder="Buscar por cliente ou proposta"
                  emptyLabel="Nenhuma obra disponível"
                  disabled={loadingReferences}
                />
                <Button type="button" variant="outline" onClick={handleAddSelectedProposal} disabled={!selectedPropostaId}>
                  <Plus className="mr-2 h-4 w-4" />
                  Inserir na lista
                </Button>
              </div>

              <ContractSummaryItems
                items={editItems}
                editable
                onContractValueChange={handleContractValueChange}
                onRemove={handleRemoveSelectedProposal}
              />
            </FormSectionCard>

            <div className="space-y-4">
              <FormSectionCard title="Identificação do resumo" description="Atualize o nome e o período exibidos na listagem administrativa.">
                <div className="space-y-4">
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium">Título</span>
                    <Input
                      value={editForm.titulo}
                      onChange={(event) => setEditForm((current) => ({ ...current, titulo: event.target.value }))}
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
                      value={editForm.periodo_referencia}
                      onChange={(event) => setEditForm((current) => ({ ...current, periodo_referencia: event.target.value }))}
                    />
                  </label>
                </div>
              </FormSectionCard>

              <SectionCard title="Resumo da revisão" description="Conferência rápida antes de salvar as alterações.">
                <div className="space-y-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <FileStack className="h-4 w-4 text-primary" />
                      Obras mantidas
                    </span>
                    <strong>{editItems.length}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <ReceiptText className="h-4 w-4 text-primary" />
                      Contrato total
                    </span>
                    <strong>{formatCurrency(editOverview.valor_total_contrato)}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Target className="h-4 w-4 text-primary" />
                      Lucro bruto total
                    </span>
                    <strong className={editOverview.lucro_bruto_total < 0 ? "text-red-500 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"}>
                      {formatCurrency(editOverview.lucro_bruto_total)}
                    </strong>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-4">
            <SummaryMetricCard title="Obras selecionadas" value={data.quantidade_obras} description="Quantidade de obras que compõem esta seleção." />
            <SummaryMetricCard title="Contrato total" value={formatCurrency(data.valor_total_contrato)} description="Soma dos contratos fechados informados pelo administrador." />
            <SummaryMetricCard title="Gasto real total" value={formatCurrency(data.valor_total_real_gasto)} description="Total já gasto nas compras vinculadas às obras selecionadas." />
            <SummaryMetricCard
              title="Lucro bruto total"
              value={formatCurrency(data.lucro_bruto_total)}
              description={`Margem bruta consolidada de ${margemBruta.toFixed(1)}%.`}
              tone={data.lucro_bruto_total < 0 ? "danger" : "default"}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.95fr)]">
            <SectionCard title="Obras da seleção" description="Clientes, propostas, gasto real, contrato fechado e lucro bruto por obra.">
              <ContractSummaryItems items={pagination.items} />
              <ListPaginationBar
                currentPage={pagination.currentPage}
                endItem={pagination.endItem}
                itemLabel="obra(s)"
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
                pageSize={pagination.pageSize}
                startItem={pagination.startItem}
                totalItems={pagination.totalItems}
                totalPages={pagination.totalPages}
              />
            </SectionCard>

            <div className="space-y-4">
              <SectionCard title="Contexto da seleção" description="Informações úteis para leitura rápida do agrupamento salvo.">
                <div className="space-y-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Período</span>
                    <span className="inline-flex items-center gap-2 font-medium">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {formatPeriodo(data.periodo_referencia)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Criado por</span>
                    <span className="font-medium">{data.created_by_nome}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Criado em</span>
                    <span className="font-medium">{format(parseISO(data.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Última atualização</span>
                    <span className="font-medium">{format(parseISO(data.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Insights do agrupamento" description="Pontos úteis para uma leitura gerencial mais rápida.">
                <div className="space-y-4 text-sm">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-muted-foreground">Maior contrato da seleção</p>
                    <p className="mt-1 font-semibold">{highestContractItem ? `${highestContractItem.cliente_nome} - ${highestContractItem.proposta_nome}` : "Não informado"}</p>
                    <p className="mt-1 text-primary">{highestContractItem ? formatCurrency(highestContractItem.valor_contrato) : "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-muted-foreground">Maior gasto real acumulado</p>
                    <p className="mt-1 font-semibold">{highestCostItem ? `${highestCostItem.cliente_nome} - ${highestCostItem.proposta_nome}` : "Não informado"}</p>
                    <p className="mt-1 text-primary">{highestCostItem ? formatCurrency(highestCostItem.valor_real_gasto) : "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-muted-foreground">
                    Este painel é dinâmico: o gasto real continua acompanhando as compras vinculadas às obras, então os números refletem a situação mais recente do sistema.
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
