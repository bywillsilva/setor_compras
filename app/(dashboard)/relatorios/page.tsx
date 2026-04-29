"use client"

import { useEffect, useState, type ReactNode } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  FileText,
  Truck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getDeliverySituationLabel,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from "@/lib/domain"
import type {
  Cliente,
  Compra,
  DeliveryMetrics,
  FinanceiroReportItem,
  HistoricoReportItem,
  Proposta,
  SituacaoEntrega,
} from "@/lib/types"

interface EntregasData extends Compra {
  situacao_entrega: string
}

export default function RelatoriosPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("compras")

  const [clienteId, setClienteId] = useState("todos")
  const [propostaId, setPropostaId] = useState("todos")
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")
  const [status, setStatus] = useState("todos")

  const [comprasData, setComprasData] = useState<Compra[]>([])
  const [financeiroData, setFinanceiroData] = useState<FinanceiroReportItem[]>([])
  const [entregasData, setEntregasData] = useState<EntregasData[]>([])
  const [historicoData, setHistoricoData] = useState<HistoricoReportItem[]>([])
  const [entregasMetricas, setEntregasMetricas] = useState<DeliveryMetrics | null>(null)

  useEffect(() => {
    async function fetchInitialData() {
      const [clientesResponse, propostasResponse] = await Promise.all([
        fetch("/api/clientes"),
        fetch("/api/propostas"),
      ])

      if (clientesResponse.ok) {
        setClientes(await clientesResponse.json())
      }

      if (propostasResponse.ok) {
        setPropostas(await propostasResponse.json())
      }
    }

    fetchInitialData()
  }, [])

  async function generateReport() {
    setLoading(true)

    try {
      const params = new URLSearchParams()
      params.set("tipo", activeTab)

      if (clienteId !== "todos") params.set("cliente_id", clienteId)
      if (propostaId !== "todos") params.set("proposta_id", propostaId)
      if (dataInicio) params.set("data_inicio", dataInicio)
      if (dataFim) params.set("data_fim", dataFim)
      if (status !== "todos" && activeTab === "compras") params.set("status", status)

      const response = await fetch(`/api/relatorios?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Erro ao gerar relatório.")
      }

      const payload = await response.json()

      if (activeTab === "compras") {
        setComprasData(payload.dados)
      } else if (activeTab === "financeiro") {
        setFinanceiroData(payload.dados)
      } else if (activeTab === "entregas") {
        setEntregasData(payload.dados)
        setEntregasMetricas(payload.metricas)
      } else {
        setHistoricoData(payload.dados)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function exportToCSV() {
    let rows: string[] = []
    let fileName = `relatorio_${activeTab}.csv`

    if (activeTab === "compras" && comprasData.length > 0) {
      rows = [
        "ID,Cliente,Proposta,Fornecedor,Status,Valor,Data Criação",
        ...comprasData.map(
          (compra) =>
            `${compra.id},"${compra.cliente_nome}","${compra.proposta_nome}","${compra.fornecedor}","${STATUS_LABELS[compra.status]}",${Number(compra.valor_total ?? 0)},"${compra.data_criacao}"`,
        ),
      ]
    }

    if (activeTab === "financeiro" && financeiroData.length > 0) {
      rows = [
        "Proposta,Cliente,Previsto,Realizado,Perdas,Diferença",
        ...financeiroData.map(
          (item) =>
            `"${item.proposta_nome}","${item.cliente_nome}",${item.valor_previsto},${item.valor_realizado},${item.custo_perdas},${item.diferenca}`,
        ),
      ]
    }

    if (activeTab === "entregas" && entregasData.length > 0) {
      rows = [
        "ID,Fornecedor,Cliente,Previsão,Situação",
        ...entregasData.map(
          (item) =>
            `${item.id},"${item.fornecedor}","${item.cliente_nome}","${item.previsao_entrega ?? "-"}","${item.situacao_entrega}"`,
        ),
      ]
    }

    if (activeTab === "historico" && historicoData.length > 0) {
      rows = [
        "Data,Cliente,Proposta,Fornecedor,Evento",
        ...historicoData.map(
          (item) =>
            `"${item.data}","${item.cliente_nome}","${item.proposta_nome}","${item.fornecedor}","${item.evento}"`,
        ),
      ]
    }

    if (rows.length === 0) {
      return
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = fileName
    link.click()
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">Compras, financeiro, entregas e histórico completo do setor</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Filtros
          </CardTitle>
          <CardDescription>Defina os parâmetros para gerar o relatório</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Cliente">
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
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
            </Field>

            <Field label="Proposta">
              <Select value={propostaId} onValueChange={setPropostaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as propostas</SelectItem>
                  {propostas
                    .filter((proposta) => clienteId === "todos" || proposta.cliente_id.toString() === clienteId)
                    .map((proposta) => (
                      <SelectItem key={proposta.id} value={proposta.id.toString()}>
                        {proposta.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Data início">
              <Input type="date" value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} />
            </Field>

            <Field label="Data fim">
              <Input type="date" value={dataFim} onChange={(event) => setDataFim(event.target.value)} />
            </Field>
          </div>

          {activeTab === "compras" && (
            <Field label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="cotacao">Cotação</SelectItem>
                  <SelectItem value="em_analise">Em análise</SelectItem>
                  <SelectItem value="retificacao">Retificação</SelectItem>
                  <SelectItem value="pedido_autorizado">Pedido autorizado</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          <div className="flex gap-2">
            <Button onClick={generateReport} disabled={loading}>
              {loading ? "Gerando..." : "Gerar relatório"}
            </Button>
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel (CSV)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="compras" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Compras
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="entregas" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Entregas
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compras">
          <Card>
            <CardHeader>
              <CardTitle>Relatório de compras</CardTitle>
              <CardDescription>{comprasData.length} registro(s) encontrado(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleEmpty visible={comprasData.length === 0} icon={<FileText className="h-12 w-12 opacity-50" />}>
                Clique em Gerar relatório para visualizar os dados.
              </SimpleEmpty>

              {comprasData.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Proposta</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comprasData.map((compra) => (
                      <TableRow key={compra.id}>
                        <TableCell className="font-mono">#{compra.id}</TableCell>
                        <TableCell>{compra.cliente_nome}</TableCell>
                        <TableCell>{compra.proposta_nome}</TableCell>
                        <TableCell>{compra.fornecedor}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_BADGE_CLASSES[compra.status]}>
                            {STATUS_LABELS[compra.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(compra.valor_total ?? 0)}</TableCell>
                        <TableCell>{format(new Date(compra.data_criacao), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financeiro">
          <Card>
            <CardHeader>
              <CardTitle>Relatório financeiro</CardTitle>
              <CardDescription>Previsto vs realizado, com perdas e saldo por proposta</CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleEmpty visible={financeiroData.length === 0} icon={<DollarSign className="h-12 w-12 opacity-50" />}>
                Clique em Gerar relatório para visualizar os dados.
              </SimpleEmpty>

              {financeiroData.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proposta</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Previsto</TableHead>
                      <TableHead className="text-right">Realizado</TableHead>
                      <TableHead className="text-right">Perdas</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financeiroData.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.proposta_nome}</TableCell>
                        <TableCell>{item.cliente_nome}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.valor_previsto)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.valor_realizado)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.custo_perdas)}</TableCell>
                        <TableCell
                          className={`text-right font-medium ${item.diferenca >= 0 ? "text-emerald-600" : "text-red-600"}`}
                        >
                          {formatCurrency(item.diferenca)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entregas">
          <div className="space-y-4">
            {entregasMetricas && (
              <div className="grid gap-4 md:grid-cols-4">
                <MetricCard title="Total" value={entregasMetricas.total} icon={<Truck className="h-4 w-4 text-muted-foreground" />} />
                <MetricCard title="Entregues" value={entregasMetricas.entregues} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} className="text-emerald-600" />
                <MetricCard title="No prazo" value={entregasMetricas.entregues_no_prazo} icon={<Clock className="h-4 w-4 text-blue-600" />} className="text-blue-600" />
                <MetricCard title="Atrasados" value={entregasMetricas.atrasados} icon={<AlertTriangle className="h-4 w-4 text-red-600" />} className="text-red-600" description={`Média de entrega: ${entregasMetricas.tempo_medio_entrega.toFixed(1)} dias`} />
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Relatório de entregas</CardTitle>
                <CardDescription>Situação das entregas e previsões dos pedidos autorizados</CardDescription>
              </CardHeader>
              <CardContent>
                <SimpleEmpty visible={entregasData.length === 0} icon={<Truck className="h-12 w-12 opacity-50" />}>
                  Clique em Gerar relatório para visualizar os dados.
                </SimpleEmpty>

                {entregasData.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Previsão</TableHead>
                        <TableHead>Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entregasData.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">#{item.id}</TableCell>
                          <TableCell className="font-medium">{item.fornecedor}</TableCell>
                          <TableCell>{item.cliente_nome}</TableCell>
                          <TableCell>
                            {item.previsao_entrega
                              ? format(parseISO(item.previsao_entrega), "dd/MM/yyyy", { locale: ptBR })
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge className={deliveryBadgeClass(item.situacao_entrega)}>
                              {getDeliverySituationLabel(item.situacao_entrega as SituacaoEntrega)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle>Histórico completo</CardTitle>
              <CardDescription>Timeline consolidada de alterações dos pedidos</CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleEmpty visible={historicoData.length === 0} icon={<Clock className="h-12 w-12 opacity-50" />}>
                Clique em Gerar relatório para visualizar os dados.
              </SimpleEmpty>

              {historicoData.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Proposta</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Evento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicoData.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{format(new Date(item.data), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                        <TableCell>{item.cliente_nome}</TableCell>
                        <TableCell>{item.proposta_nome}</TableCell>
                        <TableCell>{item.fornecedor}</TableCell>
                        <TableCell>{item.evento}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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

function MetricCard({
  title,
  value,
  icon,
  className,
  description,
}: {
  title: string
  value: number
  icon: ReactNode
  className?: string
  description?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${className ?? ""}`}>{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  )
}

function SimpleEmpty({
  visible,
  icon,
  children,
}: {
  visible: boolean
  icon: ReactNode
  children: ReactNode
}) {
  if (!visible) {
    return null
  }

  return (
    <div className="py-12 text-center text-muted-foreground">
      <div className="mb-2 flex justify-center">{icon}</div>
      <p>{children}</p>
    </div>
  )
}

function deliveryBadgeClass(situacao: string) {
  if (situacao === "entregue") return "bg-emerald-100 text-emerald-800"
  if (situacao === "atrasado") return "bg-red-100 text-red-800"
  if (situacao === "proximo") return "bg-amber-100 text-amber-800"
  return "bg-blue-100 text-blue-800"
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}
