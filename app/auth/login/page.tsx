"use client"

import { Suspense, useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Database, Loader2, LockKeyhole, ShieldCheck } from "lucide-react"
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
    email: "admin@compras.local",
    senha: "admin123456",
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
        throw new Error(payload.error || "Não foi possível entrar no sistema.")
      }

      router.push(searchParams.get("next") || "/")
      router.refresh()
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Erro ao realizar login.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_transparent_40%),linear-gradient(135deg,#0f172a_0%,#0b1120_45%,#0f172a_100%)]">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="space-y-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm backdrop-blur">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            Gestão corporativa de compras
          </div>

          <div className="space-y-4">
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl">
              Compras, propostas, entregas e orçamento em um fluxo só.
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-300 md:text-lg">
              Acesse o painel para controlar pedidos por cliente e obra, acompanhar atrasos, organizar anexos e comparar previsto versus realizado.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <InfoCard
              icon={<Database className="h-5 w-5 text-sky-300" />}
              title="Banco flexível"
              description="Funciona com MySQL ou Supabase usando a mesma camada de dados."
            />
            <InfoCard
              icon={<LockKeyhole className="h-5 w-5 text-emerald-300" />}
              title="Acesso inicial"
              description="Use APP_ADMIN_EMAIL e APP_ADMIN_PASSWORD ou o padrão local para o primeiro login."
            />
            <InfoCard
              icon={<ShieldCheck className="h-5 w-5 text-amber-300" />}
              title="Fluxo validado"
              description="Status, previsão de entrega, histórico e anexos seguem as regras do processo."
            />
          </div>
        </section>

        <section>
          <Card className="border-white/10 bg-white/95 shadow-2xl shadow-slate-950/30 backdrop-blur">
            <CardContent className="space-y-6 p-8">
              <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Login</p>
                <h2 className="text-2xl font-semibold text-slate-900">Entrar no sistema</h2>
                <p className="text-sm leading-6 text-slate-600">
                  Primeiro acesso local: <strong>admin@compras.local</strong> / <strong>admin123456</strong>.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
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

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Se o banco ainda não estiver configurado, abra a tela de{" "}
                <Link href="/configuracoes" className="font-medium text-primary underline-offset-4 hover:underline">
                  configurações
                </Link>{" "}
                para validar a conexão e criar as tabelas necessárias.
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="mb-3 inline-flex rounded-xl bg-white/10 p-2">{icon}</div>
      <h3 className="mb-1 font-medium">{title}</h3>
      <p className="text-sm leading-6 text-slate-300">{description}</p>
    </div>
  )
}
