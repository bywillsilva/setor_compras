"use client"

import { use, useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  MoreHorizontal,
  Package,
  Paperclip,
  Save,
  Truck,
  Trash2,
  Upload,
} from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { DeliveryStatusBadge } from "@/components/compras/delivery-status-badge"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  CATEGORIA_LABELS,
  CATEGORIA_OPTIONS,
  getDeliverySituation,
  STATUS_BADGE_CLASSES,
  STATUS_ENTREGA_LABELS,
  STATUS_LABELS,
  TIPO_ANEXO_LABELS,
} from "@/lib/domain"
import type { Anexo, Compra, HistoricoCompra, TipoAnexo } from "@/lib/types"

interface CompraDetalhe extends Compra {
  historico: HistoricoCompra[]
  anexos: Anexo[]
}

const ATTACHMENT_TYPE_OPTIONS: TipoAnexo[] = ["cotacao", "nf", "boleto", "outro"]

export default function CompraDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const session = useCurrentSession()
  const router = useRouter()
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)
  const [compra, setCompra] = useState<CompraDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [togglingArchive, setTogglingArchive] = useState(false)
  const [editing, setEditing] = useState(false)
  const [attachmentType, setAttachmentType] = useState<TipoAnexo>("outro")
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])
  const [uploadingAttachments, setUploadingAttachments] = useState(false)
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<number | null>(null)
  const [requestingAuthorization, setRequestingAuthorization] = useState(false)
  const [formData, setFormData] = useState({
    categoria: "perdas",
    fornecedor: "",
    descricao: "",
    data_envio_fornecedor: "",
  })

  useEffect(() => {
    fetchCompra()
  }, [id])

  async function fetchCompra() {
    try {
      const response = await fetch(`/api/compras/${id}`)
      if (!response.ok) {
        throw new Error("Compra nao encontrada.")
      }

      const payload = await response.json()
      setCompra(payload)
      setFormData({
        categoria: payload.categoria,
        fornecedor: payload.fornecedor ?? "",
        descricao: payload.descricao ?? "",
        data_envio_fornecedor: payload.data_envio_fornecedor ?? "",
      })
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)

    try {
      const response = await fetch(`/api/compras/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria: formData.categoria,
          fornecedor: formData.fornecedor,
          descricao: formData.descricao,
          data_envio_fornecedor: formData.data_envio_fornecedor || null,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || "Erro ao atualizar pedido.")
      }

      await fetchCompra()
      setEditing(false)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao atualizar pedido.")
    } finally {
      setSaving(false)
    }
  }

  async function handleArchiveToggle() {
    if (!compra) {
      return
    }

    const nextArchivedState = !compra.arquivado
    const confirmMessage = nextArchivedState
      ? "Deseja arquivar este pedido?"
      : "Deseja desarquivar este pedido e voltar com ele para a lista ativa?"

    if (!confirm(confirmMessage)) {
      return
    }

    setTogglingArchive(true)

    try {
      const response = await fetch(`/api/compras/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arquivado: nextArchivedState }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || "Erro ao atualizar arquivamento do pedido.")
      }

      await fetchCompra()
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao atualizar arquivamento do pedido.")
    } finally {
      setTogglingArchive(false)
    }
  }

  async function handleDelete() {
    if (!compra) {
      return
    }

    if (!confirm("Deseja excluir este pedido permanentemente? O historico e os anexos vinculados tambem serao removidos.")) {
      return
    }

    setDeleting(true)

    try {
      const response = await fetch(`/api/compras/${id}`, { method: "DELETE" })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || "Erro ao excluir pedido.")
      }

      router.push("/compras")
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao excluir pedido.")
    } finally {
      setDeleting(false)
    }
  }

  async function handleRequestAuthorization() {
    if (!compra) {
      return
    }

    setRequestingAuthorization(true)

    try {
      const response = await fetch(`/api/compras/${compra.id}/solicitacao-autorizacao`, {
        method: "POST",
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao solicitar autorizacao.")
      }

      alert("Solicitacao registrada no historico do pedido.")
      await fetchCompra()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao solicitar autorizacao.")
    } finally {
      setRequestingAuthorization(false)
    }
  }

  async function handleUploadAttachments() {
    if (attachmentFiles.length === 0) {
      alert("Selecione pelo menos um arquivo para enviar.")
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

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Erro ao enviar anexos.")
      }

      setAttachmentFiles([])
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = ""
      }
      await fetchCompra()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao enviar anexos.")
    } finally {
      setUploadingAttachments(false)
    }
  }

  async function handleDeleteAttachment(anexo: Anexo) {
    if (!confirm(`Deseja excluir o anexo "${anexo.nome_arquivo}"?`)) {
      return
    }

    setDeletingAttachmentId(anexo.id)

    try {
      const response = await fetch(`/api/compras/${id}/anexos/${anexo.id}`, {
        method: "DELETE",
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao excluir anexo.")
      }

      await fetchCompra()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao excluir anexo.")
    } finally {
      setDeletingAttachmentId(null)
    }
  }

  function resetEditing() {
    if (!compra) {
      return
    }

    setEditing(false)
    setFormData({
      categoria: compra.categoria,
      fornecedor: compra.fornecedor ?? "",
      descricao: compra.descricao ?? "",
      data_envio_fornecedor: compra.data_envio_fornecedor ?? "",
    })
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
            <CardTitle className="text-destructive">Compra nao encontrada</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const deliverySituation = getDeliverySituation(compra)
  const deliveryLabel =
    compra.status === "pedido_autorizado" ? STATUS_ENTREGA_LABELS[compra.status_entrega] : "Aguardando autorizacao"

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/compras">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">Pedido #{compra.id}</h1>
              <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
              {compra.arquivado && <Badge variant="outline">Arquivado</Badge>}
              {compra.status === "pedido_autorizado" && <DeliveryStatusBadge compra={compra} />}
            </div>
            <p className="text-muted-foreground">
              {compra.cliente_nome} - {compra.proposta_nome}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {compra.status !== "pedido_autorizado" && session?.perfil === "admin" ? (
            <Link href={`/autorizacoes/${compra.id}`}>
              <Button variant="outline">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Autorizar pedido
              </Button>
            </Link>
          ) : compra.status !== "pedido_autorizado" ? (
            <Button variant="outline" onClick={handleRequestAuthorization} disabled={requestingAuthorization}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {requestingAuthorization ? "Solicitando..." : "Solicitar autorizacao"}
            </Button>
          ) : session?.perfil === "admin" ? (
            <Link href={`/autorizacoes/${compra.id}`}>
              <Button variant="outline">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Revisar autorizacao
              </Button>
            </Link>
          ) : null}

          {compra.status === "pedido_autorizado" && (
            <Link href={`/entregas/${compra.id}`}>
              <Button variant="outline">
                <Truck className="mr-2 h-4 w-4" />
                {compra.status_entrega === "entregue" ? "Revisar entrega" : "Informar entrega"}
              </Button>
            </Link>
          )}

          {!editing ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <MoreHorizontal className="mr-2 h-4 w-4" />
                  Mais acoes
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditing(true)}>Editar dados gerais</DropdownMenuItem>
                <DropdownMenuItem onClick={handleArchiveToggle} disabled={togglingArchive}>
                  {compra.arquivado ? "Desarquivar pedido" : "Arquivar pedido"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleDelete} disabled={deleting || togglingArchive}>
                  Excluir pedido
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="outline" onClick={resetEditing}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {deliverySituation === "atrasado" && (
        <AlertCard
          icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
          title="Entrega atrasada"
          description={`A previsao original era ${formatDate(compra.previsao_entrega)}.`}
          className="border-destructive/40 bg-destructive/5"
          titleClassName="text-destructive"
          descriptionClassName="text-muted-foreground"
        />
      )}

      {deliverySituation === "proximo" && (
        <AlertCard
          icon={<Clock className="h-5 w-5 text-amber-700" />}
          title="Entrega proxima do vencimento"
          description={`Previsao atual: ${formatDate(compra.previsao_entrega)}.`}
          className="border-amber-300 bg-amber-50"
          titleClassName="text-amber-700"
          descriptionClassName="text-amber-700"
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Status do pedido"
          icon={<Package className="h-4 w-4 text-muted-foreground" />}
          primary={<Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>}
          secondary={getOperationalNote(compra)}
        />
        <SummaryCard
          title="Fornecedor"
          icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
          primary={compra.fornecedor}
          secondary={compra.numero_pedido ? `Pedido ${compra.numero_pedido}` : "Numero pendente"}
        />
        <SummaryCard
          title="Financeiro"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          primary={compra.valor_total ? formatCurrency(compra.valor_total) : "A definir"}
          secondary={`Categoria ${CATEGORIA_LABELS[compra.categoria]}`}
        />
        <SummaryCard
          title="Entrega"
          icon={<Truck className="h-4 w-4 text-muted-foreground" />}
          primary={compra.status === "pedido_autorizado" ? <DeliveryStatusBadge compra={compra} /> : deliveryLabel}
          secondary={
            compra.previsao_entrega
              ? `Previsao ${formatDate(compra.previsao_entrega)}`
              : compra.status === "pedido_autorizado"
                ? "Sem previsao registrada"
                : "Defina na etapa de autorizacao"
          }
        />
      </div>

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="historico">Historico</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <Card>
            <CardHeader>
              <CardTitle>Resumo do pedido</CardTitle>
              <CardDescription>Informacoes centrais e contexto operacional do pedido.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Info label="Cliente">{compra.cliente_nome}</Info>
                <Info label="Proposta">{compra.proposta_nome}</Info>
                <Info label="Categoria">{CATEGORIA_LABELS[compra.categoria]}</Info>
                <Info label="Status da entrega">{deliveryLabel}</Info>
                <Info label="Criado em">{formatDateTime(compra.data_criacao)}</Info>
                <Info label="Ultima atualizacao">{formatDateTime(compra.updated_at)}</Info>
                <Info label="Data de envio ao fornecedor">{formatDate(compra.data_envio_fornecedor)}</Info>
                <Info label="Previsao de entrega">{formatDate(compra.previsao_entrega)}</Info>
                <Info label="Data real da entrega">{formatDate(compra.data_entrega_real)}</Info>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Descricao</p>
                <div className="rounded-xl border bg-muted/20 p-4 whitespace-pre-wrap">
                  {compra.descricao || "Sem descricao registrada."}
                </div>
              </div>

              {editing && (
                <div className="space-y-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-5">
                  <div>
                    <h3 className="font-medium text-foreground">Edicao rapida</h3>
                    <p className="text-sm text-muted-foreground">
                      Ajuste apenas os dados gerais. A autorizacao e o registro da entrega seguem em etapas proprias.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Categoria">
                      <Select
                        value={formData.categoria}
                        onValueChange={(value) => setFormData((current) => ({ ...current, categoria: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIA_OPTIONS.map((categoria) => (
                            <SelectItem key={categoria} value={categoria}>
                              {CATEGORIA_LABELS[categoria]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label="Data de envio ao fornecedor">
                      <Input
                        type="date"
                        value={formData.data_envio_fornecedor}
                        onChange={(event) =>
                          setFormData((current) => ({ ...current, data_envio_fornecedor: event.target.value }))
                        }
                      />
                    </Field>
                  </div>

                  <Field label="Fornecedor">
                    <Input
                      value={formData.fornecedor}
                      onChange={(event) => setFormData((current) => ({ ...current, fornecedor: event.target.value }))}
                    />
                  </Field>

                  <Field label="Descricao da compra">
                    <Textarea
                      rows={5}
                      value={formData.descricao}
                      onChange={(event) => setFormData((current) => ({ ...current, descricao: event.target.value }))}
                    />
                  </Field>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos">
          <Card>
            <CardHeader>
              <CardTitle>Documentos do pedido</CardTitle>
              <CardDescription>{compra.anexos.length} arquivo(s) vinculado(s) a este pedido.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                      Envie cotacoes, notas fiscais, boletos ou outros documentos de suporte.
                    </p>
                    {attachmentFiles.length > 0 && (
                      <p className="text-xs font-medium text-foreground">
                        {attachmentFiles.length} arquivo(s) pronto(s) para envio.
                      </p>
                    )}
                  </div>
                </Field>

                <div className="flex items-end">
                  <Button type="button" onClick={handleUploadAttachments} disabled={uploadingAttachments}>
                    {uploadingAttachments ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Enviar
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {compra.anexos.length === 0 ? (
                <EmptyCard
                  icon={<Paperclip className="h-4 w-4" />}
                  title="Nenhum documento registrado"
                  description="Adicione anexos para centralizar cotacoes, boletos e notas fiscais."
                />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {compra.anexos.map((anexo) => (
                    <div key={anexo.id} className="rounded-xl border p-4 transition-colors hover:bg-muted/30">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-sm font-medium">{anexo.nome_arquivo}</p>
                          <Badge variant="outline">{TIPO_ANEXO_LABELS[anexo.tipo]}</Badge>
                        </div>
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground">{formatAttachmentDate(anexo.created_at)}</p>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <Button asChild variant="outline" size="sm">
                          <a href={anexo.arquivo_url} target="_blank" rel="noreferrer">
                            Abrir anexo
                          </a>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteAttachment(anexo)}
                          disabled={deletingAttachmentId === anexo.id}
                        >
                          {deletingAttachmentId === anexo.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Excluindo...
                            </>
                          ) : (
                            <>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle>Historico do pedido</CardTitle>
              <CardDescription>{compra.historico.length} evento(s) registrados automaticamente.</CardDescription>
            </CardHeader>
            <CardContent>
              {compra.historico.length === 0 ? (
                <EmptyCard
                  icon={<Clock className="h-4 w-4" />}
                  title="Nenhum evento registrado"
                  description="As movimentacoes do pedido aparecerao aqui conforme o fluxo for evoluindo."
                />
              ) : (
                <div className="space-y-4">
                  {compra.historico.map((evento, index) => (
                    <div key={evento.id} className="relative pl-6">
                      {index !== compra.historico.length - 1 && (
                        <div className="absolute left-[9px] top-6 h-full w-0.5 bg-border" />
                      )}
                      <div className="absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border-2 border-primary bg-background" />
                      <div>
                        <p className="text-sm font-medium">{evento.evento}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(evento.data), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/15 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-1 font-medium">{children}</div>
    </div>
  )
}

function SummaryCard({
  title,
  icon,
  primary,
  secondary,
}: {
  title: string
  icon: ReactNode
  primary: ReactNode
  secondary: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-lg font-semibold">{primary}</div>
        <p className="text-sm text-muted-foreground">{secondary}</p>
      </CardContent>
    </Card>
  )
}

function formatAttachmentDate(value: string) {
  if (!value) {
    return "Data de envio indisponivel"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Data de envio indisponivel"
  }

  return `Enviado em ${format(date, "dd/MM/yyyy", { locale: ptBR })}`
}

function AlertCard({
  icon,
  title,
  description,
  className,
  titleClassName,
  descriptionClassName,
}: {
  icon: ReactNode
  title: string
  description: string
  className?: string
  titleClassName?: string
  descriptionClassName?: string
}) {
  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-3 py-4">
        {icon}
        <div>
          <p className={`font-medium ${titleClassName ?? ""}`}>{title}</p>
          <p className={`text-sm ${descriptionClassName ?? "text-muted-foreground"}`}>{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
      {icon}
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p>{description}</p>
      </div>
    </div>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-"
  }

  return format(parseISO(value), "dd/MM/yyyy", { locale: ptBR })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-"
  }

  return format(new Date(value), "dd/MM/yyyy HH:mm", { locale: ptBR })
}

function getOperationalNote(compra: Compra) {
  if (compra.status === "cotacao") {
    return "Pedido em preparacao para analise."
  }

  if (compra.status === "em_analise") {
    return "Aguardando decisao de autorizacao."
  }

  if (compra.status === "retificacao") {
    return "Pedido retornou para ajustes."
  }

  if (compra.status_entrega === "entregue") {
    return "Fluxo concluido com entrega registrada."
  }

  return "Pedido autorizado e em acompanhamento logistico."
}
