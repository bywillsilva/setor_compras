'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bell, BellRing, CheckCheck, ExternalLink, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Notificacao } from '@/lib/types'

const NOTIFICATION_POLL_INTERVAL_MS = 12_000

type BrowserPermissionState = NotificationPermission | 'unsupported'

export function NotificationCenter() {
  const router = useRouter()
  const [items, setItems] = useState<Notificacao[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [permission, setPermission] = useState<BrowserPermissionState>('unsupported')
  const knownIdsRef = useRef<Set<number>>(new Set())
  const initializedRef = useRef(false)
  const pendingRequestRef = useRef(false)

  const hasUnread = unreadCount > 0

  const refreshNotifications = useCallback(async () => {
    if (pendingRequestRef.current) {
      return
    }

    pendingRequestRef.current = true

    try {
      const response = await fetch('/api/notificacoes?limit=12', {
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error('Nao foi possivel carregar as notificacoes.')
      }

      const data = (await response.json()) as {
        items?: Notificacao[]
        unreadCount?: number
      }

      const nextItems = data.items ?? []
      const nextUnreadCount = Number(data.unreadCount ?? 0)

      if (
        initializedRef.current &&
        permission === 'granted' &&
        typeof document !== 'undefined' &&
        (document.visibilityState === 'hidden' || !document.hasFocus())
      ) {
        for (const item of nextItems) {
          if (knownIdsRef.current.has(item.id)) {
            continue
          }

          const notification = new Notification(item.titulo, {
            body: item.mensagem,
            tag: `notificacao-${item.id}`,
          })

          notification.onclick = () => {
            window.focus()
            if (item.link) {
              window.location.href = item.link
            }
          }
        }
      }

      knownIdsRef.current = new Set([...knownIdsRef.current, ...nextItems.map((item) => item.id)])
      initializedRef.current = true
      setItems(nextItems)
      setUnreadCount(nextUnreadCount)
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(error)
      }
    } finally {
      pendingRequestRef.current = false
      setLoading(false)
      setUpdating(false)
    }
  }, [permission])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!('Notification' in window)) {
      setPermission('unsupported')
      return
    }

    setPermission(Notification.permission)
  }, [])

  useEffect(() => {
    void refreshNotifications()

    const intervalId = window.setInterval(() => {
      void refreshNotifications()
    }, NOTIFICATION_POLL_INTERVAL_MS)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setUpdating(true)
        void refreshNotifications()
      }
    }

    const handleOnline = () => {
      setUpdating(true)
      void refreshNotifications()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)
    window.addEventListener('focus', handleOnline)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('focus', handleOnline)
    }
  }, [refreshNotifications])

  const permissionHint = useMemo(() => {
    if (permission === 'default') {
      return 'Ative os avisos do navegador para receber alertas das novas atribuicoes.'
    }

    if (permission === 'denied') {
      return 'Os avisos do navegador foram bloqueados. Libere nas configuracoes do browser para receber alertas.'
    }

    if (permission === 'unsupported') {
      return 'Seu navegador atual nao permite alertas nativos.'
    }

    return 'Avisos do navegador ativos para novas atribuicoes.'
  }, [permission])

  async function handleEnableBrowserNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Este navegador nao suporta notificacoes nativas.')
      return
    }

    const nextPermission = await Notification.requestPermission()
    setPermission(nextPermission)

    if (nextPermission === 'granted') {
      toast.success('Notificacoes do navegador ativadas.')
      return
    }

    if (nextPermission === 'denied') {
      toast.error('As notificacoes foram bloqueadas neste navegador.')
    }
  }

  async function handleReadAll() {
    if (items.length === 0) {
      return
    }

    setUpdating(true)

    try {
      const response = await fetch('/api/notificacoes/ler-todas', { method: 'POST' })
      if (!response.ok) {
        throw new Error('Nao foi possivel marcar as notificacoes como lidas.')
      }

      setItems([])
      setUnreadCount(0)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao marcar notificacoes como lidas.')
    } finally {
      setUpdating(false)
    }
  }

  async function handleOpenNotification(item: Notificacao) {
    try {
      const response = await fetch(`/api/notificacoes/${item.id}/ler`, { method: 'POST' })
      if (!response.ok) {
        throw new Error('Nao foi possivel atualizar a notificacao.')
      }

      setItems((current) => current.filter((entry) => entry.id !== item.id))
      setUnreadCount((current) => Math.max(0, current - 1))

      if (item.link) {
        router.push(item.link)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao abrir notificacao.')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-11 w-11 rounded-2xl border-border/70 bg-card/90 shadow-sm backdrop-blur"
          aria-label="Abrir central de notificacoes"
        >
          {hasUnread ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {hasUnread ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[380px] rounded-2xl p-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Atividades atribuidas</DropdownMenuLabel>
          <div className="flex items-center gap-2">
            {hasUnread ? <Badge variant="outline">{unreadCount} pendente(s)</Badge> : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReadAll}
              disabled={items.length === 0 || updating}
              className="h-8 gap-1.5 px-2.5 text-xs"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar lidas
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator />

        <div className="px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <Settings2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{permissionHint}</span>
          </div>
          {permission === 'default' ? (
            <Button type="button" variant="link" className="mt-2 h-auto p-0 text-xs" onClick={handleEnableBrowserNotifications}>
              Ativar avisos do navegador
            </Button>
          ) : null}
        </div>

        <DropdownMenuSeparator />

        <div className="max-h-[420px] overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="px-2 py-8 text-center text-sm text-muted-foreground">Carregando notificacoes...</div>
          ) : items.length === 0 ? (
            <div className="px-2 py-8 text-center text-sm text-muted-foreground">
              Nenhuma atividade pendente no momento.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleOpenNotification(item)}
                  className="w-full rounded-xl border border-border/60 bg-background/80 px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{item.titulo}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.mensagem}</p>
                    </div>
                    {item.link ? <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(item.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
