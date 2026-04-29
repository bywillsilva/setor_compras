"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { format, formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSearch,
  ShoppingCart,
  TrendingUp,
  Truck,
} from "lucide-react"
import { DashboardChart } from "@/components/dashboard-chart"
import { SetupBanner } from "@/components/setup-banner"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from "@/lib/domain"
import type { DashboardData } from "@/lib/types"

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dbConfigured, setDbConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    async function checkSetup() {
      try {
        const setupResponse = await fetch("/api/setup")
        const setupData = await setupResponse.json()
        setDbConfigured(setupData.configured)

        if (!setupData.configured) {
          setLoading(false)
          return
        }

        const dashboardResponse = await fetch("/api/dashboard")
        if (!dashboardResponse.ok) {
          throw new Error("Erro ao carregar dados do dashboard.")
        }

        setData(await dashboardResponse.json())
      } catch (currentError) {
        setError(currentError instanceof Error ? currentError.message : "Erro desconhecido.")
      } finally {
        setLoading(false)
      }
    }

    checkSetup()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  if (dbConfigured === false) {
    return (
      <div className="p-6">
        <SetupBanner onSetupComplete={() => window.location.reload()} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Erro ao carregar dados</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const stats = data?.stats

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do setor de compras corporativas</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Em andamento"
          value={stats?.total_pedidos ?? 0}
          description="pedidos ainda não entregues"
          icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Em cotação"
          value={stats?.em_cotacao ?? 0}
          description="aguardando retorno"
          icon={<FileSearch className="h-4 w-4 text-amber-600" />}
        />
        <StatCard
          title="Em análise"
          value={stats?.em_analise ?? 0}
          description="prontos para decisão"
          icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
        />
        <StatCard
          title="Autorizados"
          value={stats?.autorizados ?? 0}
          description="aguardando entrega"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        />
        <StatCard
          title="Entregues"
          value={stats?.entregues ?? 0}
          description="compras concluídas"
          icon={<Truck className="h-4 w-4 text-primary" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(stats?.pedidos_atrasados ?? 0) > 0 && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Pedidos atrasados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Há <strong className="text-destructive">{stats?.pedidos_atrasados}</strong> pedido(s) com previsão vencida.
              </p>
            </CardContent>
          </Card>
        )}

        {(stats?.pedidos_proximos ?? 0) > 0 && (
          <Card className="border-amber-300 bg-amber-50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-amber-700">
                <Clock className="h-4 w-4" />
                Entregas próximas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-amber-700">
                {stats?.pedidos_proximos} pedido(s) vencem nos próximos 3 dias.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Previsto vs realizado
            </CardTitle>
            <CardDescription>Comparativo mensal de orçamento e compras dos últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardChart data={data?.comparativo ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Últimas atualizações
            </CardTitle>
            <CardDescription>Pedidos alterados recentemente</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.ultimosPedidos && data.ultimosPedidos.length > 0 ? (
              <div className="space-y-4">
                {data.ultimosPedidos.map((pedido) => (
                  <Link
                    key={pedido.id}
                    href={`/compras/${pedido.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{pedido.fornecedor}</p>
                      <p className="text-xs text-muted-foreground">
                        {pedido.cliente_nome} · {pedido.proposta_nome}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={STATUS_BADGE_CLASSES[pedido.status]}>
                        {STATUS_LABELS[pedido.status]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(pedido.updated_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <ShoppingCart className="mx-auto mb-2 h-12 w-12 opacity-50" />
                <p>Nenhum pedido encontrado</p>
                <Link href="/compras/novo" className="text-sm text-primary hover:underline">
                  Criar primeiro pedido
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {data?.pedidosParados && data.pedidosParados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Pedidos sem movimentação
            </CardTitle>
            <CardDescription>Itens pendentes há mais de 7 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.pedidosParados.map((pedido) => (
                <Link
                  key={pedido.id}
                  href={`/compras/${pedido.id}`}
                  className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 p-3 transition-colors hover:bg-orange-100"
                >
                  <div>
                    <p className="text-sm font-medium">{pedido.fornecedor}</p>
                    <p className="text-xs text-muted-foreground">
                      {pedido.cliente_nome} · {pedido.proposta_nome}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge className={STATUS_BADGE_CLASSES[pedido.status]}>
                      {STATUS_LABELS[pedido.status]}
                    </Badge>
                    <p className="mt-1 text-xs text-orange-600">
                      Última atualização: {format(new Date(pedido.updated_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Valor total do mês</CardTitle>
          <CardDescription>Soma das compras registradas no mês atual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(stats?.valor_total_mes ?? 0)}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string
  value: number
  description: string
  icon: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
