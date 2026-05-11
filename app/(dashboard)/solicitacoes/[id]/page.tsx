"use client"

import { use, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Loader2, Paperclip, RefreshCcw, Trash2 } from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { CompraRateioFields, type CompraRateioFormState } from "@/components/compras/compra-rateio-fields"
import { useLiveRefresh } from "@/components/shared/use-live-refresh"
import { hasFeatureAccess } from "@/lib/auth/permissions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  CATEGORIA_LABELS,
  ETAPA_FLUXO_BADGE_CLASSES,
  ETAPA_FLUXO_LABELS,
  isCompraLockedAfterAdminApproval,
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
  const [processing, setProcessing] = useState(false)
  const [attachmentType, setAttachmentType] = useState<TipoAnexo>("cotacao")
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])
  const [uploadingAttachments, setUploadingAttachments] = useState(false)
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<number | null>(null)
  const [motivoRetificacao, setMotivoRetificacao] = useState("")
  const [savingQuoteData, setSavingQuoteData] = useState(false)
  const [quoteData, setQuoteData] = useState<CompraRateioFormState>({
    valor_categoria_perfis: "",
    valor_categoria_vidros: "",
    valor_categoria_acessorios: "",
    valor_categoria_perdas: "",
    valor_categoria_outros: "",
  })
  const canViewAsCompras = Boolean(session && hasFeatureAccess(session.perfil, "compras", session.features))
  const canManageAttachments = Boolean(
    session &&
      (hasFeatureAccess(session.perfil, "solicitacoes", session.features) ||
        hasFeatureAccess(session.perfil, "compras", session.features)),
  )
  const canDeleteAttachments = Boolean(
    compra &&
      (session?.perfil === "admin" ||
        (canViewAsCompras && !isCompraLockedAfterAdminApproval(compra)) ||
        (canViewAsCompras && isCompraLockedAfterAdminApproval(compra))),
  )
  const requiresAdminApprovalForSensitiveChanges = Boolean(
    compra && session?.perfil !== "admin" && canViewAsCompras && isCompraLockedAfterAdminApproval(compra),
  )

  useEffect(() => {
    fetchSolicitacao()
  }, [id])

  useLiveRefresh(fetchSolicitacao, {
    enabled: !processing && !savingQuoteData && !uploadingAttachments && deletingAttachmentId === null,
    intervalMs: 10000,
  })

  async function fetchSolicitacao() {
    try {
      const response = await fetch(`/api/solicitacoes/${id}`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Solicitacao nao encontrada.")
      }

      const payload = await response.json()
      setCompra(payload)
      setQuoteData({
        valor_categoria_perfis: payload.valor_categoria_perfis?.toString() ?? "",
        valor_categoria_vidros: payload.valor_categoria_vidros?.toString() ?? "",
        valor_categoria_acessorios: payload.valor_categoria_acessorios?.toString() ?? "",
        valor_categoria_perdas: payload.valor_categoria_perdas?.toString() ?? "",
        valor_categoria_outros: payload.valor_categoria_outros?.toString() ?? "",
      })
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
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

      await fetchSolicitacao()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar os dados da cotacao.")
    } finally {
      setSavingQuoteData(false)
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
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Solicitacao nao encontrada</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const canApproveAsRequester = session?.userId === compra.solicitante_id && compra.etapa_fluxo === "analise_solicitante"
  const canEditQuoteData = canViewAsCompras && compra.status !== "pedido_autorizado"
  const propostaOrcamento = compra.proposta_orcamento
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
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/solicitacoes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Solicitacao #{compra.id}</h1>
            <Badge className={ETAPA_FLUXO_BADGE_CLASSES[compra.etapa_fluxo]}>
              {ETAPA_FLUXO_LABELS[compra.etapa_fluxo]}
            </Badge>
            <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
          </div>
          <p className="text-muted-foreground">
            {compra.cliente_nome} - {compra.proposta_nome}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Dados da solicitacao</CardTitle>
            <CardDescription>Informacoes base para a cotacao e os proximos setores do fluxo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Solicitante">
                <InfoValue>{compra.solicitado_por || "Nao informado"}</InfoValue>
              </Field>
              <Field label="Fornecedor sugerido">
                <InfoValue>{compra.fornecedor}</InfoValue>
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
              <div className="rounded-lg border bg-muted/15 p-4 text-sm leading-6 text-foreground">
                {compra.descricao?.trim() || "Sem descricao textual. Consulte o anexo da solicitacao para o material pedido."}
              </div>
            </Field>

            {propostaOrcamento && (
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
            )}

            <Field label="Assinaturas e registros do fluxo">
              <div className="grid gap-3 md:grid-cols-2">
                <SignatureTag label="Solicitante" value={compra.aprovado_solicitante_por} date={compra.aprovado_solicitante_em} />
                <SignatureTag label="Administrador" value={compra.aprovado_admin_por} date={compra.aprovado_admin_em} />
                <SignatureTag label="Financeiro" value={compra.aprovado_financeiro_por} date={compra.aprovado_financeiro_em} />
                <SignatureTag label="Comprador" value={compra.confirmado_fornecedor_por} date={compra.confirmado_fornecedor_em} />
              </div>
            </Field>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {canEditQuoteData && (
            <Card>
              <CardHeader>
                <CardTitle>Dados da compra para a cotacao</CardTitle>
                <CardDescription>
                  O solicitante nao preenche este rateio. Essa distribuicao e informada pelo comprador durante a cotacao.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CompraRateioFields
                  values={quoteData}
                  onChange={(field, value) => setQuoteData((current) => ({ ...current, [field]: value }))}
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
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Acoes desta etapa</CardTitle>
              <CardDescription>As transicoes do pedido acontecem por acoes diretas, sem troca manual de status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {canApproveAsRequester && (
                <>
                  <Button
                    className="w-full justify-start"
                    disabled={processing}
                    onClick={() =>
                        runAction(`/api/solicitacoes/${compra.id}/aprovar`, null, "Solicitacao assinada e aprovada para seguir a autorizacao.")
                      }
                    >
                    {processing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Assinar e aprovar cotacao
                  </Button>

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
                      {processing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="mr-2 h-4 w-4" />
                      )}
                      Solicitar retificacao
                    </Button>
                  </div>
                </>
              )}

              {!canApproveAsRequester && (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhuma acao imediata disponivel nesta etapa para o seu perfil.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Anexos</CardTitle>
              <CardDescription>Documentos e referencias enviados junto com a solicitacao.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canManageAttachments && (
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
              )}

              {compra.anexos.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhum anexo enviado nesta solicitacao.
                </div>
              ) : (
                compra.anexos.map((anexo) => (
                  <div key={anexo.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <div className="font-medium">{anexo.nome_arquivo}</div>
                      <div className="text-xs text-muted-foreground">
                        {anexo.tipo === "outro" ? "Anexo da solicitacao" : TIPO_ANEXO_LABELS[anexo.tipo]}
                      </div>
                      {anexo.disponivel === false && (
                        <div className="mt-1 text-xs text-destructive">
                          Arquivo indisponivel no servidor atual. Reenvie este documento para restaurar o acesso.
                        </div>
                      )}
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
                      {canDeleteAttachments && (
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
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
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
