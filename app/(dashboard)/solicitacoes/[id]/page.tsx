"use client"

import { use, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Loader2, MoreHorizontal, Paperclip, RefreshCcw, Save, Trash2, X } from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { CompraRateioFields, type CompraRateioFormState } from "@/components/compras/compra-rateio-fields"
import { PageHeader, SectionCard, SummaryMetricCard } from "@/components/shared/page-layout"
import { useLiveRefresh } from "@/components/shared/use-live-refresh"
import { hasFeatureAccess } from "@/lib/auth/permissions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  CATEGORIA_LABELS,
  ETAPA_FLUXO_BADGE_CLASSES,
  getEtapaFluxoLabel,
  isCompraLockedAfterAdminApproval,
  shouldShowCompraStatusBadge,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  TIPO_ANEXO_LABELS,
} from "@/lib/domain"
import type { Anexo, Compra, HistoricoCompra, TipoAnexo } from "@/lib/types"

type CompraDetalhe = Compra & {
  historico: HistoricoCompra[]
  anexos: Anexo[]
  proposta_orcamento?: {
    valor_previsto: number
    valor_previsto_perfis: number
    valor_previsto_vidros: number
    valor_previsto_acessorios: number
    valor_previsto_outros: number
    custo_perdas: number
  } | null
}

const ATTACHMENT_TYPE_OPTIONS: TipoAnexo[] = ["cotacao", "nf", "boleto", "outro"]

export default function SolicitacaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const session = useCurrentSession()
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)
  const [compra, setCompra] = useState<CompraDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [attachmentType, setAttachmentType] = useState<TipoAnexo>("cotacao")
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])
  const [uploadingAttachments, setUploadingAttachments] = useState(false)
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<number | null>(null)
  const [motivoRetificacao, setMotivoRetificacao] = useState("")
  const [savingQuoteData, setSavingQuoteData] = useState(false)
  const [quoteDataDirty, setQuoteDataDirty] = useState(false)
  const [savingRequesterData, setSavingRequesterData] = useState(false)
  const [requesterDataDirty, setRequesterDataDirty] = useState(false)
  const [deletingSolicitacao, setDeletingSolicitacao] = useState(false)
  const [togglingArchive, setTogglingArchive] = useState(false)
  const [isEditingRequesterData, setIsEditingRequesterData] = useState(false)
  const [requesterData, setRequesterData] = useState({
    fornecedor: "",
    descricao: "",
  })
  const [quoteData, setQuoteData] = useState<CompraRateioFormState>({
    valor_categoria_perfis: "",
    valor_categoria_vidros: "",
    valor_categoria_acessorios: "",
    valor_categoria_perdas: "",
    valor_categoria_outros: "",
  })
  const canViewAsCompras = Boolean(session && hasFeatureAccess(session.perfil, "compras", session.features))
  const canEditSolicitacaoFeature = Boolean(session && hasFeatureAccess(session.perfil, "editar_solicitacao", session.features))
  const canArchiveSolicitacaoFeature = Boolean(session && hasFeatureAccess(session.perfil, "arquivar_solicitacao", session.features))
  const canDeleteSolicitacaoFeature = Boolean(session && hasFeatureAccess(session.perfil, "excluir_solicitacao", session.features))
  const canApproveSolicitacaoFeature = Boolean(session && hasFeatureAccess(session.perfil, "aprovar_solicitacao", session.features))
  const canRetifySolicitacaoFeature = Boolean(session && hasFeatureAccess(session.perfil, "retificar_solicitacao", session.features))
  const canDeleteAttachment = Boolean(
    session && hasFeatureAccess(session.perfil, "excluir_anexo_compra", session.features),
  )
  const canDeleteAttachmentAfterAdminApproval = Boolean(
    session &&
      hasFeatureAccess(session.perfil, "excluir_anexo_compra_pos_aprovacao_admin", session.features),
  )
  const canEditSolicitacaoAfterAdminApprovalFeature = Boolean(
    session && hasFeatureAccess(session.perfil, "editar_solicitacao_pos_aprovacao_admin", session.features),
  )
  const canArchiveSolicitacaoAfterAdminApprovalFeature = Boolean(
    session && hasFeatureAccess(session.perfil, "arquivar_solicitacao_pos_aprovacao_admin", session.features),
  )
  const canDeleteSolicitacaoAfterAdminApprovalFeature = Boolean(
    session && hasFeatureAccess(session.perfil, "excluir_solicitacao_pos_aprovacao_admin", session.features),
  )
  const canManageAttachments = Boolean(
    session &&
      (hasFeatureAccess(session.perfil, "solicitacoes", session.features) ||
        hasFeatureAccess(session.perfil, "compras", session.features)),
  )
  const canDeleteAttachments = Boolean(
    compra &&
      (session?.perfil === "admin" ||
        (canViewAsCompras &&
          canDeleteAttachment &&
          (!isCompraLockedAfterAdminApproval(compra) || canDeleteAttachmentAfterAdminApproval))),
  )
  const requiresAdminApprovalForSensitiveChanges = Boolean(
    compra && session?.perfil !== "admin" && canViewAsCompras && isCompraLockedAfterAdminApproval(compra),
  )

  useEffect(() => {
    setLoading(true)
    void fetchSolicitacao()
  }, [id])

  useLiveRefresh(() => fetchSolicitacao({ silent: true }), {
    enabled:
      !loadError &&
      !processing &&
      !savingQuoteData &&
      !savingRequesterData &&
      !uploadingAttachments &&
      deletingAttachmentId === null &&
      !togglingArchive &&
      !quoteDataDirty &&
      !requesterDataDirty &&
      !isEditingRequesterData,
    intervalMs: 10000,
  })

  async function fetchSolicitacao(options: { silent?: boolean } = {}) {
    const { silent = false } = options

    try {
      const response = await fetch(`/api/solicitacoes/${id}`, { cache: "no-store" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const message = payload?.error || "Erro ao carregar solicitacao."

        if (response.status === 401 || response.status === 403 || response.status === 404) {
          setCompra(null)
          setLoadError(message)
        } else if (!silent) {
          setLoadError(message)
        }

        return
      }

      setLoadError(null)
      setCompra(payload)
      setRequesterData({
        fornecedor: payload.fornecedor ?? "",
        descricao: payload.descricao ?? "",
      })
      setRequesterDataDirty(false)
      setIsEditingRequesterData(false)
      setQuoteData({
        valor_categoria_perfis: payload.valor_categoria_perfis?.toString() ?? "",
        valor_categoria_vidros: payload.valor_categoria_vidros?.toString() ?? "",
        valor_categoria_acessorios: payload.valor_categoria_acessorios?.toString() ?? "",
        valor_categoria_perdas: payload.valor_categoria_perdas?.toString() ?? "",
        valor_categoria_outros: payload.valor_categoria_outros?.toString() ?? "",
      })
      setQuoteDataDirty(false)
    } catch (error) {
      if (!silent) {
        setLoadError(error instanceof Error ? error.message : "Erro ao carregar solicitacao.")
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  async function runAction(
    path: string,
    body: Record<string, unknown> | null,
    successMessage: string,
  ) {
    setProcessing(true)

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao atualizar solicitacao.")
      }

      alert(successMessage)
      await fetchSolicitacao()
      setMotivoRetificacao("")
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao atualizar solicitacao.")
    } finally {
      setProcessing(false)
    }
  }

  async function handleUploadAttachments() {
    if (attachmentFiles.length === 0) {
      alert("Selecione pelo menos um arquivo.")
      return
    }

    setUploadingAttachments(true)

    try {
      const uploadData = new FormData()
      uploadData.append("tipo", attachmentType)
      attachmentFiles.forEach((file) => uploadData.append("files", file))

      const response = await fetch(`/api/compras/${id}/anexos`, {
        method: "POST",
        body: uploadData,
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao enviar anexos.")
      }

      setAttachmentFiles([])
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = ""
      }
      await fetchSolicitacao()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao enviar anexos.")
    } finally {
      setUploadingAttachments(false)
    }
  }

  async function handleDeleteAttachment(anexo: Anexo) {
    if (!compra) {
      return
    }

    if (!confirm(`Deseja excluir o anexo "${anexo.nome_arquivo}"?`)) {
      return
    }

    setDeletingAttachmentId(anexo.id)

    try {
      if (requiresAdminApprovalForSensitiveChanges) {
        const motivo = window.prompt("Descreva o motivo da exclusao do anexo para enviar ao administrador.")
        if (motivo === null) {
          return
        }

        const response = await fetch("/api/solicitacoes-sensiveis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entidade: "compra",
            entidade_id: compra.id,
            acao: "editar",
            motivo: motivo.trim() || `Exclusao solicitada para o anexo ${anexo.nome_arquivo}.`,
            payload: {
              operation: "delete_attachment",
              attachment_id: anexo.id,
              attachment_name: anexo.nome_arquivo,
            },
          }),
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error || "Erro ao solicitar exclusao do anexo.")
        }

        alert("Solicitacao enviada ao administrador.")
        return
      }

      const response = await fetch(`/api/compras/${id}/anexos/${anexo.id}`, {
        method: "DELETE",
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao excluir anexo.")
      }

      await fetchSolicitacao()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao excluir anexo.")
    } finally {
      setDeletingAttachmentId(null)
    }
  }

  function getAttachmentHref(anexo: Anexo) {
    return `/api/compras/${compra?.id ?? id}/anexos/${anexo.id}/arquivo`
  }

  async function handleSaveQuoteData() {
    setSavingQuoteData(true)

    try {
      if (requiresAdminApprovalForSensitiveChanges) {
        const motivo = window.prompt("Descreva o motivo da alteracao para enviar ao administrador.")
        if (motivo === null) {
          return
        }

        const response = await fetch("/api/solicitacoes-sensiveis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entidade: "compra",
            entidade_id: Number(id),
            acao: "editar",
            motivo: motivo.trim() || "Ajuste do rateio da compra solicitado ao administrador.",
            payload: {
              valor_categoria_perfis: toNumber(quoteData.valor_categoria_perfis),
              valor_categoria_vidros: toNumber(quoteData.valor_categoria_vidros),
              valor_categoria_acessorios: toNumber(quoteData.valor_categoria_acessorios),
              valor_categoria_perdas: toNumber(quoteData.valor_categoria_perdas),
              valor_categoria_outros: toNumber(quoteData.valor_categoria_outros),
            },
          }),
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error || "Erro ao solicitar alteracao da cotacao.")
        }

        alert("Solicitacao enviada ao administrador.")
        setQuoteDataDirty(false)
        return
      }

      const response = await fetch(`/api/compras/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valor_categoria_perfis: toNumber(quoteData.valor_categoria_perfis),
          valor_categoria_vidros: toNumber(quoteData.valor_categoria_vidros),
          valor_categoria_acessorios: toNumber(quoteData.valor_categoria_acessorios),
          valor_categoria_perdas: toNumber(quoteData.valor_categoria_perdas),
          valor_categoria_outros: toNumber(quoteData.valor_categoria_outros),
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao salvar os dados da cotacao.")
      }

      setQuoteDataDirty(false)
      await fetchSolicitacao()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar os dados da cotacao.")
    } finally {
      setSavingQuoteData(false)
    }
  }

  async function handleSaveRequesterData() {
    if (!requesterData.fornecedor.trim()) {
      alert("Informe o fornecedor sugerido.")
      return
    }

    setSavingRequesterData(true)

    try {
      if (requiresAdminApprovalForRequesterEdit) {
        const motivo = window.prompt("Descreva o motivo da alteracao para enviar ao administrador.")
        if (motivo === null) {
          return
        }

        const response = await fetch("/api/solicitacoes-sensiveis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entidade: "compra",
            entidade_id: Number(id),
            acao: "editar",
            motivo: motivo.trim() || "Ajuste da solicitacao solicitado ao administrador.",
            payload: {
              fornecedor: requesterData.fornecedor.trim(),
              descricao: requesterData.descricao.trim(),
            },
          }),
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error || "Erro ao solicitar alteracao da solicitacao.")
        }

        alert("Solicitacao enviada ao administrador.")
        setRequesterDataDirty(false)
        setIsEditingRequesterData(false)
        setRequesterData({
          fornecedor: compra?.fornecedor ?? "",
          descricao: compra?.descricao ?? "",
        })
        return
      }

      const response = await fetch(`/api/solicitacoes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fornecedor: requesterData.fornecedor.trim(),
          descricao: requesterData.descricao.trim(),
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao atualizar solicitacao.")
      }

      setRequesterDataDirty(false)
      setIsEditingRequesterData(false)
      await fetchSolicitacao()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao atualizar solicitacao.")
    } finally {
      setSavingRequesterData(false)
    }
  }

  function handleStartRequesterEdit() {
    setRequesterData({
      fornecedor: compra?.fornecedor ?? "",
      descricao: compra?.descricao ?? "",
    })
    setRequesterDataDirty(false)
    setIsEditingRequesterData(true)
  }

  function handleCancelRequesterEdit() {
    setRequesterData({
      fornecedor: compra?.fornecedor ?? "",
      descricao: compra?.descricao ?? "",
    })
    setRequesterDataDirty(false)
    setIsEditingRequesterData(false)
  }

  async function handleArchiveToggle() {
    if (!compra) {
      return
    }

    const nextArchivedState = !compra.arquivado

    if (requiresAdminApprovalForRequesterArchive) {
      const motivo = window.prompt(
        nextArchivedState
          ? "Descreva o motivo do arquivamento para enviar ao administrador."
          : "Descreva o motivo do desarquivamento para enviar ao administrador.",
      )
      if (motivo === null) {
        return
      }

      setTogglingArchive(true)

      try {
        const response = await fetch("/api/solicitacoes-sensiveis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entidade: "compra",
            entidade_id: compra.id,
            acao: "editar",
            motivo: motivo.trim() || (nextArchivedState ? "Arquivamento da solicitacao solicitado ao administrador." : "Desarquivamento da solicitacao solicitado ao administrador."),
            payload: {
              operation: "toggle_archive",
              arquivado: nextArchivedState,
            },
          }),
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error || "Erro ao solicitar arquivamento da solicitacao.")
        }

        alert("Solicitacao enviada ao administrador.")
      } catch (error) {
        alert(error instanceof Error ? error.message : "Erro ao solicitar arquivamento da solicitacao.")
      } finally {
        setTogglingArchive(false)
      }

      return
    }

    setTogglingArchive(true)

    try {
      const response = await fetch(`/api/solicitacoes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arquivado: nextArchivedState }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao atualizar arquivamento da solicitacao.")
      }

      await fetchSolicitacao()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao atualizar arquivamento da solicitacao.")
    } finally {
      setTogglingArchive(false)
    }
  }

  async function handleDeleteSolicitacao() {
    if (!compra) {
      return
    }

    if (requiresAdminApprovalForRequesterDelete) {
      const motivo = window.prompt("Descreva o motivo da exclusao para enviar ao administrador.")
      if (motivo === null) {
        return
      }

      setDeletingSolicitacao(true)

      try {
        const response = await fetch("/api/solicitacoes-sensiveis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entidade: "compra",
            entidade_id: compra.id,
            acao: "excluir",
            motivo: motivo.trim() || "Exclusao da solicitacao solicitada ao administrador.",
          }),
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error || "Erro ao solicitar exclusao da solicitacao.")
        }

        alert("Solicitacao enviada ao administrador.")
      } catch (error) {
        alert(error instanceof Error ? error.message : "Erro ao solicitar exclusao da solicitacao.")
      } finally {
        setDeletingSolicitacao(false)
      }

      return
    }

    if (!confirm("Deseja excluir esta solicitacao?")) {
      return
    }

    setDeletingSolicitacao(true)

    try {
      const response = await fetch(`/api/solicitacoes/${id}`, {
        method: "DELETE",
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao excluir solicitacao.")
      }

      window.location.href = "/solicitacoes"
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao excluir solicitacao.")
    } finally {
      setDeletingSolicitacao(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  if (!compra) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">{loadError ?? "Solicitacao nao encontrada"}</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const canAdminManageSolicitacao = session?.perfil === "admin"
  const canApproveAsRequester =
    compra.etapa_fluxo === "analise_solicitante" &&
    canApproveSolicitacaoFeature &&
    (session?.perfil === "admin" ||
      session?.userId === compra.solicitante_id ||
      (!compra.solicitante_id && compra.solicitado_por?.trim() === session?.nome?.trim()))
  const requesterOwnsSolicitacao = Boolean(
    session?.userId === compra.solicitante_id || (!compra.solicitante_id && compra.solicitado_por?.trim() === session?.nome?.trim()),
  )
  const shouldShowOperationalContext = canViewAsCompras || canAdminManageSolicitacao
  const canManageSolicitacaoActions =
    (canAdminManageSolicitacao && (canEditSolicitacaoFeature || canArchiveSolicitacaoFeature || canDeleteSolicitacaoFeature)) ||
    (requesterOwnsSolicitacao && (canEditSolicitacaoFeature || canArchiveSolicitacaoFeature || canDeleteSolicitacaoFeature))
  const isSolicitacaoLockedForRequester = requesterOwnsSolicitacao && isCompraLockedAfterAdminApproval(compra)
  const requiresAdminApprovalForRequesterChanges = !canAdminManageSolicitacao && isSolicitacaoLockedForRequester
  const canEditRequesterData =
    (canAdminManageSolicitacao && canEditSolicitacaoFeature) ||
    (requesterOwnsSolicitacao &&
      canEditSolicitacaoFeature &&
      (!isCompraLockedAfterAdminApproval(compra) || canEditSolicitacaoAfterAdminApprovalFeature))
  const canDirectlyDeleteSolicitacao =
    (canAdminManageSolicitacao && canDeleteSolicitacaoFeature) ||
    (requesterOwnsSolicitacao &&
      canDeleteSolicitacaoFeature &&
      (!isCompraLockedAfterAdminApproval(compra) || canDeleteSolicitacaoAfterAdminApprovalFeature))
  const requiresAdminApprovalForRequesterEdit =
    requesterOwnsSolicitacao &&
    canEditSolicitacaoFeature &&
    isCompraLockedAfterAdminApproval(compra) &&
    !canEditSolicitacaoAfterAdminApprovalFeature
  const requiresAdminApprovalForRequesterArchive =
    requesterOwnsSolicitacao &&
    canArchiveSolicitacaoFeature &&
    isCompraLockedAfterAdminApproval(compra) &&
    !canArchiveSolicitacaoAfterAdminApprovalFeature
  const requiresAdminApprovalForRequesterDelete =
    requesterOwnsSolicitacao &&
    canDeleteSolicitacaoFeature &&
    isCompraLockedAfterAdminApproval(compra) &&
    !canDeleteSolicitacaoAfterAdminApprovalFeature
  const requesterActionLabel = requiresAdminApprovalForRequesterEdit ? "Solicitar alteracao" : "Editar solicitacao"
  const canArchiveSolicitacaoAction =
    (canAdminManageSolicitacao && canArchiveSolicitacaoFeature) ||
    (requesterOwnsSolicitacao && canArchiveSolicitacaoFeature)
  const canDeleteSolicitacaoAction =
    (canAdminManageSolicitacao && canDeleteSolicitacaoFeature) ||
    (requesterOwnsSolicitacao && canDeleteSolicitacaoFeature)
  const canEditQuoteData = canViewAsCompras && compra.status !== "pedido_autorizado"
  const propostaOrcamento = compra.proposta_orcamento
  const quoteResumo = [
    { label: "Perfis", value: compra.valor_categoria_perfis ?? 0 },
    { label: "Vidros", value: compra.valor_categoria_vidros ?? 0 },
    { label: "Acessorios", value: compra.valor_categoria_acessorios ?? 0 },
    { label: "Perdas/Reposicao", value: compra.valor_categoria_perdas ?? 0 },
    { label: "Outros", value: compra.valor_categoria_outros ?? 0 },
  ]
  const hasQuoteResumo = quoteResumo.some((item) => item.value > 0)
  const orcamentoCategorias = propostaOrcamento
    ? [
        { label: "Perfis", value: propostaOrcamento.valor_previsto_perfis },
        { label: "Vidros", value: propostaOrcamento.valor_previsto_vidros },
        { label: "Acessorios", value: propostaOrcamento.valor_previsto_acessorios },
        { label: "Outros", value: propostaOrcamento.valor_previsto_outros },
        { label: "Perdas/Reposicao", value: propostaOrcamento.custo_perdas },
      ]
    : []

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={`Solicitacao #${compra.id}`}
        description={`${compra.cliente_nome} - ${compra.proposta_nome}`}
        actions={
          <>
            <Link href="/solicitacoes">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </Link>
            {isEditingRequesterData ? (
              <>
                <Button variant="outline" onClick={handleCancelRequesterEdit} disabled={savingRequesterData}>
                  <X className="mr-2 h-4 w-4" />
                  Cancelar edicao
                </Button>
                <Button type="button" onClick={handleSaveRequesterData} disabled={savingRequesterData || !requesterDataDirty}>
                  {savingRequesterData ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {requiresAdminApprovalForRequesterChanges ? "Enviar para aprovacao" : "Salvar alteracoes"}
                    </>
                  )}
                </Button>
              </>
            ) : canManageSolicitacaoActions ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <MoreHorizontal className="mr-2 h-4 w-4" />
                    Mais acoes
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEditRequesterData || requiresAdminApprovalForRequesterEdit ? (
                    <DropdownMenuItem onClick={handleStartRequesterEdit}>{requesterActionLabel}</DropdownMenuItem>
                  ) : null}
                  {canArchiveSolicitacaoAction ? (
                    <DropdownMenuItem onClick={handleArchiveToggle} disabled={togglingArchive}>
                      {requiresAdminApprovalForRequesterArchive
                        ? compra.arquivado
                          ? "Solicitar desarquivamento"
                          : "Solicitar arquivamento"
                        : compra.arquivado
                          ? "Desarquivar solicitacao"
                          : "Arquivar solicitacao"}
                    </DropdownMenuItem>
                  ) : null}
                  {canArchiveSolicitacaoAction && canDeleteSolicitacaoAction ? <DropdownMenuSeparator /> : null}
                  {canDeleteSolicitacaoAction ? (
                    <DropdownMenuItem variant="destructive" onClick={handleDeleteSolicitacao} disabled={deletingSolicitacao || togglingArchive}>
                      {canDirectlyDeleteSolicitacao && !requiresAdminApprovalForRequesterDelete ? "Excluir solicitacao" : "Solicitar exclusao"}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge className={ETAPA_FLUXO_BADGE_CLASSES[compra.etapa_fluxo]}>{getEtapaFluxoLabel(compra)}</Badge>
        {shouldShowCompraStatusBadge(compra) ? (
          <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryMetricCard title="Solicitante" value={compra.solicitado_por || "Nao informado"} description="Responsavel pelo envio desta solicitacao." />
        <SummaryMetricCard title="Fornecedor" value={compra.fornecedor || "Nao definido"} description="Referencia informada para iniciar a cotacao." />
        <SummaryMetricCard title="Etapa atual" value={getEtapaFluxoLabel(compra)} description="Momento atual desta solicitacao dentro do fluxo." />
        <SummaryMetricCard title="Anexos" value={compra.anexos.length} description="Arquivos e referencias enviados junto ao pedido." />
      </div>

        <Tabs defaultValue="resumo" className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="cotacao">Cotacao e aprovacao</TabsTrigger>
            <TabsTrigger value="anexos">Anexos</TabsTrigger>
          </TabsList>

        <TabsContent value="resumo">
          <SectionCard title="Dados da solicitacao" description="Informacoes base para a cotacao e os proximos setores do fluxo.">
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Solicitante">
                  <InfoValue>{compra.solicitado_por || "Nao informado"}</InfoValue>
                </Field>
                <Field label="Fornecedor sugerido">
                  {isEditingRequesterData ? (
                    <Input
                      value={requesterData.fornecedor}
                      onChange={(event) => {
                        setRequesterDataDirty(true)
                        setRequesterData((current) => ({ ...current, fornecedor: event.target.value }))
                      }}
                      placeholder="Nome do fornecedor sugerido"
                    />
                  ) : (
                    <InfoValue>{compra.fornecedor}</InfoValue>
                  )}
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Categoria principal">
                  <InfoValue>{CATEGORIA_LABELS[compra.categoria]}</InfoValue>
                </Field>
                <Field label="Data de envio ao fornecedor">
                  <InfoValue>{compra.data_envio_fornecedor || "Nao enviada"}</InfoValue>
                </Field>
              </div>

              <Field label="Descricao do material">
                {isEditingRequesterData ? (
                  <div className="space-y-3">
                    <Textarea
                      rows={6}
                      value={requesterData.descricao}
                      onChange={(event) => {
                        setRequesterDataDirty(true)
                        setRequesterData((current) => ({ ...current, descricao: event.target.value }))
                      }}
                      placeholder="Descreva as observacoes da solicitacao. Se preferir, mantenha apenas os anexos como referencia."
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border bg-muted/15 p-4 text-sm leading-6 text-foreground">
                    {compra.descricao?.trim() || "Sem descricao textual. Consulte o anexo da solicitacao para o material pedido."}
                  </div>
                )}
              </Field>

              {shouldShowOperationalContext && propostaOrcamento ? (
                <Field label="Orcamento previsto da proposta">
                  <div className="space-y-4 rounded-xl border bg-muted/10 p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <InfoValue>{`Previsto total: ${formatCurrency(propostaOrcamento.valor_previsto)}`}</InfoValue>
                      <InfoValue>{`Perdas/Reposicao: ${formatCurrency(propostaOrcamento.custo_perdas)}`}</InfoValue>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      {orcamentoCategorias.map((item) => (
                        <div key={item.label} className="rounded-lg border bg-background px-3 py-2">
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="text-sm font-medium text-foreground">{formatCurrency(item.value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Field>
              ) : null}

              {shouldShowOperationalContext ? (
                <Field label="Assinaturas e registros do fluxo">
                  <div className="grid gap-3 md:grid-cols-2">
                    <SignatureTag label="Solicitante" value={compra.aprovado_solicitante_por} date={compra.aprovado_solicitante_em} />
                    <SignatureTag label="Administrador" value={compra.aprovado_admin_por} date={compra.aprovado_admin_em} />
                    <SignatureTag label="Financeiro" value={compra.aprovado_financeiro_por} date={compra.aprovado_financeiro_em} />
                    <SignatureTag label="Comprador" value={compra.confirmado_fornecedor_por} date={compra.confirmado_fornecedor_em} />
                  </div>
                </Field>
              ) : null}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="cotacao">
          <div className="space-y-4">
            <SectionCard
              title="Cotacao desta solicitacao"
              description={
                canViewAsCompras
                  ? "O setor de compras registra a distribuicao da cotacao e devolve este pedido para aprovacao quando necessario."
                  : hasQuoteResumo
                    ? "Confira os valores informados pelo setor de compras antes de aprovar ou pedir retificacao."
                    : "Assim que o setor de compras concluir a cotacao, os valores aparecerao aqui para sua analise."
              }
            >
              {hasQuoteResumo ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {quoteResumo.map((item) => (
                    <div key={item.label} className="rounded-lg border bg-muted/10 px-4 py-3">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(item.value)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhum valor de cotacao foi registrado ainda para esta solicitacao.
                </div>
              )}
            </SectionCard>

            {canEditQuoteData ? (
              <SectionCard
                title="Dados da compra para a cotacao"
                description="O solicitante nao preenche este rateio. Essa distribuicao e informada pelo comprador durante a cotacao."
              >
                <CompraRateioFields
                  values={quoteData}
                  onChange={(field, value) => {
                    setQuoteDataDirty(true)
                    setQuoteData((current) => ({ ...current, [field]: value }))
                  }}
                  description="Preencha a distribuicao desta compra entre perfis, vidros, acessorios, perdas/reposicao e outros assim que a cotacao estiver sendo montada."
                />
                <div className="flex justify-end">
                  <Button type="button" onClick={handleSaveQuoteData} disabled={savingQuoteData}>
                    {savingQuoteData ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar dados da cotacao"
                    )}
                  </Button>
                </div>
              </SectionCard>
            ) : null}

            <SectionCard title="Acoes desta etapa" description="As transicoes do pedido acontecem por acoes diretas, sem troca manual de status.">
              {canApproveAsRequester || (canRetifySolicitacaoFeature && (requesterOwnsSolicitacao || canAdminManageSolicitacao)) ? (
                <div className="space-y-4">
                  {canApproveAsRequester ? (
                    <Button
                      className="w-full justify-start"
                      disabled={processing}
                      onClick={() =>
                        runAction(
                          `/api/solicitacoes/${compra.id}/aprovar`,
                          null,
                          canAdminManageSolicitacao
                            ? "Solicitacao aprovada pelo administrador para seguir ao proximo fluxo."
                            : "Solicitacao assinada e aprovada para seguir a autorizacao.",
                        )
                      }
                    >
                      {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      {canAdminManageSolicitacao ? "Aprovar solicitacao" : "Assinar e aprovar cotacao"}
                    </Button>
                  ) : null}

                  {canRetifySolicitacaoFeature ? (
                    <div className="space-y-2 rounded-lg border p-4">
                      <Label htmlFor="motivo-retificacao">Motivo da retificacao</Label>
                      <Textarea
                        id="motivo-retificacao"
                        value={motivoRetificacao}
                        onChange={(event) => setMotivoRetificacao(event.target.value)}
                        placeholder="Explique o que precisa ser ajustado antes de seguir."
                      />
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        disabled={processing || !motivoRetificacao.trim()}
                        onClick={() =>
                          runAction(
                            `/api/solicitacoes/${compra.id}/retificacao`,
                            { motivo: motivoRetificacao.trim() },
                            "Retificacao enviada ao setor de compras.",
                          )
                        }
                      >
                        {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                        Solicitar retificacao
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhuma acao imediata disponivel nesta etapa para o seu perfil.
                </div>
              )}
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="anexos">
          <SectionCard title="Anexos" description="Documentos e referencias enviados junto com a solicitacao.">
            {canManageAttachments ? (
              <div className="grid gap-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 md:grid-cols-[180px_1fr_auto]">
                <Field label="Tipo do anexo">
                  <Select value={attachmentType} onValueChange={(value) => setAttachmentType(value as TipoAnexo)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ATTACHMENT_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type} value={type}>
                          {TIPO_ANEXO_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Arquivos">
                  <div className="space-y-2">
                    <Input
                      ref={attachmentInputRef}
                      type="file"
                      multiple
                      onChange={(event) => setAttachmentFiles(Array.from(event.target.files ?? []))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Se algum documento antigo estiver indisponivel, envie novamente o arquivo por aqui para restaurar o acesso.
                    </p>
                  </div>
                </Field>

                <div className="flex items-end justify-end">
                  <Button type="button" onClick={handleUploadAttachments} disabled={uploadingAttachments || attachmentFiles.length === 0}>
                    {uploadingAttachments ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Paperclip className="mr-2 h-4 w-4" />
                        Enviar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : null}

            {compra.anexos.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Nenhum anexo enviado nesta solicitacao.
              </div>
            ) : (
              <div className="space-y-3">
                {compra.anexos.map((anexo) => (
                  <div key={anexo.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <div className="font-medium">{anexo.nome_arquivo}</div>
                      <div className="text-xs text-muted-foreground">
                        {anexo.tipo === "outro" ? "Anexo da solicitacao" : TIPO_ANEXO_LABELS[anexo.tipo]}
                      </div>
                      {anexo.disponivel === false ? (
                        <div className="mt-1 text-xs text-destructive">
                          Arquivo indisponivel no servidor atual. Reenvie este documento para restaurar o acesso.
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {anexo.disponivel === false ? (
                        <Button variant="outline" size="sm" disabled>
                          Abrir indisponivel
                        </Button>
                      ) : (
                        <Button asChild variant="outline" size="sm">
                          <a href={getAttachmentHref(anexo)} target="_blank" rel="noreferrer">
                            Abrir
                          </a>
                        </Button>
                      )}
                      {canDeleteAttachments ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteAttachment(anexo)}
                          disabled={deletingAttachmentId === anexo.id}
                        >
                          {deletingAttachmentId === anexo.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <div className="flex items-center gap-1">
                              <Trash2 className="h-4 w-4" />
                              <span>{requiresAdminApprovalForSensitiveChanges ? "Solicitar" : "Excluir"}</span>
                            </div>
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

      </Tabs>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function InfoValue({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border bg-muted/15 px-3 py-2 text-sm text-foreground">{children}</div>
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0))
}

function toNumber(value: string) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function SignatureTag({
  label,
  value,
  date,
}: {
  label: string
  value: string | null | undefined
  date: string | null | undefined
}) {
  return (
    <div className="rounded-lg border bg-muted/15 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 font-medium">{value || "Pendente"}</div>
      <div className="text-xs text-muted-foreground">{date || "Sem registro"}</div>
    </div>
  )
}
