"use client"

import Image from "next/image"
import { Suspense, useState, type FormEvent, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, FileText, Loader2, ShieldCheck, ShoppingCart, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    email: "",
    senha: "",
  })

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(getLoginErrorMessage(payload?.error, response.status))
      }

      router.push(searchParams.get("next") || "/")
      router.refresh()
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Nao foi possivel entrar no sistema.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_color-mix(in_srgb,var(--primary)_18%,transparent),_transparent_38%),linear-gradient(180deg,var(--background)_0%,color-mix(in_srgb,var(--background)_86%,var(--secondary))_100%)]">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="space-y-8 text-foreground">
          <div className="flex items-center gap-4">
            <Image
              src="/ag-compras-logo.png"
              alt="AG Compras - Sistema Corporativo"
              width={84}
              height={84}
              className="h-20 w-20 rounded-[24px] border border-white/15 bg-white/95 object-cover shadow-2xl shadow-slate-950/20"
              priority
            />
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/75 px-4 py-2 text-sm backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-primary" />
              AG Compras - Sistema Corporativo
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl">
              Acesse o AG Compras para acompanhar solicitacoes, compras e entregas.
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
              Entre com seu email e senha para continuar o acompanhamento operacional do setor de compras com seguranca e clareza.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <InfoCard
              icon={<ShoppingCart className="h-5 w-5 text-sky-300" />}
              title="Pedidos centralizados"
              description="Acompanhe cotacao, autorizacao e entrega em um fluxo organizado."
            />
            <InfoCard
              icon={<Truck className="h-5 w-5 text-emerald-300" />}
              title="Entregas visiveis"
              description="Consulte previsoes, atrasos e confirmacoes de recebimento com clareza."
            />
            <InfoCard
              icon={<FileText className="h-5 w-5 text-amber-300" />}
              title="Historico registrado"
              description="Mantenha informacoes, anexos e movimentacoes do processo no mesmo lugar."
            />
          </div>
        </section>

        <section>
          <Card className="border-border/80 bg-card/95 shadow-2xl shadow-slate-950/20 backdrop-blur">
            <CardContent className="space-y-6 p-8">
              <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Login</p>
                <h2 className="text-2xl font-semibold text-foreground">Entrar no AG Compras</h2>
                <p className="text-sm leading-6 text-muted-foreground">Use seu email e sua senha para acessar o painel.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={formData.email}
                    onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                    placeholder="voce@empresa.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="senha">Senha</Label>
                  <Input
                    id="senha"
                    type="password"
                    autoComplete="current-password"
                    value={formData.senha}
                    onChange={(event) => setFormData((current) => ({ ...current, senha: event.target.value }))}
                    placeholder="Sua senha"
                  />
                </div>

                {error && <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      Acessar painel
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="rounded-xl border border-border/70 bg-muted/70 p-4 text-sm text-muted-foreground">
                Se voce tiver dificuldade para entrar, procure o administrador responsavel pelo sistema.
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}

function InfoCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/45 p-4 backdrop-blur">
      <div className="mb-3 inline-flex rounded-xl bg-primary/10 p-2">{icon}</div>
      <h3 className="mb-1 font-medium">{title}</h3>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

function getLoginErrorMessage(error: unknown, status: number) {
  const message = typeof error === "string" ? error : ""
  const normalized = message
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()

  if (status === 401 || normalized.includes("email ou senha")) {
    return "Email ou senha invalidos."
  }

  if (normalized.includes("informe o email e a senha")) {
    return "Informe o email e a senha."
  }

  return "Nao foi possivel entrar no sistema no momento. Procure o administrador."
}
